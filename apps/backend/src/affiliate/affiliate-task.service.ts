import { Injectable, Logger, NotFoundException, Optional, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AffiliateReportStatus,
  AffiliateReviewDecision,
  AffiliateTaskSource,
  AffiliateTaskStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { AffiliateDirectoryService } from './affiliate-directory.service';
import { AffiliateClientService } from './affiliate-client.service';
import { AffiliateReputationService } from './affiliate-reputation.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import { normalizePlatformKey } from './affiliate-affinity.util';
import { AFFILIATE_TASK_QUEUE, AffiliateTaskJobData } from '../queue/queue.constants';
import {
  AffiliateTaskQueryDto,
  AssignAffiliateTaskDto,
  CreateAffiliateTaskDto,
  RateAffiliateDto,
  ReportAffiliateDto,
  ReviewAffiliateReportDto,
  ReviewAffiliateTaskDto,
} from './dto/affiliate.dto';

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
    private readonly mail: MailService,
    private readonly config: ConfigService,
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

    const task = await this.prisma.affiliateTask.create({
      data: {
        businessId: business.id,
        createdByUserId: userId,
        source: taskDefinitionId ? AffiliateTaskSource.PROGRAMME : AffiliateTaskSource.MANUAL,
        taskDefinitionId,
        sourceAssignmentId: assignmentTaskId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        platforms: validatedPlatforms,
        status: assignee ? AffiliateTaskStatus.ASSIGNED : AffiliateTaskStatus.PENDING_ASSIGNMENT,
        assigneeId: assignee?.id ?? null,
        assigneeRole: assignee?.role ?? null,
        dueAt,
      },
      include: {
        business: { select: { id: true, businessName: true, email: true, userId: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        taskDefinition: { select: { id: true, title: true } },
      },
    });

    // Respond immediately — affiliate sync, emails and notifications run on the
    // queue so a slow/unreachable affiliate API never blocks the business.
    await this.enqueueAffiliateJob('delegate-task', task.id);

    // Keep the push-from-programme link explicit in the response envelope.
    return { ...(await this.getTaskForBusiness(business.id, task.id)), pushedFromAssignment: assignmentTaskId };
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
    if (task.assigneeId && task.status !== AffiliateTaskStatus.PENDING_ASSIGNMENT) {
      await this.reputation.recordTaskFailed(
        task.assigneeId,
        task.id,
        'Task cancelled by business',
      );
    }
    return updated;
  }

  // ──────────────────────────── Admin actions ─────────────────────────────

  async listAllTasks(query: AffiliateTaskQueryDto) {
    const where: Prisma.AffiliateTaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.platform) where.platforms = { has: query.platform };
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

  async assignTask(taskId: string, dto: AssignAffiliateTaskDto, adminId: string) {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (TERMINAL_STATUSES.includes(task.status)) {
      throw new BadRequestException('Task is already closed');
    }
    const assignee = await this.directory.assertAffiliateUser(dto.assigneeUserId);

    const updated = await this.prisma.affiliateTask.update({
      where: { id: taskId },
      data: {
        assigneeId: assignee.id,
        assigneeRole: assignee.role,
        assignedByAdminId: adminId,
        status: AffiliateTaskStatus.ASSIGNED,
      },
    });

    await this.enqueueAffiliateJob('delegate-task', taskId);
    return this.getTaskForAdmin(updated.id);
  }

  /**
   * Manual admin review. APPROVED closes the task and applies positive
   * reputation; CHANGES_REQUESTED sends it back for another round.
   */
  async reviewTask(taskId: string, dto: ReviewAffiliateTaskDto, adminId: string) {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== AffiliateTaskStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted tasks can be reviewed');
    }
    if (!task.assigneeId) {
      throw new BadRequestException('Task has no assignee to review');
    }

    const round = task.revisionCount + 1;

    if (dto.decision === AffiliateReviewDecision.APPROVED) {
      await this.prisma.$transaction(async (tx) => {
        await tx.affiliateTask.update({
          where: { id: taskId },
          data: {
            status: AffiliateTaskStatus.COMPLETED,
            completedAt: new Date(),
            reputationApplied: true,
          },
        });
        await tx.affiliateTaskReview.create({
          data: {
            taskId,
            round,
            decision: dto.decision,
            notes: dto.notes ?? null,
            reviewerId: adminId,
          },
        });
        await this.reputation.recordTaskCompleted(task.assigneeId!, taskId, tx);
      });

      await this.enqueueAffiliateJob('push-review', taskId);
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
        },
      });
      return next;
    });

    await this.enqueueAffiliateJob('push-review', taskId);
    return this.getTaskForAdmin(taskId);
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
    if (penalise && task.assigneeId) {
      await this.reputation.recordTaskFailed(task.assigneeId, task.id, 'Task cancelled by admin');
    }
    await this.affiliateClient.pushReview(updated, {
      decision: 'CHANGES_REQUESTED',
      notes: 'Task cancelled by administrator',
      round: task.revisionCount + 1,
    });
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
    },
  ) {
    const task = await this.prisma.affiliateTask.findUnique({ where: { id: centralTaskId } });
    if (!task) throw new NotFoundException('Task not found');

    if (payload.reviewAcknowledged) {
      // Affiliate has seen the admin's requested changes and is working again.
      return this.prisma.affiliateTask.update({
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
    }

    const mapped = this.mapAffiliateStatus(payload.status);
    const data: Prisma.AffiliateTaskUpdateInput = {
      lastSyncAt: new Date(),
      lastSyncError: null,
    };
    if (mapped) data.status = mapped;
    if (payload.affiliateTaskId) data.affiliateTaskId = payload.affiliateTaskId;
    if (payload.submissionData !== undefined) {
      data.submissionData = (payload.submissionData ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.affiliateTask.update({ where: { id: centralTaskId }, data });

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
        // Affiliate submission always stops here until admin confirms.
        return AffiliateTaskStatus.SUBMITTED;
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
          reviews: { orderBy: { createdAt: 'desc' }, take: 3 },
          _count: { select: { attachments: true } },
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
        attachments: true,
        reviews: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async loadTask(id: string) {
    return this.prisma.affiliateTask.findUnique({
      where: { id },
      include: {
        business: { select: { id: true, businessName: true, email: true, userId: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        taskDefinition: { select: { id: true, title: true } },
        attachments: true,
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { reviewer: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });
  }

  private async syncToAffiliate(taskId: string): Promise<{ ok: boolean; error?: string }> {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: { select: { businessName: true, email: true } },
        assignee: { select: { email: true, firstName: true, lastName: true } },
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
      select: { id: true, assigneeId: true },
    });
    if (!task) return;

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
