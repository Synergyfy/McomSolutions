import { Injectable, Logger, NotFoundException, Optional, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AffiliateChargeStatus,
  AffiliateCompensationModel,
  AffiliatePaymentStatus,
  AffiliateProjectStatus,
  AffiliateReportStatus,
  AffiliateReviewDecision,
  AffiliateServiceRequestStatus,
  AffiliateTaskCategory,
  AffiliateTaskSource,
  AffiliateTaskStatus,
  BusinessRelationshipType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { AffiliateDirectoryService } from './affiliate-directory.service';
import { AffiliateClientService } from './affiliate-client.service';
import { AffiliateReputationService } from './affiliate-reputation.service';
import { AffiliateSettlementService } from './affiliate-settlement.service';
import { AffiliateTaskQuotaService } from './affiliate-task-quota.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import { BusinessAcquisitionService } from './business-acquisition.service';
import { TaskService } from '../task/task.service';
import { normalizePlatformKey } from './affiliate-affinity.util';
import { AFFILIATE_TASK_QUEUE, AffiliateTaskJobData } from '../queue/queue.constants';
import {
  AdminCreateAffiliateTaskDto,
  AffiliateTaskQueryDto,
  ApproveBusinessChargeDto,
  ApproveServiceRequestDto,
  AssignAffiliateTaskDto,
  CloseAffiliateProjectDto,
  CreateAffiliateProjectDto,
  CreateAffiliateServiceRequestDto,
  CreateAffiliateTaskDto,
  RateAffiliateDto,
  ReportAffiliateDto,
  ReviewAffiliateReportDto,
  ReviewAffiliateTaskDto,
  ReviewBusinessTaskDto,
} from './dto/affiliate.dto';

const CLOSED_STATUSES: AffiliateTaskStatus[] = [
  AffiliateTaskStatus.COMPLETED,
  AffiliateTaskStatus.CANCELLED,
];

// Declined tasks are intentionally reassignable: the spec says a declined
// assignment "returns for reassignment".
const TERMINAL_STATUSES: AffiliateTaskStatus[] = [
  AffiliateTaskStatus.COMPLETED,
  AffiliateTaskStatus.CANCELLED,
  AffiliateTaskStatus.DECLINED,
];

@Injectable()
export class AffiliateTaskService {
  private readonly logger = new Logger(AffiliateTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: AffiliateDirectoryService,
    private readonly accountManagers: AccountManagerAssignmentService,
    private readonly reputation: AffiliateReputationService,
    private readonly affiliateClient: AffiliateClientService,
    private readonly settlement: AffiliateSettlementService,
    private readonly quota: AffiliateTaskQuotaService,
    private readonly programmeTasks: TaskService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly acquisition: BusinessAcquisitionService,
    @Optional()
    @InjectQueue(AFFILIATE_TASK_QUEUE)
    private readonly affiliateQueue?: Queue<AffiliateTaskJobData>,
  ) {}

  /**
   * Queue a heavy post-response job (affiliate sync + email) so the API
   * responds immediately. Falls back to inline processing if Redis/queue is
   * unavailable (e.g. unit tests).
   */
  private async enqueueAffiliateJob(
    action: AffiliateTaskJobData['action'],
    taskId: string,
  ): Promise<void> {
    if (this.affiliateQueue) {
      try {
        await this.affiliateQueue.add(
          action,
          { taskId, action },
          {
            attempts: 4,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );
        return;
      } catch (error: any) {
        // Redis/queue unavailable — never fail the request; fall back to a
        // fire-and-forget inline run so the task still reaches the affiliate.
        this.logger.warn(`Queue unavailable (${error?.message}); processing inline`);
      }
    }
    void (action === 'delegate-task'
      ? this.processDelegationJob(taskId)
      : this.processReviewJob(taskId)
    ).catch((error) => this.logger.error(`Inline affiliate job failed: ${error?.message}`));
  }

  private frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  private isPaidActiveMembership(business: {
    membershipStatus?: string | null;
    membershipPlanName?: string | null;
    membershipExpiresAt?: Date | null;
  }): boolean {
    return (
      business.membershipStatus === 'active' &&
      !!business.membershipPlanName &&
      (!business.membershipExpiresAt || business.membershipExpiresAt > new Date())
    );
  }

  // ─────────────────────────── Business actions ───────────────────────────

  async createBusinessTask(userId: string, businessId: string | null, dto: CreateAffiliateTaskDto) {
    const business = await this.directory.getBusiness(userId, businessId);
    return this.createTaskForBusiness(business, userId, dto, 'BUSINESS');
  }

  /**
   * Admin-created delegation on behalf of a business. Mirrors the business
   * flow (quota checks, escrow reservation, affiliate sync) but resolves the
   * business by id and records the admin as the actor.
   */
  async createTaskAsAdmin(adminId: string, dto: AdminCreateAffiliateTaskDto) {
    const business = await this.directory.getBusinessById(dto.businessId);
    const task = await this.createTaskForBusiness(business, adminId, dto, 'ADMIN');
    return this.getTaskForAdmin(task.id);
  }

  private async createTaskForBusiness(
    business: Awaited<ReturnType<AffiliateDirectoryService['getBusiness']>>,
    userId: string,
    dto: CreateAffiliateTaskDto,
    actorRole: 'BUSINESS' | 'ADMIN',
  ) {
    // Paid memberships get an account manager assigned before delegation, so
    // the task goes straight to them instead of waiting for admin routing.
    // (Trial / access-pass businesses are intentionally excluded.)
    if (!business.accountManagerId && this.isPaidActiveMembership(business)) {
      try {
        const assigned = await this.accountManagers.assignForBusiness(business.id, {
          notify: false,
        });
        if (assigned) business.accountManagerId = assigned.userId;
      } catch (error: any) {
        this.logger.warn(
          `Auto-assign before delegation failed for business ${business.id}: ${error?.message}`,
        );
      }
    }

    // Explicit platform tags are validated against the business entitlements.
    // Platforms inherited from an admin programme task are trusted (the task
    // was already assigned to this business) so programme pushes never fail
    // because of an internal "mcom_central" tag.
    const explicitPlatforms = (dto.platforms ?? []).filter(Boolean);
    let platforms = [...explicitPlatforms];
    let taskDefinitionId = dto.taskDefinitionId ?? null;
    let assignmentTaskId: string | null = null;

    if (dto.assignmentId) {
      const assignment = await this.prisma.userTaskAssignment.findFirst({
        where: { id: dto.assignmentId, userId },
        include: { task: true },
      });
      if (!assignment) throw new NotFoundException('Programme task assignment not found');

      const activeDelegation = await this.prisma.affiliateTask.findFirst({
        where: {
          sourceAssignmentId: assignment.id,
          status: {
            notIn: [AffiliateTaskStatus.CANCELLED, AffiliateTaskStatus.DECLINED],
          },
        },
        select: { id: true },
      });
      if (activeDelegation) {
        throw new ConflictException(
          'This programme task has already been delegated to an affiliate.',
        );
      }

      taskDefinitionId = assignment.taskId;
      if (!platforms.length) {
        const normalized = assignment.task.platform;
        if (normalized) platforms = [normalized];
      }
      assignmentTaskId = assignment.id;
    }

    if (!platforms.length && taskDefinitionId) {
      const definition = await this.prisma.taskDefinition.findUnique({
        where: { id: taskDefinitionId },
        select: { platform: true },
      });
      if (definition?.platform) platforms = [definition.platform];
    }

    const validatedPlatforms = explicitPlatforms.length
      ? await this.directory.assertPlatformsAllowed(business.id, explicitPlatforms)
      : platforms
          .map((platform) => normalizePlatformKey(platform))
          .filter(Boolean);

    // Resolve assignee: explicit pick wins, otherwise the assigned manager.
    let assigneeId = dto.assigneeUserId ?? null;
    if (!assigneeId && business.accountManagerId) assigneeId = business.accountManagerId;

    let assignee: Awaited<ReturnType<AffiliateDirectoryService['assertAffiliateUser']>> | null =
      null;
    if (assigneeId) {
      assignee = await this.directory.assertAffiliateUser(assigneeId);
    }

    const dueAt = dto.dueAt
      ? new Date(dto.dueAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // A project must belong to the same business before tasks can be grouped.
    if (dto.projectId) {
      const project = await this.prisma.affiliateProject.findFirst({
        where: { id: dto.projectId, businessId: business.id },
        select: { id: true, accountManagerId: true },
      });
      if (!project) throw new NotFoundException('Project not found for this business');
    }

    // Dependencies may only point at another task for the same business.
    if (dto.prerequisiteTaskId) {
      const prerequisite = await this.prisma.affiliateTask.findFirst({
        where: { id: dto.prerequisiteTaskId, businessId: business.id },
        select: { id: true, status: true },
      });
      if (!prerequisite) {
        throw new BadRequestException('Prerequisite task must belong to the same business');
      }
    }

    const paidMembership = this.isPaidActiveMembership(business);
    const explicitCompensationPence =
      dto.compensationPence ??
      (dto.compensationAmount != null ? Math.round(Number(dto.compensationAmount) * 100) : null);
    const explicitCompensation =
      explicitCompensationPence != null ? explicitCompensationPence / 100 : null;

    // How many delegated tasks this business gets for free under its current
    // membership / access pass. Trial and no-plan businesses are always charged.
    const allowance = await this.quota.resolve(business.id);
    const quotaEnforced = allowance.source !== 'NONE';
    const withinFreeAllowance = !quotaEnforced || allowance.isFree;

    // An over-limit task with no price yet stays unassigned so an admin can
    // price it. Never auto-assign free work past the allowance.
    let effectiveAssignee = assignee;
    if (quotaEnforced && !allowance.isFree && effectiveAssignee) {
      const hasPrice =
        Number(dto.businessChargeAmount ?? 0) > 0 ||
        Number(explicitCompensation ?? 0) > 0;
      if (!hasPrice) effectiveAssignee = null;
    }

    const assigneeIsManager = effectiveAssignee?.role === Role.ACCOUNT_MANAGER;

    // Compensation model defaults follow the payment rules:
    // - paid CHS membership within the free allowance → AM coordination included.
    // - beyond the allowance → the task is chargeable, so pay the affiliate.
    // - Access Pass / Trial → delegated Account Manager work is chargeable.
    // - Agents / Consultants → paid per the agreed task rate when supplied.
    let compensationModel: AffiliateCompensationModel =
      dto.compensationModel ??
      (assigneeIsManager && paidMembership && withinFreeAllowance
        ? AffiliateCompensationModel.MEMBERSHIP_INCLUDED
        : explicitCompensation != null
          ? AffiliateCompensationModel.FIXED
          : AffiliateCompensationModel.NONE);

    const billableToBusiness = quotaEnforced
      ? Boolean(effectiveAssignee) && !allowance.isFree
      : dto.billableToBusiness ?? (!paidMembership && explicitCompensation != null);

    const businessChargeAmount = quotaEnforced
      ? billableToBusiness
        ? dto.businessChargeAmount ?? explicitCompensation ?? 0
        : null
      : dto.businessChargeAmount ?? (billableToBusiness ? explicitCompensation ?? 0 : null);
    const businessChargeStatus: AffiliateChargeStatus = billableToBusiness
      ? AffiliateChargeStatus.PENDING_APPROVAL
      : AffiliateChargeStatus.NOT_APPLICABLE;

    if (compensationModel === AffiliateCompensationModel.MEMBERSHIP_INCLUDED) {
      compensationModel = AffiliateCompensationModel.MEMBERSHIP_INCLUDED;
    }

    const compensationAmount =
      compensationModel === AffiliateCompensationModel.NONE ||
      compensationModel === AffiliateCompensationModel.MEMBERSHIP_INCLUDED
        ? null
        : explicitCompensation;
    const compensationPence =
      compensationAmount != null ? Math.round(compensationAmount * 100) : null;

    const paymentStatus: AffiliatePaymentStatus =
      compensationAmount != null && compensationAmount > 0
        ? AffiliatePaymentStatus.PENDING
        : AffiliatePaymentStatus.NOT_APPLICABLE;

    const freeDelegation = effectiveAssignee
      ? quotaEnforced
        ? allowance.isFree
        : false
      : null;

    const task = await this.prisma.affiliateTask.create({
      data: {
        businessId: business.id,
        createdByUserId: userId,
        source: taskDefinitionId ? AffiliateTaskSource.PROGRAMME : AffiliateTaskSource.MANUAL,
        taskDefinitionId,
        sourceAssignmentId: assignmentTaskId,
        projectId: dto.projectId ?? null,
        category:
          dto.category ??
          (validatedPlatforms.length > 0 && !dto.requiredSkills?.length
            ? AffiliateTaskCategory.INTERNAL
            : AffiliateTaskCategory.EXTERNAL),
        title: dto.title.trim(),
        description: dto.description.trim(),
        platforms: validatedPlatforms,
        requiredSkills: dto.requiredSkills ?? [],
        deliverables: dto.deliverables?.trim() || null,
        materials: dto.materials?.trim() || null,
        prerequisiteTaskId: dto.prerequisiteTaskId ?? null,
        requiresBusinessApproval: dto.requiresBusinessApproval ?? false,
        compensationModel,
        compensationAmount,
        compensationPence,
        compensationCurrency: dto.compensationCurrency ?? 'GBP',
        billableToBusiness,
        businessChargeAmount,
        businessChargeCurrency: dto.businessChargeCurrency ?? 'GBP',
        businessChargeStatus,
        paymentStatus,
        freeDelegation,
        delegationQuotaSource: allowance.source,
        delegationQuotaLimit: allowance.unlimited ? null : allowance.freeLimit,
        delegationQuotaUsed: allowance.used,
        delegationQuotaUnlimited: allowance.unlimited,
        delegationQuotaPeriodStart: allowance.periodStart,
        status: effectiveAssignee
          ? AffiliateTaskStatus.ASSIGNED
          : AffiliateTaskStatus.PENDING_ASSIGNMENT,
        assigneeId: effectiveAssignee?.id ?? null,
        assigneeRole: effectiveAssignee?.role ?? null,
        dueAt,
      },
      include: {
        business: { select: { id: true, businessName: true, email: true, userId: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        taskDefinition: { select: { id: true, title: true } },
      },
    });

    await this.recordEvent(task.id, {
      actorUserId: userId,
      actorRole,
      type: 'TASK_CREATED',
      message: `Task created (${task.category.toLowerCase()})`,
      metadata: {
        projectId: dto.projectId ?? null,
        compensationModel,
        compensationAmount,
        billableToBusiness,
        businessChargeAmount,
        freeDelegation,
        delegationQuotaSource: allowance.source,
        delegationQuotaUsed: allowance.used,
        delegationQuotaLimit: allowance.unlimited ? null : allowance.freeLimit,
      },
    });

    // Reserve the business charge (trial / access-pass) or note the
    // platform-funded payout before the affiliate can see the work. If the
    // wallet cannot cover the task we still assign it: the affiliate can see
    // the work, but cannot accept it until the funds are locked.
    if (task.assigneeId && (billableToBusiness || (compensationAmount ?? 0) > 0)) {
      try {
        await this.settlement.ensureForTask(task.id, {
          platformFeePercent: dto.platformFeePercent,
        });
        if (billableToBusiness) {
          await this.prisma.affiliateTask.update({
            where: { id: task.id },
            data: {
              businessChargeStatus: AffiliateChargeStatus.APPROVED,
              businessChargeApprovedAt: new Date(),
              businessChargeApprovedByUserId: userId,
            },
          });
        }
      } catch (error: any) {
        const escrowResponse =
          typeof error?.getResponse === 'function'
            ? error.getResponse()
            : error?.response;
        if (escrowResponse?.error !== 'TASK_ESCROW_FAILED') {
          throw error;
        }
        const settlement = await this.settlement.getForTask(task.id);
        const requiredCredits = Number(
          settlement?.businessChargeCredits?.toString() ?? 0,
        );
        const reason =
          escrowResponse?.message ||
          error?.message ||
          'The business wallet could not reserve the task amount.';
        await this.prisma.affiliateTask.update({
          where: { id: task.id },
          data: {
            status: AffiliateTaskStatus.ASSIGNED,
            paymentStatus: AffiliatePaymentStatus.ON_HOLD,
            ...(billableToBusiness
              ? { businessChargeStatus: AffiliateChargeStatus.PENDING_APPROVAL }
              : {}),
          },
        });
        await this.recordEvent(task.id, {
          actorUserId: userId,
          actorRole,
          type: 'TASK_FUNDS_REQUIRED',
          message: `Task assigned, but funds are not locked yet: ${reason}`,
          metadata: {
            requiredCredits,
            reason,
            currency: task.businessChargeCurrency,
          },
        });
        await this.notifyBusinessOfFundingRequired(task.id, requiredCredits);
      }
    }

    // Respond immediately — affiliate sync, emails and notifications run on the
    // queue so a slow/unreachable affiliate API never blocks the business.
    // Dependent tasks wait until their prerequisite is complete.
    if (!dto.prerequisiteTaskId) {
      await this.enqueueAffiliateJob('delegate-task', task.id);
    } else {
      await this.delegateIfPrerequisiteComplete(task.id);
    }

    // Keep the push-from-programme link explicit in the response envelope.
    return { ...(await this.getTaskForBusiness(business.id, task.id)), pushedFromAssignment: assignmentTaskId };
  }

  // ─────────────────────── Service requests & projects ────────────────────

  /** Business submits a request describing the outcome it wants. */
  async createServiceRequest(
    userId: string,
    businessId: string | null,
    dto: CreateAffiliateServiceRequestDto,
  ) {
    const business = await this.directory.getBusiness(userId, businessId);
    if (!business.accountManagerId && this.isPaidActiveMembership(business)) {
      try {
        const assigned = await this.accountManagers.assignForBusiness(business.id, {
          notify: false,
        });
        if (assigned) business.accountManagerId = assigned.userId;
      } catch (error: any) {
        this.logger.warn(`Auto-assign for service request failed: ${error?.message}`);
      }
    }

    const request = await this.prisma.affiliateServiceRequest.create({
      data: {
        businessId: business.id,
        requestedByUserId: userId,
        accountManagerId: business.accountManagerId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        desiredOutcome: dto.desiredOutcome?.trim() || null,
        urgency: dto.urgency ?? 'NORMAL',
      },
    });

    if (business.accountManagerId) {
      await this.notifyManagerOfRequest(request.id, business.accountManagerId);
    } else {
      await this.notifyAdminsForServiceRequest(request.id);
    }
    return request;
  }

  async listBusinessServiceRequests(businessId: string, query: AffiliateTaskQueryDto) {
    const where: Prisma.AffiliateServiceRequestWhereInput = { businessId };
    if (query.status) where.status = query.status as AffiliateServiceRequestStatus;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.paginateRequests(where, query);
  }

  async getBusinessServiceRequest(businessId: string, id: string) {
    const request = await this.prisma.affiliateServiceRequest.findFirst({
      where: { id, businessId },
      include: {
        project: { include: { tasks: { orderBy: { createdAt: 'desc' } } } },
        accountManager: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!request) throw new NotFoundException('Service request not found');
    return request;
  }

  /** Business accepts the quoted/estimated price before chargeable work starts. */
  async approveServiceRequestPrice(
    userId: string,
    businessId: string | null,
    requestId: string,
    dto: ApproveServiceRequestDto,
  ) {
    const business = await this.directory.getBusiness(userId, businessId);
    const request = await this.prisma.affiliateServiceRequest.findFirst({
      where: { id: requestId, businessId: business.id },
    });
    if (!request) throw new NotFoundException('Service request not found');
    if (
      request.status === AffiliateServiceRequestStatus.COMPLETED ||
      request.status === AffiliateServiceRequestStatus.REJECTED
    ) {
      throw new BadRequestException('This request is already closed');
    }

    return this.prisma.affiliateServiceRequest.update({
      where: { id: request.id },
      data: {
        estimatedCost: dto.estimatedCost ?? request.estimatedCost,
        currency: dto.currency ?? request.currency,
        priceApprovedAt: new Date(),
        priceApprovedByUserId: userId,
        status:
          request.status === AffiliateServiceRequestStatus.SUBMITTED
            ? AffiliateServiceRequestStatus.APPROVED
            : request.status,
        approvedAt: request.approvedAt ?? new Date(),
      },
    });
  }

  /**
   * Account Manager records the price for chargeable (Access Pass / Trial)
   * work. The business must then approve it before tasks can start.
   */
  async quoteServiceRequest(
    actorUserId: string,
    requestId: string,
    dto: ApproveServiceRequestDto,
    opts: { asAdmin?: boolean } = {},
  ) {
    const request = await this.prisma.affiliateServiceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Service request not found');
    if (!opts.asAdmin) this.assertManager(request.accountManagerId, actorUserId);
    if (dto.estimatedCost == null) {
      throw new BadRequestException('estimatedCost is required');
    }

    const updated = await this.prisma.affiliateServiceRequest.update({
      where: { id: requestId },
      data: {
        estimatedCost: dto.estimatedCost,
        currency: dto.currency ?? request.currency,
        status:
          request.status === AffiliateServiceRequestStatus.CLARIFICATION_REQUIRED
            ? AffiliateServiceRequestStatus.SUBMITTED
            : request.status,
      },
    });
    await this.notificationForBusiness(request.businessId, request.requestedByUserId, {
      title: 'Quote ready for your approval',
      message: `"${request.title}": ${updated.currency} ${updated.estimatedCost}. Approve the quote before chargeable work begins.`,
      data: { requestId, type: 'service_quote' },
    });
    return updated;
  }

  /** Account Manager asks the business for missing information. */
  async clarifyServiceRequest(
    actorUserId: string,
    requestId: string,
    note: string,
    opts: { asAdmin?: boolean } = {},
  ) {
    const request = await this.prisma.affiliateServiceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Service request not found');
    if (!opts.asAdmin) this.assertManager(request.accountManagerId, actorUserId);

    const updated = await this.prisma.affiliateServiceRequest.update({
      where: { id: requestId },
      data: {
        status: AffiliateServiceRequestStatus.CLARIFICATION_REQUIRED,
        clarificationNote: note,
      },
    });
    await this.notificationForBusiness(request.businessId, request.requestedByUserId, {
      title: 'More information needed',
      message: note,
      data: { requestId, type: 'service_request' },
    });
    return updated;
  }

  /** Convert a clarified request into a project (service plan). */
  async convertServiceRequestToProject(
    actorUserId: string,
    requestId: string,
    dto: CreateAffiliateProjectDto,
    opts: { asAdmin?: boolean } = {},
  ) {
    const request = await this.prisma.affiliateServiceRequest.findUnique({
      where: { id: requestId },
      include: { project: true },
    });
    if (!request) throw new NotFoundException('Service request not found');
    if (!opts.asAdmin) this.assertManager(request.accountManagerId, actorUserId);
    if (request.project) throw new ConflictException('This request already has a project');

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.affiliateProject.create({
        data: {
          businessId: request.businessId,
          serviceRequestId: request.id,
          accountManagerId: request.accountManagerId,
          createdByUserId: actorUserId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          objective: dto.objective?.trim() || request.desiredOutcome || null,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          requiresBusinessApproval: dto.requiresBusinessApproval ?? false,
        },
      });
      await tx.affiliateServiceRequest.update({
        where: { id: request.id },
        data: { status: AffiliateServiceRequestStatus.CONVERTED, approvedAt: new Date() },
      });
      return created;
    });

    await this.notificationForBusiness(request.businessId, request.requestedByUserId, {
      title: 'Your service plan is ready',
      message: `"${project.title}" has been created from your request. Tasks will be added as work is scoped.`,
      data: { projectId: project.id, requestId: request.id, type: 'service_project' },
    });
    return project;
  }

  async listProjects(businessId: string, query: AffiliateTaskQueryDto) {
    const where: Prisma.AffiliateProjectWhereInput = { businessId };
    if (query.status) where.status = query.status as AffiliateProjectStatus;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.prisma.affiliateProject.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          serviceRequest: true,
          accountManager: { select: { id: true, email: true, firstName: true, lastName: true } },
          tasks: {
            orderBy: { createdAt: 'desc' },
            include: {
              assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
            },
          },
        },
      }),
      this.prisma.affiliateProject.count({ where }),
    ]);
    return { success: true, data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getProject(businessId: string, id: string) {
    const project = await this.prisma.affiliateProject.findFirst({
      where: { id, businessId },
      include: {
        serviceRequest: true,
        accountManager: { select: { id: true, email: true, firstName: true, lastName: true } },
        tasks: {
          orderBy: { createdAt: 'asc' },
          include: {
            assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
            reviews: { orderBy: { createdAt: 'desc' } },
            events: { orderBy: { createdAt: 'desc' }, take: 30 },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async createProject(userId: string, businessId: string | null, dto: CreateAffiliateProjectDto) {
    const business = await this.directory.getBusiness(userId, businessId);
    let serviceRequestId = dto.serviceRequestId ?? null;
    if (serviceRequestId) {
      const request = await this.prisma.affiliateServiceRequest.findFirst({
        where: { id: serviceRequestId, businessId: business.id },
      });
      if (!request) throw new NotFoundException('Service request not found');
    }
    return this.prisma.affiliateProject.create({
      data: {
        businessId: business.id,
        serviceRequestId,
        accountManagerId: business.accountManagerId,
        createdByUserId: userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        objective: dto.objective?.trim() || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        requiresBusinessApproval: dto.requiresBusinessApproval ?? false,
      },
    });
  }

  /** Account Manager / business closes the loop on a project. */
  async closeProject(
    actorUserId: string,
    businessId: string,
    projectId: string,
    dto: CloseAffiliateProjectDto,
    opts: { asAdmin?: boolean } = {},
  ) {
    const project = await this.prisma.affiliateProject.findFirst({
      where: { id: projectId, businessId },
      include: { tasks: { select: { id: true, status: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!opts.asAdmin) {
      const business = await this.prisma.businessProfile.findUnique({ where: { id: businessId } });
      if (business?.accountManagerId !== actorUserId) {
        // The business owner may also close their own project.
        const profile = await this.prisma.businessProfile.findUnique({
          where: { id: businessId },
          select: { userId: true },
        });
        if (profile?.userId !== actorUserId) {
          throw new ForbiddenException('Only the account manager or business owner can close this project');
        }
      }
    }

    const openTasks = project.tasks.filter(
      (task) =>
        task.status !== AffiliateTaskStatus.COMPLETED &&
        task.status !== AffiliateTaskStatus.CANCELLED,
    );
    const updated = await this.prisma.affiliateProject.update({
      where: { id: project.id },
      data: {
        status: AffiliateProjectStatus.COMPLETED,
        closedAt: new Date(),
        outcomeSummary: dto.outcomeSummary,
        followUpRequired: dto.followUpRequired ?? false,
        followUpNotes: dto.followUpNotes ?? null,
      },
    });

    if (project.serviceRequestId) {
      await this.prisma.affiliateServiceRequest.update({
        where: { id: project.serviceRequestId },
        data: {
          status: AffiliateServiceRequestStatus.COMPLETED,
          closedAt: new Date(),
          followUpNotes: dto.followUpNotes ?? null,
        },
      });
    }

    return { project: updated, openTasks: openTasks.length };
  }

  // ─────────────────────── Admin overview ─────────────────────────────────

  async listAllServiceRequests(query: AffiliateTaskQueryDto) {
    const where: Prisma.AffiliateServiceRequestWhereInput = {};
    if (query.status) where.status = query.status as AffiliateServiceRequestStatus;
    if (query.businessId) where.businessId = query.businessId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { business: { businessName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return this.paginateRequests(where, query);
  }

  async listAllProjects(query: AffiliateTaskQueryDto) {
    const where: Prisma.AffiliateProjectWhereInput = {};
    if (query.status) where.status = query.status as AffiliateProjectStatus;
    if (query.businessId) where.businessId = query.businessId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { business: { businessName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.prisma.affiliateProject.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { id: true, businessName: true } },
          accountManager: { select: { id: true, email: true, firstName: true, lastName: true } },
          serviceRequest: true,
          tasks: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.affiliateProject.count({ where }),
    ]);
    return { success: true, data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async convertRequestAsAdmin(
    adminId: string,
    requestId: string,
    dto: CreateAffiliateProjectDto,
  ) {
    return this.convertServiceRequestToProject(adminId, requestId, dto, { asAdmin: true });
  }

  async clarifyRequestAsAdmin(adminId: string, requestId: string, note: string) {
    return this.clarifyServiceRequest(adminId, requestId, note, { asAdmin: true });
  }

  async quoteRequestAsAdmin(
    adminId: string,
    requestId: string,
    dto: ApproveServiceRequestDto,
  ) {
    return this.quoteServiceRequest(adminId, requestId, dto, { asAdmin: true });
  }

  async closeProjectAsAdmin(adminId: string, projectId: string, dto: CloseAffiliateProjectDto) {
    const project = await this.prisma.affiliateProject.findUnique({
      where: { id: projectId },
      select: { businessId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.closeProject(adminId, project.businessId, projectId, dto, { asAdmin: true });
  }

  // ─────────────────────── Review & approval workflow ─────────────────────

  /** Account Manager checks the submission before forwarding to the business. */
  async reviewTaskAsAccountManager(taskId: string, dto: ReviewAffiliateTaskDto, managerId: string) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: { business: { select: { id: true, accountManagerId: true, userId: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.business.accountManagerId !== managerId) {
      throw new ForbiddenException('You are not the account manager for this business');
    }
    if (task.status !== AffiliateTaskStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted tasks can be reviewed');
    }

    const round = task.revisionCount + 1;
    if (dto.decision === AffiliateReviewDecision.CHANGES_REQUESTED) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.affiliateTask.update({
          where: { id: taskId },
          data: {
            status: AffiliateTaskStatus.REVISION_REQUESTED,
            revisionCount: { increment: 1 },
            amReviewedAt: new Date(),
            amReviewedByUserId: managerId,
            amReviewNotes: dto.notes ?? null,
          },
        });
        await tx.affiliateTaskReview.create({
          data: {
            taskId,
            round,
            decision: dto.decision,
            notes: dto.notes ?? null,
            reviewerId: managerId,
            stage: 'ACCOUNT_MANAGER',
          },
        });
        return next;
      });
      await this.recordEvent(taskId, {
        actorUserId: managerId,
        actorRole: 'ACCOUNT_MANAGER',
        type: 'AM_CHANGES_REQUESTED',
        message: dto.notes ?? 'Account Manager requested changes',
      });
      await this.enqueueAffiliateJob('push-review', taskId);
      return this.getTaskForAdmin(taskId);
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const next = await tx.affiliateTask.update({
        where: { id: taskId },
        data: {
          status: task.requiresBusinessApproval
            ? AffiliateTaskStatus.PENDING_BUSINESS_APPROVAL
            : AffiliateTaskStatus.COMPLETED,
          amReviewedAt: new Date(),
          amReviewedByUserId: managerId,
          amReviewNotes: dto.notes ?? null,
          completedAt: task.requiresBusinessApproval ? null : new Date(),
        },
      });
      await tx.affiliateTaskReview.create({
        data: {
          taskId,
          round,
          decision: AffiliateReviewDecision.APPROVED,
          notes: dto.notes ?? null,
          reviewerId: managerId,
          stage: 'ACCOUNT_MANAGER',
        },
      });
      return next;
    });

    await this.recordEvent(taskId, {
      actorUserId: managerId,
      actorRole: 'ACCOUNT_MANAGER',
      type: 'AM_APPROVED',
      message: dto.notes ?? 'Account Manager approved the submission',
      metadata: { requiresBusinessApproval: task.requiresBusinessApproval },
    });

    if (task.requiresBusinessApproval) {
      await this.notificationForBusiness(task.business.id, task.business.userId, {
        title: 'Your approval is needed',
        message: `"${task.title}" has been checked by your account manager and is ready for your approval.`,
        data: { taskId, type: 'task_approval' },
      });
      await this.syncStatusToAffiliate(approved);
      return this.getTaskForAdmin(taskId);
    }

    await this.finaliseTaskApproval(taskId, {
      actorUserId: managerId,
      actorRole: 'ACCOUNT_MANAGER',
      notes: dto.notes,
    });
    return this.getTaskForAdmin(taskId);
  }

  /** The business owner accepts the delivered outcome. */
  async reviewTaskAsBusiness(
    userId: string,
    businessId: string | null,
    taskId: string,
    dto: ReviewBusinessTaskDto,
  ) {
    const business = await this.directory.getBusiness(userId, businessId);
    const task = await this.prisma.affiliateTask.findFirst({
      where: { id: taskId, businessId: business.id },
    });
    if (!task) throw new NotFoundException('Task not found');

    const canReview =
      task.status === AffiliateTaskStatus.PENDING_BUSINESS_APPROVAL ||
      (task.status === AffiliateTaskStatus.SUBMITTED && !business.accountManagerId);
    if (!canReview) {
      throw new BadRequestException('This task is not awaiting business approval');
    }

    const round = task.revisionCount + 1;
    if (dto.decision === AffiliateReviewDecision.CHANGES_REQUESTED) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.affiliateTask.update({
          where: { id: taskId },
          data: {
            status: AffiliateTaskStatus.REVISION_REQUESTED,
            revisionCount: { increment: 1 },
            businessApprovalNotes: dto.notes ?? dto.acceptanceNotes ?? null,
          },
        });
        await tx.affiliateTaskReview.create({
          data: {
            taskId,
            round,
            decision: dto.decision,
            notes: dto.notes ?? null,
            reviewerId: userId,
            stage: 'BUSINESS',
          },
        });
        return next;
      });
      await this.recordEvent(taskId, {
        actorUserId: userId,
        actorRole: 'BUSINESS',
        type: 'BUSINESS_CHANGES_REQUESTED',
        message: dto.notes ?? 'Business requested changes',
      });
      await this.enqueueAffiliateJob('push-review', taskId);
      return this.getTaskForAdmin(taskId);
    }

    await this.prisma.affiliateTask.update({
      where: { id: taskId },
      data: {
        businessApprovedAt: new Date(),
        businessApprovedByUserId: userId,
        businessApprovalNotes: dto.notes ?? dto.acceptanceNotes ?? null,
      },
    });
    await this.recordEvent(taskId, {
      actorUserId: userId,
      actorRole: 'BUSINESS',
      type: 'BUSINESS_APPROVED',
      message: dto.notes ?? 'Business approved the delivered outcome',
    });
    await this.finaliseTaskApproval(taskId, {
      actorUserId: userId,
      actorRole: 'BUSINESS',
      notes: dto.notes ?? dto.acceptanceNotes,
    });
    return this.getTaskForAdmin(taskId);
  }

  /** Business accepts or declines the separate charge for a task. */
  async reviewBusinessCharge(
    userId: string,
    businessId: string | null,
    taskId: string,
    dto: ApproveBusinessChargeDto,
  ) {
    const business = await this.directory.getBusiness(userId, businessId);
    const task = await this.prisma.affiliateTask.findFirst({
      where: { id: taskId, businessId: business.id },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.billableToBusiness || task.businessChargeAmount == null) {
      throw new BadRequestException('This task has no business charge to approve');
    }
    if (task.businessChargeStatus !== AffiliateChargeStatus.PENDING_APPROVAL) {
      throw new BadRequestException('This charge has already been decided');
    }

    if (dto.decision === 'DECLINED') {
      const cancelled = await this.prisma.affiliateTask.update({
        where: { id: taskId },
        data: {
          businessChargeStatus: AffiliateChargeStatus.DECLINED,
          status: AffiliateTaskStatus.CANCELLED,
          businessApprovalNotes: dto.notes ?? 'Business declined the charge',
        },
      });
      await this.settlement.releaseTaskHold(taskId, 'Business declined the task charge');
      await this.recordEvent(taskId, {
        actorUserId: userId,
        actorRole: 'BUSINESS',
        type: 'CHARGE_DECLINED',
        message: dto.notes ?? 'Business declined the charge; task cancelled',
      });
      await this.syncStatusToAffiliate(cancelled);
      return this.getTaskForAdmin(taskId);
    }

    const updated = await this.prisma.affiliateTask.update({
      where: { id: taskId },
      data: {
        businessChargeStatus: AffiliateChargeStatus.APPROVED,
        businessChargeApprovedAt: new Date(),
        businessChargeApprovedByUserId: userId,
      },
    });
    await this.recordEvent(taskId, {
      actorUserId: userId,
      actorRole: 'BUSINESS',
      type: 'CHARGE_APPROVED',
      message: dto.notes ?? 'Business approved the charge',
      metadata: { amount: task.businessChargeAmount, currency: task.businessChargeCurrency },
    });
    // Re-sync so the affiliate can now accept the work.
    await this.enqueueAffiliateJob('delegate-task', taskId);
    return this.getTaskForAdmin(taskId);
  }

  async reviewBusinessChargeAsAdmin(
    adminId: string,
    taskId: string,
    dto: ApproveBusinessChargeDto,
  ) {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.billableToBusiness || task.businessChargeAmount == null) {
      throw new BadRequestException('This task has no business charge to approve');
    }

    if (dto.decision === 'DECLINED') {
      const cancelled = await this.prisma.affiliateTask.update({
        where: { id: taskId },
        data: {
          businessChargeStatus: AffiliateChargeStatus.DECLINED,
          status: AffiliateTaskStatus.CANCELLED,
        },
      });
      await this.settlement.releaseTaskHold(taskId, 'Administrator declined the task charge');
      await this.recordEvent(taskId, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        type: 'CHARGE_DECLINED',
        message: dto.notes ?? 'Administrator declined the charge; task cancelled',
      });
      await this.syncStatusToAffiliate(cancelled);
      return this.getTaskForAdmin(taskId);
    }

    const updated = await this.prisma.affiliateTask.update({
      where: { id: taskId },
      data: {
        businessChargeStatus: AffiliateChargeStatus.APPROVED,
        businessChargeApprovedAt: new Date(),
        businessChargeApprovedByUserId: adminId,
      },
    });
    await this.recordEvent(taskId, {
      actorUserId: adminId,
      actorRole: 'ADMIN',
      type: 'CHARGE_APPROVED',
      message: dto.notes ?? 'Administrator approved the charge',
    });
    await this.enqueueAffiliateJob('delegate-task', taskId);
    return this.getTaskForAdmin(updated.id);
  }

  /** Shared terminal approval: reputation, payment and dependent tasks. */
  private async finaliseTaskApproval(
    taskId: string,
    input: { actorUserId: string; actorRole: string; notes?: string | null },
  ): Promise<void> {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: { select: { id: true, businessName: true, userId: true, email: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!task) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.affiliateTask.update({
        where: { id: taskId },
        data: {
          status: AffiliateTaskStatus.COMPLETED,
          completedAt: new Date(),
          reputationApplied: true,
          businessChargeStatus:
            task.billableToBusiness && task.businessChargeAmount != null
              ? AffiliateChargeStatus.CHARGED
              : task.businessChargeStatus,
        },
      });
      if (task.assigneeId && !task.reputationApplied) {
        await this.reputation.recordTaskCompleted(task.assigneeId, taskId, tx);
      }
    });

    await this.recordEvent(taskId, {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      type: 'TASK_COMPLETED',
      message: input.notes ?? 'Task approved and completed',
    });

    // A programme task pushed to an affiliate is complete as soon as the
    // delegated work passes the review chain. Apply the same reward/coupon and
    // programme-progress side effects as the business-facing completion path.
    if (task.sourceAssignmentId) {
      try {
        await this.programmeTasks.completeDelegatedAssignment(task.sourceAssignmentId, {
          submissionData: task.submissionData ?? {},
          notes: `Completed from approved delegated task "${task.title}"`,
        });
        await this.recordEvent(taskId, {
          type: 'PROGRAMME_TASK_COMPLETED',
          message: 'Source programme task marked completed',
          metadata: { assignmentId: task.sourceAssignmentId },
        });
      } catch (error: any) {
        this.logger.warn(
          `Could not complete source programme assignment ${task.sourceAssignmentId}: ${error?.message}`,
        );
        await this.recordEvent(taskId, {
          type: 'PROGRAMME_TASK_SYNC_FAILED',
          message: `Programme task could not be completed automatically: ${error?.message ?? 'unknown error'}`,
          metadata: { assignmentId: task.sourceAssignmentId },
        });
      }
    }

    // Capture the business escrow and pay the affiliate into their central
    // MCOM wallet. A failure here never rolls back the approval; the settlement
    // row is marked FAILED and retried by the reconciliation cron.
    try {
      await this.settlement.settleTask(taskId);
    } catch (error: any) {
      this.logger.error(`Settlement failed for approved task ${taskId}: ${error?.message}`);
      await this.recordEvent(taskId, {
        type: 'PAYMENT_FAILED',
        message: `Payment could not be settled automatically: ${error?.message ?? 'unknown error'}`,
      });
    }

    // Internal implementation tasks waiting on this one can now start.
    await this.delegateDependentTasks(taskId);

    await this.enqueueAffiliateJob('push-review', taskId);
  }

  private async delegateIfPrerequisiteComplete(taskId: string): Promise<void> {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: { prerequisiteTask: { select: { status: true, title: true } } },
    });
    if (!task) return;
    if (task.prerequisiteTask && task.prerequisiteTask.status !== AffiliateTaskStatus.COMPLETED) {
      await this.recordEvent(taskId, {
        type: 'WAITING_FOR_PREREQUISITE',
        message: `Waiting for "${task.prerequisiteTask.title}" to be completed before delegation`,
      });
      return;
    }
    await this.enqueueAffiliateJob('delegate-task', taskId);
  }

  private async delegateDependentTasks(prerequisiteTaskId: string): Promise<void> {
    const dependents = await this.prisma.affiliateTask.findMany({
      where: {
        prerequisiteTaskId,
        status: {
          in: [
            AffiliateTaskStatus.PENDING_ASSIGNMENT,
            AffiliateTaskStatus.ASSIGNED,
            AffiliateTaskStatus.ACCEPTED,
          ],
        },
      },
      select: { id: true },
    });
    for (const dependent of dependents) {
      await this.enqueueAffiliateJob('delegate-task', dependent.id);
    }
  }

  private async syncStatusToAffiliate(task: {
    id: string;
    status: AffiliateTaskStatus;
  }): Promise<void> {
    try {
      await this.affiliateClient.pushStatus(task.id, task.status);
    } catch (error: any) {
      this.logger.warn(`Status sync failed for task ${task.id}: ${error?.message}`);
    }
  }

  private assertManager(actualManagerId: string | null, actorUserId: string) {
    if (!actualManagerId || actualManagerId !== actorUserId) {
      throw new ForbiddenException('You are not the account manager for this request');
    }
  }

  private async recordEvent(
    taskId: string,
    event: {
      actorUserId?: string;
      actorRole?: string;
      type: string;
      message?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    try {
      await this.prisma.affiliateTaskEvent.create({
        data: {
          taskId,
          actorUserId: event.actorUserId ?? null,
          actorRole: event.actorRole ?? null,
          type: event.type,
          message: event.message ?? null,
          metadata: event.metadata,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Could not record task event ${event.type}: ${error?.message}`);
    }
  }

  private async notificationForBusiness(
    businessId: string,
    userId: string,
    input: { title: string; message: string; data?: Prisma.InputJsonValue },
  ) {
    await this.prisma.notification
      .create({
        data: {
          businessId,
          userId,
          type: 'affiliate_task',
          title: input.title,
          message: input.message,
          data: input.data,
        },
      })
      .catch((error) => this.logger.warn(`Business notification failed: ${error?.message}`));
  }

  private async notifyBusinessOfChargeApproval(taskId: string) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: { business: { select: { id: true, userId: true } } },
    });
    if (!task) return;
    await this.notificationForBusiness(task.business.id, task.business.userId, {
      title: 'Approval needed for chargeable work',
      message: `"${task.title}" has a charge of ${task.businessChargeAmount} ${task.businessChargeCurrency}. Approve it before the affiliate starts.`,
      data: { taskId, type: 'charge_approval' },
    });
  }

  private async notifyBusinessOfFundingRequired(taskId: string, requiredCredits: number) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: { business: { select: { id: true, userId: true } } },
    });
    if (!task) return;
    const amount = Math.max(0, Number(requiredCredits || 0));
    await this.notificationForBusiness(task.business.id, task.business.userId, {
      title: 'Fund your wallet to start delegated work',
      message:
        `"${task.title}" is assigned, but the funds could not be locked. ` +
        `Add at least ${amount.toFixed(2)} MCOM to your wallet, then lock the funds so the affiliate can start.`,
      data: { taskId, type: 'task_funding_required', requiredCredits: amount },
    });
  }

  private async notifyManagerOfRequest(requestId: string, managerId: string) {
    const request = await this.prisma.affiliateServiceRequest.findUnique({
      where: { id: requestId },
      include: { business: { select: { businessName: true } } },
    });
    if (!request) return;
    await this.prisma.notification
      .create({
        data: {
          userId: managerId,
          type: 'affiliate_task',
          title: 'New service request',
          message: `${request.business.businessName}: ${request.title}`,
          data: { requestId },
        },
      })
      .catch((error) => this.logger.warn(`Manager notification failed: ${error?.message}`));
  }

  private async notifyAdminsForServiceRequest(requestId: string) {
    const request = await this.prisma.affiliateServiceRequest.findUnique({
      where: { id: requestId },
      include: { business: { select: { businessName: true } } },
    });
    if (!request) return;
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, deletedAt: null },
      select: { id: true },
    });
    await Promise.allSettled(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'affiliate_task',
            title: 'Service request awaiting an account manager',
            message: `${request.business.businessName}: ${request.title}`,
            data: { requestId },
          },
        }),
      ),
    );
  }

  private async paginateRequests(
    where: Prisma.AffiliateServiceRequestWhereInput,
    query: AffiliateTaskQueryDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.prisma.affiliateServiceRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { id: true, businessName: true, email: true } },
          accountManager: { select: { id: true, email: true, firstName: true, lastName: true } },
          project: { select: { id: true, title: true, status: true } },
        },
      }),
      this.prisma.affiliateServiceRequest.count({ where }),
    ]);
    return { success: true, data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─────────────────────── Account Manager view ───────────────────────────

  async listTasksForManager(managerId: string, query: AffiliateTaskQueryDto) {
    const businesses = await this.prisma.businessProfile.findMany({
      where: { accountManagerId: managerId, deletedAt: null },
      select: { id: true },
    });
    const businessIds = businesses.map((business) => business.id);
    if (!businessIds.length) {
      return { success: true, data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
    const where: Prisma.AffiliateTaskWhereInput = { businessId: { in: businessIds } };
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { business: { businessName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return this.paginate(where, query);
  }

  async getTaskForManager(managerId: string, taskId: string) {
    const task = await this.loadTask(taskId);
    if (!task || task.business.accountManagerId !== managerId) {
      throw new NotFoundException('Task not found for your businesses');
    }
    return task;
  }

  async listRequestsForManager(managerId: string, query: AffiliateTaskQueryDto) {
    const where: Prisma.AffiliateServiceRequestWhereInput = { accountManagerId: managerId };
    if (query.status) where.status = query.status as AffiliateServiceRequestStatus;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.paginateRequests(where, query);
  }

  async listProjectsForManager(managerId: string, query: AffiliateTaskQueryDto) {
    const businesses = await this.prisma.businessProfile.findMany({
      where: { accountManagerId: managerId, deletedAt: null },
      select: { id: true },
    });
    const businessIds = businesses.map((business) => business.id);
    const where: Prisma.AffiliateProjectWhereInput = {
      accountManagerId: managerId,
      ...(businessIds.length ? { businessId: { in: businessIds } } : {}),
    };
    if (query.status) where.status = query.status as AffiliateProjectStatus;
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.prisma.affiliateProject.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { id: true, businessName: true } },
          serviceRequest: true,
          tasks: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.affiliateProject.count({ where }),
    ]);
    return { success: true, data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async closeProjectForManager(
    managerId: string,
    projectId: string,
    dto: CloseAffiliateProjectDto,
  ) {
    const project = await this.prisma.affiliateProject.findFirst({
      where: { id: projectId, accountManagerId: managerId },
      select: { businessId: true },
    });
    if (!project) throw new NotFoundException('Project not found for your businesses');
    return this.closeProject(managerId, project.businessId, projectId, dto);
  }

  async listBusinessTasks(businessId: string, query: AffiliateTaskQueryDto) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business profile not found');

    const where: Prisma.AffiliateTaskWhereInput = { businessId };
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.platform) where.platforms = { has: query.platform };
    if (query.category) where.category = query.category;
    if (query.projectId) where.projectId = query.projectId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.paginate(where, query);
  }

  async getBusinessTask(businessId: string, id: string) {
    return this.getTaskForBusiness(businessId, id);
  }

  /**
   * Retry the wallet reservation for an assigned task after the business has
   * topped up. Until this succeeds the affiliate sees the task but cannot
   * accept it because `paymentStatus` stays ON_HOLD.
   */
  async lockBusinessTaskFunds(userId: string, businessId: string | null, id: string) {
    const business = await this.directory.getBusiness(userId, businessId);
    const task = await this.prisma.affiliateTask.findFirst({
      where: { id, businessId: business.id },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (TERMINAL_STATUSES.includes(task.status)) {
      throw new BadRequestException('This task can no longer be funded');
    }
    if (!task.assigneeId) {
      throw new BadRequestException('Assign an affiliate before locking funds.');
    }

    try {
      await this.settlement.ensureForTask(id);
    } catch (error: any) {
      const escrowResponse =
        typeof error?.getResponse === 'function'
          ? error.getResponse()
          : error?.response;
      if (escrowResponse?.error === 'TASK_ESCROW_FAILED') {
        await this.prisma.affiliateTask.updateMany({
          where: { id },
          data: { paymentStatus: AffiliatePaymentStatus.ON_HOLD },
        });
        await this.recordEvent(id, {
          actorUserId: userId,
          actorRole: 'BUSINESS',
          type: 'TASK_FUNDS_STILL_REQUIRED',
          message:
            escrowResponse?.message ??
            error?.message ??
            'The wallet still cannot cover this task.',
        });
      }
      throw error;
    }

    const settlement = await this.settlement.getForTask(id);
    const payout = Number(settlement?.affiliatePayoutCredits?.toString() ?? 0);
    const updated = await this.prisma.affiliateTask.update({
      where: { id },
      data: {
        paymentStatus:
          payout > 0 ? AffiliatePaymentStatus.PENDING : AffiliatePaymentStatus.NOT_APPLICABLE,
        ...(task.billableToBusiness
          ? {
              businessChargeStatus: AffiliateChargeStatus.APPROVED,
              businessChargeApprovedAt: new Date(),
              businessChargeApprovedByUserId: userId,
            }
          : {}),
      },
    });

    await this.recordEvent(id, {
      actorUserId: userId,
      actorRole: 'BUSINESS',
      type: 'TASK_FUNDS_LOCKED',
      message: 'Business funds locked; the affiliate can now accept the task.',
      metadata: {
        settlementId: settlement?.id ?? null,
        businessChargeCredits: settlement?.businessChargeCredits?.toString() ?? null,
        affiliatePayoutCredits: settlement?.affiliatePayoutCredits?.toString() ?? null,
      },
    });

    // Mirror the unlocked state to 247GBS so the accept button becomes active.
    await this.enqueueAffiliateJob('delegate-task', id);
    return { ...(await this.getTaskForBusiness(business.id, id)), paymentStatus: updated.paymentStatus };
  }

  async cancelBusinessTask(businessId: string, id: string) {
    const task = await this.prisma.affiliateTask.findFirst({ where: { id, businessId } });
    if (!task) throw new NotFoundException('Task not found');
    if (TERMINAL_STATUSES.includes(task.status)) {
      throw new BadRequestException('This task can no longer be cancelled');
    }
    const updated = await this.prisma.affiliateTask.update({
      where: { id },
      data: { status: AffiliateTaskStatus.CANCELLED },
    });
    await this.settlement.releaseTaskHold(id, 'Task cancelled by business');
    if (task.assigneeId && task.status !== AffiliateTaskStatus.PENDING_ASSIGNMENT) {
      await this.reputation.recordTaskFailed(
        task.assigneeId,
        task.id,
        'Task cancelled by business',
      );
    }
    await this.recordEvent(id, {
      actorRole: 'BUSINESS',
      type: 'TASK_CANCELLED',
      message: 'Task cancelled by business',
    });
    await this.syncStatusToAffiliate(updated);
    return updated;
  }

  /**
   * Business owner reassigns a task an affiliate declined. Only declined tasks
   * can be reassigned, and the new affiliate must be a verified directory
   * member. Pricing/compensation are preserved unless the caller overrides them.
   */
  async reassignBusinessTask(
    businessId: string,
    taskId: string,
    dto: AssignAffiliateTaskDto,
    actorId: string,
  ) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      select: { id: true, businessId: true, status: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.businessId !== businessId) {
      throw new ForbiddenException('This task does not belong to your business');
    }
    if (task.status !== AffiliateTaskStatus.DECLINED) {
      throw new BadRequestException('Only a declined task can be reassigned');
    }
    return this.assignTask(taskId, dto, actorId, { asBusiness: true });
  }

  // ──────────────────────────── Admin actions ─────────────────────────────

  async listAllTasks(query: AffiliateTaskQueryDto) {
    const where: Prisma.AffiliateTaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.platform) where.platforms = { has: query.platform };
    if (query.category) where.category = query.category;
    if (query.projectId) where.projectId = query.projectId;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.unassigned === 'true') where.assigneeId = null;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { business: { businessName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return this.paginate(where, query);
  }

  async getTaskForAdmin(id: string) {
    const task = await this.loadTask(id);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async assignTask(
    taskId: string,
    dto: AssignAffiliateTaskDto,
    actorId: string,
    opts: { asAccountManager?: boolean; asBusiness?: boolean } = {},
  ) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: {
          select: {
            accountManagerId: true,
            membershipStatus: true,
            membershipPlanName: true,
            membershipExpiresAt: true,
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (CLOSED_STATUSES.includes(task.status)) {
      throw new BadRequestException('Task is already closed');
    }
    if (opts.asAccountManager && task.business.accountManagerId !== actorId) {
      throw new ForbiddenException('You are not the account manager for this business');
    }
    const assignee = await this.directory.assertAffiliateUser(dto.assigneeUserId);

    // Pricing can be agreed at assignment time. Keep business charges and
    // affiliate compensation separate and make the payable amount explicit
    // before work begins. Pence is authoritative when supplied.
    const compensationPence =
      dto.compensationPence !== undefined
        ? Number(dto.compensationPence)
        : dto.compensationAmount !== undefined
          ? Math.round(Number(dto.compensationAmount) * 100)
          : task.compensationPence;
    const compensationAmount =
      compensationPence != null ? compensationPence / 100 : task.compensationAmount;
    const compensationModel =
      dto.compensationModel ??
      (compensationAmount != null
        ? AffiliateCompensationModel.FIXED
        : task.compensationModel);

    // Preserve the original free/charged decision when reassigning. Only a task
    // that has never been evaluated consumes a fresh quota decision.
    let allowance: Awaited<ReturnType<AffiliateTaskQuotaService['resolve']>> | null = null;
    let freeDelegation = task.freeDelegation;
    if (freeDelegation == null) {
      allowance = await this.quota.resolve(task.businessId, { excludeTaskId: taskId });
      freeDelegation = allowance.source === 'NONE' ? false : allowance.isFree;
    }

    const quotaSource = allowance?.source ?? task.delegationQuotaSource;
    const quotaEnforced = quotaSource != null && quotaSource !== 'NONE';
    const requestedCharge =
      dto.businessChargeAmount !== undefined ? Number(dto.businessChargeAmount) : undefined;

    let billableToBusiness: boolean;
    let businessChargeAmount: number | null;
    let businessChargeStatus: AffiliateChargeStatus;

    if (quotaEnforced && freeDelegation) {
      // Within the plan allowance: the platform covers the affiliate payout and
      // the business wallet is not touched.
      billableToBusiness = false;
      businessChargeAmount = null;
      businessChargeStatus = AffiliateChargeStatus.NOT_APPLICABLE;
    } else if (quotaEnforced && !freeDelegation) {
      // Allowance exhausted: the task is chargeable. Refuse to assign without a
      // price rather than silently giving away paid work.
      const charge = requestedCharge ?? task.businessChargeAmount ?? compensationAmount ?? 0;
      if (!(charge > 0)) {
        throw new BadRequestException(
          'This business has used its free delegated tasks. Set a business charge before assigning.',
        );
      }
      billableToBusiness = true;
      businessChargeAmount = charge;
      businessChargeStatus = task.businessChargeApprovedAt
        ? AffiliateChargeStatus.APPROVED
        : AffiliateChargeStatus.PENDING_APPROVAL;
    } else {
      // Trial / no plan: keep the existing explicit billable rules.
      billableToBusiness = dto.billableToBusiness ?? task.billableToBusiness;
      businessChargeAmount =
        requestedCharge !== undefined
          ? requestedCharge
          : task.businessChargeAmount ??
            (billableToBusiness ? compensationAmount : null);
      businessChargeStatus =
        billableToBusiness && businessChargeAmount != null
          ? task.businessChargeApprovedAt
            ? AffiliateChargeStatus.APPROVED
            : AffiliateChargeStatus.PENDING_APPROVAL
          : task.businessChargeStatus;
    }

    let paymentStatus: AffiliatePaymentStatus =
      compensationAmount != null && compensationAmount > 0
        ? task.paymentStatus === AffiliatePaymentStatus.PAID
          ? AffiliatePaymentStatus.PAID
          : AffiliatePaymentStatus.PENDING
        : AffiliatePaymentStatus.NOT_APPLICABLE;

    // Reserve money before the task changes hands. If the wallet cannot cover
    // the charge we still assign the task; the affiliate can see it, but the
    // accept action stays blocked until the funds are locked.
    let escrowReady = true;
    try {
      await this.settlement.ensureForTask(taskId, {
        platformFeePercent: dto.platformFeePercent,
        compensationModel,
        compensationAmount: compensationAmount ?? null,
        compensationPence: compensationPence ?? null,
        billableToBusiness,
        businessChargeAmount: businessChargeAmount ?? null,
        freeDelegation,
        assigneeId: assignee.id,
        assigneeEmail: assignee.email,
      });
    } catch (error: any) {
      const escrowResponse =
        typeof error?.getResponse === 'function'
          ? error.getResponse()
          : error?.response;
      if (escrowResponse?.error !== 'TASK_ESCROW_FAILED') {
        throw error;
      }
      escrowReady = false;
      const reason =
        escrowResponse?.message ||
        error?.message ||
        'The business wallet could not reserve the task amount.';
      this.logger.warn(`Escrow not ready for task ${taskId}: ${reason}`);
    }

    if (escrowReady) {
      if (billableToBusiness && businessChargeAmount != null) {
        businessChargeStatus = AffiliateChargeStatus.APPROVED;
      }
    } else {
      paymentStatus = AffiliatePaymentStatus.ON_HOLD;
      if (billableToBusiness && businessChargeAmount != null) {
        businessChargeStatus = AffiliateChargeStatus.PENDING_APPROVAL;
      }
    }

    const updated = await this.prisma.affiliateTask.update({
      where: { id: taskId },
      data: {
        assigneeId: assignee.id,
        assigneeRole: assignee.role,
        assignedByAdminId: opts.asAccountManager || opts.asBusiness ? null : actorId,
        status: AffiliateTaskStatus.ASSIGNED,
        compensationModel,
        compensationAmount,
        compensationPence: compensationPence ?? null,
        compensationCurrency: dto.compensationCurrency ?? task.compensationCurrency,
        billableToBusiness,
        businessChargeAmount,
        businessChargeStatus,
        ...(escrowReady && billableToBusiness && businessChargeAmount != null
          ? {
              businessChargeApprovedAt: new Date(),
              businessChargeApprovedByUserId: actorId,
            }
          : {}),
        paymentStatus,
        freeDelegation,
        ...(allowance
          ? {
              delegationQuotaSource: allowance.source,
              delegationQuotaLimit: allowance.unlimited ? null : allowance.freeLimit,
              delegationQuotaUsed: allowance.used,
              delegationQuotaUnlimited: allowance.unlimited,
              delegationQuotaPeriodStart: allowance.periodStart,
            }
          : {}),
        ...(dto.requiresBusinessApproval !== undefined
          ? { requiresBusinessApproval: dto.requiresBusinessApproval }
          : {}),
        // A declined assignment returns to the pool for reassignment with a
        // clean review state.
        ...(task.status === AffiliateTaskStatus.DECLINED
          ? {
              declineReason: null,
              acceptedAt: null,
              amReviewedAt: null,
              amReviewedByUserId: null,
              amReviewNotes: null,
              businessApprovedAt: null,
              businessApprovedByUserId: null,
            }
          : {}),
      },
    });

    // Record the specialist/task relationship separately from acquisition and
    // account management so history survives reassignment. A history failure
    // must not block the assignment itself.
    try {
      await this.acquisition.recordAssignment({
        businessId: task.businessId,
        relationshipType: BusinessRelationshipType.TASK_ASSIGNMENT,
        affiliateUserId: assignee.id,
        actorUserId: actorId,
        newValue: taskId,
        metadata: {
          assigneeRole: assignee.role,
          taskTitle: task.title,
          reassigned: task.status === AffiliateTaskStatus.DECLINED,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record task assignment history for ${taskId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.recordEvent(taskId, {
      actorUserId: actorId,
      actorRole: opts.asAccountManager ? 'ACCOUNT_MANAGER' : opts.asBusiness ? 'BUSINESS' : 'ADMIN',
      type: task.status === AffiliateTaskStatus.DECLINED ? 'TASK_REASSIGNED' : 'TASK_ASSIGNED',
      message: `Assigned to ${assignee.email}`,
      metadata: {
        assigneeId: assignee.id,
        previousStatus: task.status,
        freeDelegation,
        delegationQuotaSource: quotaSource,
        billableToBusiness,
        businessChargeAmount,
        paymentStatus,
        escrowReady,
      },
    });

    if (!escrowReady) {
      const settlement = await this.settlement.getForTask(taskId);
      const requiredCredits = Number(
        settlement?.businessChargeCredits?.toString() ?? 0,
      );
      await this.recordEvent(taskId, {
        actorUserId: actorId,
        actorRole: opts.asAccountManager ? 'ACCOUNT_MANAGER' : opts.asBusiness ? 'BUSINESS' : 'ADMIN',
        type: 'TASK_FUNDS_REQUIRED',
        message: 'Affiliate assigned, but the business wallet funds are not locked yet.',
        metadata: {
          requiredCredits,
          businessChargeAmount,
          currency: task.businessChargeCurrency,
        },
      });
      await this.notifyBusinessOfFundingRequired(taskId, requiredCredits);
    }

    await this.delegateIfPrerequisiteComplete(taskId);
    return this.getTaskForAdmin(updated.id);
  }

  /**
   * Admin override review. Approves from either admin-queue state (SUBMITTED)
   * or after the Account Manager forwarded it (PENDING_BUSINESS_APPROVAL).
   * APPROVED closes the task and applies positive reputation and payment;
   * CHANGES_REQUESTED sends it back for another round.
   */
  async reviewTask(taskId: string, dto: ReviewAffiliateTaskDto, adminId: string) {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (
      task.status !== AffiliateTaskStatus.SUBMITTED &&
      task.status !== AffiliateTaskStatus.PENDING_BUSINESS_APPROVAL
    ) {
      throw new BadRequestException('Only submitted tasks can be reviewed');
    }
    if (!task.assigneeId) {
      throw new BadRequestException('Task has no assignee to review');
    }

    const round = task.revisionCount + 1;

    if (dto.decision === AffiliateReviewDecision.APPROVED) {
      const requestedPence =
        dto.compensationPence ??
        (dto.compensationAmount != null
          ? Math.round(Number(dto.compensationAmount) * 100)
          : null);
      const currentPence =
        task.compensationPence ??
        (task.compensationAmount != null
          ? Math.round(Number(task.compensationAmount) * 100)
          : null);
      const membershipFunded =
        task.freeDelegation === true ||
        task.compensationModel === AffiliateCompensationModel.MEMBERSHIP_INCLUDED ||
        task.delegationQuotaSource === 'MEMBERSHIP' ||
        task.delegationQuotaSource === 'ACCESS_PASS';

      if (requestedPence != null) {
        if (!Number.isInteger(requestedPence) || requestedPence <= 0) {
          throw new BadRequestException('Compensation must be a positive whole number of pence.');
        }
        const compensationAmount = requestedPence / 100;
        // Re-price the settlement first so a failed quote (e.g. pay exceeds the
        // business charge) leaves the task untouched.
        await this.settlement.ensureForTask(taskId, {
          compensationModel: AffiliateCompensationModel.FIXED,
          compensationAmount,
          compensationPence: requestedPence,
        });
        await this.prisma.affiliateTask.update({
          where: { id: taskId },
          data: {
            compensationModel: AffiliateCompensationModel.FIXED,
            compensationAmount,
            compensationPence: requestedPence,
            compensationCurrency: 'GBP',
            paymentStatus: AffiliatePaymentStatus.PENDING,
          },
        });
      } else if (membershipFunded && (currentPence == null || currentPence <= 0)) {
        throw new BadRequestException(
          'Enter the affiliate compensation before approving membership/access-pass funded work.',
        );
      }

      await this.prisma.affiliateTaskReview.create({
        data: {
          taskId,
          round,
          decision: dto.decision,
          notes: dto.notes ?? null,
          reviewerId: adminId,
          stage: 'ADMIN',
        },
      });
      await this.finaliseTaskApproval(taskId, {
        actorUserId: adminId,
        actorRole: 'ADMIN',
        notes: dto.notes,
      });
      return this.getTaskForAdmin(taskId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.affiliateTask.update({
        where: { id: taskId },
        data: {
          status: AffiliateTaskStatus.REVISION_REQUESTED,
          revisionCount: { increment: 1 },
        },
      });
      await tx.affiliateTaskReview.create({
        data: {
          taskId,
          round,
          decision: dto.decision,
          notes: dto.notes ?? null,
          reviewerId: adminId,
          stage: 'ADMIN',
        },
      });
      return next;
    });

    await this.recordEvent(taskId, {
      actorUserId: adminId,
      actorRole: 'ADMIN',
      type: 'ADMIN_CHANGES_REQUESTED',
      message: dto.notes ?? 'Administrator requested changes',
    });
    await this.enqueueAffiliateJob('push-review', taskId);
    return this.getTaskForAdmin(updated.id);
  }

  async cancelTaskAdmin(taskId: string, _adminId: string, penalise = true) {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (TERMINAL_STATUSES.includes(task.status)) {
      throw new BadRequestException('Task is already closed');
    }
    const updated = await this.prisma.affiliateTask.update({
      where: { id: taskId },
      data: { status: AffiliateTaskStatus.CANCELLED },
    });
    await this.settlement.releaseTaskHold(taskId, 'Task cancelled by administrator');
    if (penalise && task.assigneeId) {
      await this.reputation.recordTaskFailed(task.assigneeId, task.id, 'Task cancelled by admin');
    }
    await this.recordEvent(taskId, {
      actorUserId: _adminId,
      actorRole: 'ADMIN',
      type: 'TASK_CANCELLED',
      message: 'Task cancelled by administrator',
    });
    await this.syncStatusToAffiliate(updated);
    return updated;
  }

  // ─────────────────────────── Overdue sweep ──────────────────────────────
  /**
   * In-completion reduces reputation. Delegated tasks that pass their deadline
   * without a submission are marked DECLINED once and penalised exactly once.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleOverdueTasks(): Promise<number> {
    const now = new Date();
    const overdue = await this.prisma.affiliateTask.findMany({
      where: {
        dueAt: { lt: now },
        reputationApplied: false,
        status: {
          in: [
            AffiliateTaskStatus.ASSIGNED,
            AffiliateTaskStatus.ACCEPTED,
            AffiliateTaskStatus.IN_PROGRESS,
            AffiliateTaskStatus.REVISION_REQUESTED,
          ],
        },
      },
      select: { id: true, assigneeId: true },
      take: 500,
    });

    for (const task of overdue) {
      await this.prisma.affiliateTask.update({
        where: { id: task.id },
        data: { status: AffiliateTaskStatus.DECLINED, reputationApplied: true },
      });
      if (task.assigneeId) {
        await this.reputation.recordTaskFailed(
          task.assigneeId,
          task.id,
          'Task deadline passed without submission',
        );
      }
      try {
        await this.settlement.releaseTaskHold(
          task.id,
          'Task deadline passed; escrow released for re-assignment',
        );
      } catch (error: any) {
        this.logger.warn(`Could not release escrow for overdue task ${task.id}: ${error?.message}`);
      }
    }
    if (overdue.length) {
      this.logger.warn(`Marked ${overdue.length} overdue affiliate task(s) as declined`);
    }
    return overdue.length;
  }

  // ───────────────────── Callback from 247GBS Affiliates ──────────────────
  async handleAffiliateCallback(
    centralTaskId: string,
    payload: {
      status?: string;
      affiliateTaskId?: string | null;
      submissionData?: Record<string, unknown> | null;
      reviewAcknowledged?: boolean;
      declineReason?: string | null;
    },
  ) {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: centralTaskId } });
    if (!task) throw new NotFoundException('Task not found');

    if (payload.reviewAcknowledged) {
      // Affiliate has seen the requested changes and is working again.
      const acknowledged = await this.prisma.affiliateTask.update({
        where: { id: centralTaskId },
        data: {
          status: AffiliateTaskStatus.IN_PROGRESS,
          lastSyncAt: new Date(),
          reviews: {
            updateMany: {
              where: { acknowledgedAt: null },
              data: { acknowledgedAt: new Date() },
            },
          },
        },
      });
      await this.recordEvent(centralTaskId, {
        actorRole: 'AFFILIATE',
        type: 'REVIEW_ACKNOWLEDGED',
        message: 'Affiliate acknowledged the review notes and started revision',
      });
      return acknowledged;
    }

    const mapped = this.mapAffiliateStatus(payload.status);
    const data: Prisma.AffiliateTaskUpdateInput = {
      lastSyncAt: new Date(),
      lastSyncError: null,
    };
    if (mapped) data.status = mapped;
    if (mapped === AffiliateTaskStatus.ACCEPTED) data.acceptedAt = new Date();
    const declineReason = (payload.declineReason ?? '').trim();
    if (mapped === AffiliateTaskStatus.DECLINED) {
      data.declineReason = declineReason || 'No reason provided';
    }
    if (mapped === AffiliateTaskStatus.ACCEPTED || mapped === AffiliateTaskStatus.IN_PROGRESS) {
      // A new assignee accepted the work; the previous decline no longer applies.
      data.declineReason = null;
    }
    if (payload.affiliateTaskId) data.affiliateTaskId = payload.affiliateTaskId;
    if (payload.submissionData !== undefined) {
      data.submissionData = (payload.submissionData ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.affiliateTask.update({ where: { id: centralTaskId }, data });

    if (mapped === AffiliateTaskStatus.CANCELLED) {
      await this.settlement.releaseTaskHold(centralTaskId, 'Task cancelled from the affiliate workspace');
    }

    await this.recordEvent(centralTaskId, {
      actorRole: 'AFFILIATE',
      type: `AFFILIATE_${(mapped ?? 'UPDATED').toString()}`,
      message:
        mapped === AffiliateTaskStatus.DECLINED && declineReason
          ? `Affiliate declined the task: ${declineReason}`
          : `Affiliate reported status: ${payload.status ?? 'updated'}`,
      metadata: {
        ...(payload.submissionData ? { hasSubmission: true } : {}),
        ...(declineReason ? { declineReason } : {}),
      },
    });

    // Promote structured attachment metadata into first-class rows so admins
    // can see uploaded photos / documents in the review panel.
    const attachments = (payload.submissionData as any)?.attachments;
    if (Array.isArray(attachments)) {
      await this.prisma.affiliateTaskAttachment.deleteMany({ where: { taskId: centralTaskId } });
      const rows = attachments
        .filter((item) => item && typeof item.url === 'string' && item.url.length > 0)
        .slice(0, 50)
        .map((item) => ({
          taskId: centralTaskId,
          url: String(item.url),
          fileName: item.fileName ? String(item.fileName) : null,
          mimeType: item.mimeType ? String(item.mimeType) : null,
          kind: item.kind ? String(item.kind).toUpperCase() : 'OTHER',
        }));
      if (rows.length) {
        await this.prisma.affiliateTaskAttachment.createMany({ data: rows });
      }
    }

    return updated;
  }

  private mapAffiliateStatus(status?: string): AffiliateTaskStatus | null {
    if (!status) return null;
    const key = status.toLowerCase();
    switch (key) {
      case 'open':
        return null; // never re-open a delegated task
      case 'assigned':
        return AffiliateTaskStatus.ASSIGNED;
      case 'accepted':
        return AffiliateTaskStatus.ACCEPTED;
      case 'declined':
        return AffiliateTaskStatus.DECLINED;
      case 'in_progress':
        return AffiliateTaskStatus.IN_PROGRESS;
      case 'submitted':
      case 'completed':
      case 'approved':
        // Affiliate submission always stops here until the review chain confirms.
        return AffiliateTaskStatus.SUBMITTED;
      case 'pending_business_approval':
        return AffiliateTaskStatus.PENDING_BUSINESS_APPROVAL;
      case 'revision_requested':
        return AffiliateTaskStatus.REVISION_REQUESTED;
      case 'cancelled':
        return AffiliateTaskStatus.CANCELLED;
      default:
        return null;
    }
  }

  // ───────────────────────── Ratings & reports ────────────────────────────

  async rateAffiliate(userId: string, businessId: string | null, affiliateUserId: string, dto: RateAffiliateDto) {
    const business = await this.directory.getBusiness(userId, businessId);
    const affiliate = await this.directory.assertAffiliateUser(affiliateUserId);

    const existing = await this.prisma.affiliateRating.findUnique({
      where: {
        businessId_affiliateUserId: {
          businessId: business.id,
          affiliateUserId: affiliate.id,
        },
      },
    });

    const rating = await this.prisma.affiliateRating.upsert({
      where: {
        businessId_affiliateUserId: {
          businessId: business.id,
          affiliateUserId: affiliate.id,
        },
      },
      create: {
        businessId: business.id,
        affiliateUserId: affiliate.id,
        rating: dto.rating,
        comment: dto.comment ?? null,
        status: 'APPROVED',
        createdByUserId: userId,
        reviewedAt: new Date(),
      },
      update: {
        rating: dto.rating,
        comment: dto.comment ?? null,
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });

    // Apply the reputation delta only on first submission to prevent farming.
    if (!existing) {
      await this.reputation.recordRating(affiliate.id, dto.rating, rating.id);
    }

    return {
      rating,
      reputation: await this.reputation.getSummary(affiliate.id),
    };
  }

  async reportAffiliate(userId: string, businessId: string | null, affiliateUserId: string, dto: ReportAffiliateDto) {
    const business = await this.directory.getBusiness(userId, businessId);
    const affiliate = await this.directory.assertAffiliateUser(affiliateUserId);

    const report = await this.prisma.affiliateReport.create({
      data: {
        businessId: business.id,
        affiliateUserId: affiliate.id,
        reason: dto.reason.trim(),
        description: dto.description.trim(),
        status: AffiliateReportStatus.PENDING,
      },
    });

    await this.notifyAdminsOfReport(report.id);
    return report;
  }

  async listReports(query: AffiliateTaskQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.AffiliateReportWhereInput = {};
    if (query.status) where.status = query.status as AffiliateReportStatus;
    if (query.search) {
      where.OR = [
        { reason: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.affiliateReport.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { id: true, businessName: true, email: true } },
          affiliate: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.affiliateReport.count({ where }),
    ]);
    return { success: true, data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async reviewReport(reportId: string, dto: ReviewAffiliateReportDto, adminId: string) {
    const report = await this.prisma.affiliateReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== AffiliateReportStatus.PENDING) {
      throw new BadRequestException('Report has already been reviewed');
    }

    const valid = dto.decision === 'VALID';
    const updated = await this.prisma.affiliateReport.update({
      where: { id: reportId },
      data: {
        status: valid ? AffiliateReportStatus.VALID : AffiliateReportStatus.INVALID,
        adminNotes: dto.adminNotes ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reputationApplied: valid,
      },
    });

    if (valid) {
      await this.reputation.recordValidReport(report.affiliateUserId, report.id);
    }
    return updated;
  }

  async getAffiliateProfileForAdmin(affiliateUserId: string) {
    await this.directory.assertAffiliateUser(affiliateUserId);
    const summary = await this.reputation.getSummary(affiliateUserId);
    const [events, ratings, reports] = await Promise.all([
      this.prisma.affiliateReputationEvent.findMany({
        where: { affiliateUserId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.affiliateRating.findMany({
        where: { affiliateUserId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { business: { select: { businessName: true } } },
      }),
      this.prisma.affiliateReport.findMany({
        where: { affiliateUserId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { business: { select: { businessName: true } } },
      }),
    ]);
    return { ...summary, events, ratings, reports };
  }

  // ───────────────────────────── helpers ──────────────────────────────────

  private async paginate(where: Prisma.AffiliateTaskWhereInput, query: AffiliateTaskQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const [items, total] = await Promise.all([
      this.prisma.affiliateTask.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { id: true, businessName: true, email: true, userId: true } },
          assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          taskDefinition: { select: { id: true, title: true } },
          project: { select: { id: true, title: true, status: true } },
          prerequisiteTask: { select: { id: true, title: true, status: true } },
          reviews: { orderBy: { createdAt: 'desc' }, take: 3 },
          settlement: true,
          _count: { select: { attachments: true, events: true } },
        },
      }),
      this.prisma.affiliateTask.count({ where }),
    ]);
    return { success: true, data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async getTaskForBusiness(businessId: string, id: string) {
    const task = await this.prisma.affiliateTask.findFirst({
      where: { id, businessId },
      include: {
        business: { select: { id: true, businessName: true, email: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        taskDefinition: { select: { id: true, title: true } },
        project: { select: { id: true, title: true, status: true } },
        prerequisiteTask: { select: { id: true, title: true, status: true } },
        attachments: true,
        reviews: { orderBy: { createdAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
        settlement: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async loadTask(id: string) {
    return this.prisma.affiliateTask.findUnique({
      where: { id },
      include: {
        business: { select: { id: true, businessName: true, email: true, userId: true, accountManagerId: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        taskDefinition: { select: { id: true, title: true } },
        project: { select: { id: true, title: true, status: true } },
        prerequisiteTask: { select: { id: true, title: true, status: true } },
        attachments: true,
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { reviewer: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
        settlement: true,
      },
    });
  }

  private async syncToAffiliate(taskId: string): Promise<{ ok: boolean; error?: string }> {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: { select: { businessName: true, email: true } },
        assignee: { select: { email: true, firstName: true, lastName: true } },
        project: { select: { id: true, title: true } },
        prerequisiteTask: { select: { id: true, title: true, status: true } },
      },
    });
    if (!task || !task.assignee) return { ok: false, error: 'Task has no assignee' };

    const result = await this.affiliateClient.createTask(task);
    await this.prisma.affiliateTask.update({
      where: { id: taskId },
      data: result.ok
        ? { affiliateTaskId: result.affiliateTaskId ?? task.affiliateTaskId, lastSyncAt: new Date(), lastSyncError: null }
        : { lastSyncError: result.error ?? 'Unable to sync to affiliate system', lastSyncAt: new Date() },
    });
    return { ok: result.ok, error: result.error };
  }

  /**
   * Queue worker: mirror the task to 247GBS, email the assignee, and email the
   * business with the success/failure outcome.
   */
  async processDelegationJob(taskId: string): Promise<void> {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        assigneeId: true,
        status: true,
        prerequisiteTaskId: true,
        prerequisiteTask: { select: { status: true, title: true } },
      },
    });
    if (!task) return;
    if (CLOSED_STATUSES.includes(task.status)) return;
    if (
      task.prerequisiteTaskId &&
      task.prerequisiteTask &&
      task.prerequisiteTask.status !== AffiliateTaskStatus.COMPLETED
    ) {
      await this.recordEvent(taskId, {
        type: 'WAITING_FOR_PREREQUISITE',
        message: `Waiting for "${task.prerequisiteTask.title}" before delegation`,
      });
      await this.notifyBusinessOfDelegation(taskId, { awaitingAssignment: true });
      return;
    }

    if (!task.assigneeId) {
      await this.notifyAdminsForAssignment(taskId);
      await this.notifyBusinessOfDelegation(taskId, { awaitingAssignment: true });
      return;
    }

    const result = await this.syncToAffiliate(taskId);
    if (result.ok) {
      await this.notifyAssignee(taskId, 'assigned');
    } else {
      await this.notifyAdminsOfSyncFailure(taskId, result.error ?? 'Unknown error');
    }
    await this.notifyBusinessOfDelegation(taskId, {
      success: result.ok,
      error: result.error,
    });
  }

  /**
   * Queue worker: push the latest review outcome to 247GBS and notify the
   * assignee (and business on approval).
   */
  async processReviewJob(taskId: string): Promise<void> {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: taskId } });
    if (!task) return;

    const latestReview = await this.prisma.affiliateTaskReview.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latestReview) return;

    await this.affiliateClient.pushReview(task, {
      decision: latestReview.decision,
      notes: latestReview.notes,
      round: latestReview.round,
    });
    const approved = latestReview.decision === AffiliateReviewDecision.APPROVED;
    await this.notifyReviewOutcome(taskId, approved ? 'approved' : 'changes_requested');
    if (approved) await this.notifyBusinessOfCompletion(taskId);
  }

  private async notifyBusinessOfDelegation(
    taskId: string,
    outcome: { success?: boolean; error?: string; awaitingAssignment?: boolean },
  ) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: { select: { id: true, businessName: true, userId: true, email: true } },
        assignee: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!task) return;
    const managerName = task.assignee
      ? [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') || task.assignee.email
      : 'an affiliate';

    let title: string;
    let body: string;
    if (outcome.awaitingAssignment) {
      title = 'Task received — awaiting assignment';
      body = `We received "${task.title}". You do not have an account manager yet, so our team will assign an agent or consultant shortly.`;
    } else if (outcome.success) {
      title = 'Task delegated successfully';
      body = `"${task.title}" was delegated to ${managerName}. You can track progress in your dashboard.`;
    } else {
      title = 'Task delegation needs attention';
      body = `We could not deliver "${task.title}" to the affiliate system yet (${outcome.error ?? 'temporary error'}). Our team has been notified and it will be retried.`;
    }

    await Promise.allSettled([
      this.prisma.notification.create({
        data: {
          businessId: task.business.id,
          userId: task.business.userId,
          type: 'affiliate_task',
          title,
          message: body,
          data: { taskId },
        },
      }),
      this.mail.send({
        to: task.business.email,
        subject: `[Central Hub] ${title}: ${task.title}`,
        html: `<p>${body}</p><p><a href="${this.frontendUrl()}/dashboard/tasks">View delegated tasks</a></p>`,
      }).catch((error) => this.logger.warn(`Business delegation email failed: ${error?.message}`)),
    ]);
  }

  private async notifyAdminsOfSyncFailure(taskId: string, error: string) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, business: { select: { businessName: true } } },
    });
    if (!task) return;
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, deletedAt: null },
      select: { id: true, email: true },
    });
    await Promise.allSettled(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'affiliate_task',
            title: 'Affiliate delegation failed',
            message: `${task.business.businessName}: "${task.title}" could not be synced (${error}).`,
            data: { taskId },
          },
        }),
      ),
    );
  }

  private async notifyAssignee(taskId: string, kind: 'assigned' | 'review') {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: { select: { businessName: true, id: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!task?.assignee) return;
    const name = [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') || task.assignee.email;
    const link = `${this.frontendUrl()}/dashboard/tasks`;
    const title = kind === 'assigned' ? 'New task delegated to you' : 'Task review updated';

    await Promise.allSettled([
      this.prisma.notification.create({
        data: {
          userId: task.assignee.id,
          type: 'affiliate_task',
          title,
          message: `${task.business.businessName}: ${task.title}`,
          data: { taskId: task.id },
        },
      }),
      this.mail.send({
        to: task.assignee.email,
        subject: `[Central Hub] ${title}: ${task.title}`,
        html: `
          <p>Hi ${name},</p>
          <p>${task.business.businessName} has delegated a task to you on Central Hub.</p>
          <p><strong>${task.title}</strong></p>
          <p>${task.description}</p>
          <p>Platforms: ${task.platforms.length ? task.platforms.join(', ') : 'General support'}</p>
          <p><a href="${link}">Open your tasks</a></p>
        `,
      }).catch((error) => this.logger.warn(`Task assignment email failed: ${error?.message}`)),
    ]);
  }

  private async notifyReviewOutcome(taskId: string, outcome: 'approved' | 'changes_requested') {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: { select: { businessName: true, id: true, userId: true, email: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!task?.assignee) return;
    const latestReview = await this.prisma.affiliateTaskReview.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
    const approved = outcome === 'approved';
    const subject = approved
      ? `Task approved: ${task.title}`
      : `Changes requested: ${task.title}`;
    const body = approved
      ? `Good news — the administrator approved "${task.title}". Your reputation score has been updated.`
      : `The administrator requested changes on "${task.title}".${latestReview?.notes ? ` Notes: ${latestReview.notes}` : ''}`;

    await Promise.allSettled([
      this.prisma.notification.create({
        data: {
          userId: task.assignee.id,
          type: 'affiliate_task',
          title: subject,
          message: body,
          data: { taskId },
        },
      }),
      this.mail.send({
        to: task.assignee.email,
        subject: `[Central Hub] ${subject}`,
        html: `<p>${body}</p><p><a href="${this.frontendUrl()}/dashboard/tasks">Open tasks</a></p>`,
      }).catch((error) => this.logger.warn(`Review email failed: ${error?.message}`)),
    ]);
  }

  private async notifyBusinessOfCompletion(taskId: string) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: { select: { id: true, businessName: true, userId: true, email: true } },
        assignee: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!task) return;
    const managerName = task.assignee
      ? [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') || task.assignee.email
      : 'Your account manager';

    await Promise.allSettled([
      this.prisma.notification.create({
        data: {
          businessId: task.business.id,
          userId: task.business.userId,
          type: 'affiliate_task',
          title: 'Delegated task completed',
          message: `${managerName} completed "${task.title}".`,
          data: { taskId },
        },
      }),
      this.mail.send({
        to: task.business.email,
        subject: `[Central Hub] Task completed: ${task.title}`,
        html: `<p>${managerName} completed "${task.title}".</p><p><a href="${this.frontendUrl()}/dashboard/tasks">Review it in your dashboard</a></p>`,
      }).catch((error) => this.logger.warn(`Business completion email failed: ${error?.message}`)),
    ]);
  }

  private async notifyAdminsForAssignment(taskId: string) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: { business: { select: { businessName: true, id: true } } },
    });
    if (!task) return;
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, deletedAt: null },
      select: { id: true, email: true },
    });
    await Promise.allSettled(
      admins.flatMap((admin) => [
        this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'affiliate_task',
            title: 'Task awaiting assignment',
            message: `${task.business.businessName} created "${task.title}" and needs an affiliate assigned.`,
            data: { taskId },
          },
        }),
        this.mail.send({
          to: admin.email,
          subject: `[Central Hub] Task awaiting assignment: ${task.title}`,
          html: `<p>${task.business.businessName} created "${task.title}" but has no account manager. Assign an affiliate from the admin console.</p>`,
        }).catch((error) => this.logger.warn(`Admin assignment email failed: ${error?.message}`)),
      ]),
    );
  }

  private async notifyAdminsOfReport(reportId: string) {
    const report = await this.prisma.affiliateReport.findUnique({
      where: { id: reportId },
      include: {
        business: { select: { businessName: true } },
        affiliate: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!report) return;
    const admins = await this.prisma.user.findMany({
      where: { role: Role.ADMIN, deletedAt: null },
      select: { id: true, email: true },
    });
    const name =
      [report.affiliate.firstName, report.affiliate.lastName].filter(Boolean).join(' ') ||
      report.affiliate.email;
    await Promise.allSettled(
      admins.map((admin) =>
        this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'affiliate_report',
            title: 'New affiliate report',
            message: `${report.business.businessName} reported ${name}: ${report.reason}`,
            data: { reportId },
          },
        }),
      ),
    );
  }
}
