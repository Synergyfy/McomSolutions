import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignTaskDto,
  CreateTaskDefinitionDto,
  QueryAssignmentsDto,
  QueryProgrammeUsersDto,
  UpdateAssignmentStatusDto,
  UpdateTaskDefinitionDto,
} from './dto/task.dto';
import { CENTRAL_FEATURE_KEYS } from './task.constants';
import {
  TASK_COUPON_QUEUE,
  TASK_REWARD_QUEUE,
  TaskCouponJobData,
  TaskRewardJobData,
} from '../queue/queue.constants';
import {
  CouponDiscountType,
  Prisma,
  Role,
  TaskAccessScope,
  TaskAssignmentStatus,
  TaskAudience,
  TaskSource,
  TaskSubmissionType,
} from '@prisma/client';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue(TASK_REWARD_QUEUE)
    private readonly rewardQueue?: Queue<TaskRewardJobData>,
    @Optional() @InjectQueue(TASK_COUPON_QUEUE)
    private readonly couponQueue?: Queue<TaskCouponJobData>,
  ) {}

  // ─── Audit Logger ──────────────────────────────────────
  private async logAudit(
    action: string,
    targetType: string,
    targetName: string,
    details: string,
    adminName = 'System',
    category = 'Programme',
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { action, adminName, targetType, targetName, details, category },
      });
    } catch (err) {
      this.logger.warn(`Failed to log audit for ${action}:`, err as any);
    }
  }

  private async enqueueTaskCouponReward(assignmentId: string, task: { rewardCouponEnabled: boolean }) {
    if (!task.rewardCouponEnabled) return;
    if (!this.couponQueue) {
      this.logger.warn(
        `Task ${assignmentId} has a coupon reward but the coupon queue is unavailable`,
      );
      return;
    }
    await this.couponQueue.add(
      'issue-task-coupon',
      { assignmentId },
      {
        jobId: `task-coupon-${assignmentId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  // ─── Feature Keys Registry ────────────────────────────
  getFeatures() {
    return {
      success: true,
      data: CENTRAL_FEATURE_KEYS,
    };
  }

  // ─── Overview Stats ───────────────────────────────────
  async getOverviewStats() {
    const [
      totalTasks,
      activeTasks,
      totalAssignments,
      completedAssignments,
      expiredAssignments,
      pendingAssignments,
      rewardedAgg,
    ] = await Promise.all([
      this.prisma.taskDefinition.count(),
      this.prisma.taskDefinition.count({ where: { isActive: true } }),
      this.prisma.userTaskAssignment.count(),
      this.prisma.userTaskAssignment.count({ where: { status: TaskAssignmentStatus.COMPLETED } }),
      this.prisma.userTaskAssignment.count({ where: { status: TaskAssignmentStatus.EXPIRED } }),
      this.prisma.userTaskAssignment.count({
        where: { status: { in: [TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS] } },
      }),
      this.prisma.userTaskAssignment.aggregate({
        _sum: { rewardPoints: true },
        where: { rewardGranted: true },
      }),
    ]);

    return {
      success: true,
      data: {
        totalTasks,
        activeTasks,
        totalAssignments,
        completedAssignments,
        expiredAssignments,
        pendingAssignments,
        totalPointsAwarded: rewardedAgg._sum.rewardPoints ?? 0,
        completionRate:
          totalAssignments > 0
            ? Math.round((completedAssignments / totalAssignments) * 100)
            : 0,
      },
    };
  }

  // ─── Task Definitions CRUD ────────────────────────────
  async getTaskDefinitions() {
    const tasks = await this.prisma.taskDefinition.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: {
          select: {
            status: true,
            rewardGranted: true,
            rewardPoints: true,
          },
        },
        rewardCouponPlans: {
          include: { plan: { select: { id: true, name: true } } },
        },
        rewardCouponAccessPlans: {
          include: { accessPlan: { select: { id: true, name: true } } },
        },
        _count: { select: { issuedCoupons: true } },
      },
    });

    const formatted = tasks.map((task) => {
      const totalAssigned = task.assignments.length;
      const completed = task.assignments.filter((a) => a.status === TaskAssignmentStatus.COMPLETED).length;
      const pending = task.assignments.filter((a) =>
        a.status === TaskAssignmentStatus.PENDING || a.status === TaskAssignmentStatus.IN_PROGRESS,
      ).length;
      const expired = task.assignments.filter((a) => a.status === TaskAssignmentStatus.EXPIRED).length;
      const totalPointsRewarded = task.assignments
        .filter((a) => a.rewardGranted)
        .reduce((acc, a) => acc + a.rewardPoints, 0);

      const { assignments, _count, ...rest } = task;
      return {
        ...rest,
        rewardCouponPlans: (task.rewardCouponPlans ?? []).map((link) => ({
          id: link.plan.id,
          name: link.plan.name,
        })),
        rewardCouponAccessPlans: (task.rewardCouponAccessPlans ?? []).map((link) => ({
          id: link.accessPlan.id,
          name: link.accessPlan.name,
        })),
        issuedCouponCount: _count?.issuedCoupons ?? 0,
        stats: {
          totalAssigned,
          completed,
          pending,
          expired,
          totalPointsRewarded,
        },
      };
    });

    return { success: true, data: formatted };
  }

  async getTaskDefinition(id: string) {
    const task = await this.prisma.taskDefinition.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assignments: true, issuedCoupons: true },
        },
        rewardCouponPlans: {
          include: { plan: { select: { id: true, name: true } } },
        },
        rewardCouponAccessPlans: {
          include: { accessPlan: { select: { id: true, name: true } } },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return { success: true, data: task };
  }

  // ─── Task Source Helpers ──────────────────────────
  // Strip HTML tags from admin-supplied text (stored + rendered to users).
  private sanitizeText(value: string): string {
    return value.replace(/<[^>]*>/g, '').trim();
  }

  private getFeatureMeta(key: string) {
    return CENTRAL_FEATURE_KEYS.find((f) => f.key === key);
  }

  private isKnownFeatureKey(key: string): boolean {
    return this.getFeatureMeta(key) !== undefined;
  }

  // Audience capabilities: a platform trigger can only fire for the audience it
  // belongs to (or BOTH), and customers never resolve as trial users.
  private assertAudienceCapabilities(params: {
    targetAudience: TaskAudience;
    accessScope: TaskAccessScope;
    submissionType: TaskSubmissionType;
    taskSource: TaskSource;
    featureKey?: string | null;
  }): void {
    const { targetAudience, accessScope, submissionType, taskSource, featureKey } = params;

    if (targetAudience === TaskAudience.CUSTOMER && accessScope === TaskAccessScope.TRIAL) {
      throw new BadRequestException(
        'Customers never resolve as trial users — use "All customers" or "Members only" for customer tasks',
      );
    }

    if (taskSource !== TaskSource.INTERNAL || submissionType !== TaskSubmissionType.AUTO) return;

    const meta = featureKey ? this.getFeatureMeta(featureKey) : undefined;
    if (meta && meta.targetAudience !== targetAudience && meta.targetAudience !== 'BOTH') {
      throw new BadRequestException(
        `"${meta.label}" only applies to ${meta.targetAudience.toLowerCase()} users — pick a trigger that matches the task audience`,
      );
    }
  }

  // ─── Task reward coupon config ─────────────────────────
  private async assertRewardCouponPlans(planIds: string[]): Promise<void> {
    const unique = [...new Set(planIds)];
    if (unique.length === 0) {
      throw new BadRequestException('Select at least one membership plan for this reward coupon');
    }
    const count = await this.prisma.membershipPlan.count({
      where: { id: { in: unique }, deletedAt: null },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more selected reward coupon plans do not exist');
    }
  }

  private async assertRewardCouponAccessPlans(accessPlanIds: string[]): Promise<void> {
    const unique = [...new Set(accessPlanIds)];
    if (unique.length === 0) {
      throw new BadRequestException('Select at least one access plan for this reward coupon');
    }
    const count = await this.prisma.accessPlan.count({
      where: { id: { in: unique }, deletedAt: null },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more selected access plans do not exist');
    }
  }

  private async validateRewardCouponConfig(input: {
    enabled: boolean;
    discountType?: CouponDiscountType | null;
    value?: number | null;
    appliesToAll: boolean;
    planIds: string[];
    appliesToAllAccess: boolean;
    accessPlanIds: string[];
    validDays?: number | null;
    expiresAt?: Date | null;
  }): Promise<void> {
    if (!input.enabled) return;
    if (!input.discountType) {
      throw new BadRequestException('Choose a reward coupon discount type');
    }
    const value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Reward coupon discount must be greater than zero');
    }
    if (input.discountType === CouponDiscountType.PERCENTAGE && value >= 100) {
      throw new BadRequestException('Reward coupon percentage must be between 1% and 99%');
    }

    const hasMembershipScope = input.appliesToAll || input.planIds.length > 0;
    const hasAccessScope = input.appliesToAllAccess || input.accessPlanIds.length > 0;
    if (!hasMembershipScope && !hasAccessScope) {
      throw new BadRequestException(
        'Select at least one membership or access plan for this reward coupon',
      );
    }
    if (!input.appliesToAll && input.planIds.length > 0) {
      await this.assertRewardCouponPlans(input.planIds);
    }
    if (!input.appliesToAllAccess && input.accessPlanIds.length > 0) {
      await this.assertRewardCouponAccessPlans(input.accessPlanIds);
    }

    if (!input.validDays && !input.expiresAt) {
      throw new BadRequestException(
        'Set how many days the reward coupon is valid for, or an absolute expiry date',
      );
    }
    if (input.validDays !== undefined && input.validDays !== null && input.validDays < 1) {
      throw new BadRequestException('Reward coupon validity must be at least 1 day');
    }
    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw new BadRequestException('Reward coupon expiry must be in the future');
    }
  }

  // Normalise + validate the admin-supplied destination link for EXTERNAL_LINK
  // tasks. Returns null when no link is configured.
  private normalizeActionUrl(raw?: string | null): string | null {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) return null;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
      return url.toString();
    } catch {
      throw new BadRequestException('Enter a valid http(s) link for the task action URL');
    }
  }

  // Resolve + validate a console-registered app for EXTERNAL tasks.
  // Returns denormalized snapshot fields (no FK — tasks survive app deletion).
  private async resolveExternalApp(externalClientId: string) {
    const clientId = externalClientId.trim();
    if (!clientId) {
      throw new BadRequestException('External app clientId is required for external tasks');
    }
    const client = await this.prisma.ssoClient.findUnique({
      where: { clientId },
      select: { clientId: true, name: true, platformSlug: true, appUrl: true, isActive: true },
    });
    if (!client) {
      throw new NotFoundException(`External app "${clientId}" is not registered in the console`);
    }
    if (!client.isActive) {
      throw new BadRequestException(`External app "${client.name}" is deactivated in the console`);
    }
    return {
      externalClientId: client.clientId,
      externalAppName: client.name,
      externalPlatformSlug: client.platformSlug ?? client.clientId,
      externalAppUrl: client.appUrl ?? null,
      platform: client.platformSlug ?? client.clientId,
    };
  }

  async createTaskDefinition(dto: CreateTaskDefinitionDto, adminName = 'Admin') {
    const source = dto.taskSource ?? TaskSource.INTERNAL;
    // Proof-submission types only apply to MCOM Central tasks. External tasks
    // keep their existing manual-completion behaviour.
    const submissionType =
      source === TaskSource.EXTERNAL
        ? TaskSubmissionType.AUTO
        : dto.submissionType ?? TaskSubmissionType.AUTO;
    const title = this.sanitizeText(dto.title);
    const description = this.sanitizeText(dto.description);
    if (!title || !description) {
      throw new BadRequestException('Task title and description are required');
    }

    let featureKey: string | null = null;
    let actionUrl: string | null = null;
    let actionLabel: string | null = null;
    let external: {
      externalClientId: string;
      externalAppName: string;
      externalPlatformSlug: string;
      externalAppUrl: string | null;
      platform: string;
    } | null = null;
    let platform = dto.platform?.trim() || 'mcom_central';

    if (source === TaskSource.EXTERNAL) {
      if (dto.featureKey !== undefined && dto.featureKey !== null && String(dto.featureKey).trim() !== '') {
        throw new BadRequestException('External tasks do not use an event-worker trigger — omit the feature key');
      }
      if (!dto.externalClientId || !dto.externalClientId.trim()) {
        throw new BadRequestException('Select an external app registered in the console for external tasks');
      }
      external = await this.resolveExternalApp(dto.externalClientId);
      platform = external.platform;
    } else {
      if (dto.externalClientId !== undefined && dto.externalClientId !== null && String(dto.externalClientId).trim() !== '') {
        throw new BadRequestException('Internal tasks run on MCOM Central — omit the external app selection');
      }
      if (submissionType === TaskSubmissionType.AUTO) {
        const key = dto.featureKey?.trim();
        if (!key) {
          throw new BadRequestException('Select a platform trigger feature for internal tasks');
        }
        if (!this.isKnownFeatureKey(key)) {
          throw new BadRequestException(`Unknown feature key "${key}" — select one from the available triggers`);
        }
        featureKey = key;
      } else if (submissionType === TaskSubmissionType.EXTERNAL_LINK) {
        // Admin-supplied destination: the user opens this link, then confirms
        // completion from their dashboard.
        actionUrl = this.normalizeActionUrl(dto.actionUrl);
        if (!actionUrl) {
          throw new BadRequestException(
            'Add the destination link users must open to complete this task',
          );
        }
        actionLabel = this.sanitizeText(dto.actionLabel ?? '') || null;
      }
      platform = 'mcom_central';
    }

    this.assertAudienceCapabilities({
      targetAudience: dto.targetAudience,
      accessScope: dto.accessScope ?? TaskAccessScope.ALL,
      submissionType,
      taskSource: source,
      featureKey,
    });

    const rewardEnabled = dto.rewardCouponEnabled ?? false;
    const rewardAppliesToAll = dto.rewardCouponAppliesToAll ?? true;
    const rewardAppliesToAllAccess = dto.rewardCouponAppliesToAllAccess ?? false;
    const rewardPlanIds = rewardEnabled && !rewardAppliesToAll
      ? [...new Set(dto.rewardCouponPlanIds ?? [])]
      : [];
    const rewardAccessPlanIds = rewardEnabled && !rewardAppliesToAllAccess
      ? [...new Set(dto.rewardCouponAccessPlanIds ?? [])]
      : [];
    const rewardExpiresAt = dto.rewardCouponExpiresAt
      ? new Date(dto.rewardCouponExpiresAt)
      : null;
    await this.validateRewardCouponConfig({
      enabled: rewardEnabled,
      discountType: dto.rewardCouponDiscountType,
      value: dto.rewardCouponValue,
      appliesToAll: rewardAppliesToAll,
      planIds: rewardPlanIds,
      appliesToAllAccess: rewardAppliesToAllAccess,
      accessPlanIds: rewardAccessPlanIds,
      validDays: dto.rewardCouponValidDays,
      expiresAt: rewardExpiresAt,
    });

    const task = await this.prisma.taskDefinition.create({
      data: {
        title,
        description,
        targetAudience: dto.targetAudience,
        accessScope: dto.accessScope ?? TaskAccessScope.ALL,
        submissionType,
        taskSource: source,
        featureKey,
        actionUrl,
        actionLabel,
        externalClientId: external?.externalClientId ?? null,
        externalAppName: external?.externalAppName ?? null,
        externalPlatformSlug: external?.externalPlatformSlug ?? null,
        externalAppUrl: external?.externalAppUrl ?? null,
        deadlineDays: dto.deadlineDays,
        rewardPoints: dto.rewardPoints,
        isActive: dto.isActive ?? true,
        platform,
        rewardCouponEnabled: rewardEnabled,
        rewardCouponDiscountType: rewardEnabled ? dto.rewardCouponDiscountType ?? null : null,
        rewardCouponValue: rewardEnabled ? dto.rewardCouponValue ?? null : null,
        rewardCouponAppliesToAll: rewardAppliesToAll,
        rewardCouponAppliesToAllAccess: rewardAppliesToAllAccess,
        rewardCouponValidDays: rewardEnabled ? dto.rewardCouponValidDays ?? null : null,
        rewardCouponExpiresAt: rewardEnabled ? rewardExpiresAt : null,
        ...(rewardPlanIds.length > 0
          ? {
              rewardCouponPlans: {
                createMany: { data: rewardPlanIds.map((planId) => ({ planId })) },
              },
            }
          : {}),
        ...(rewardAccessPlanIds.length > 0
          ? {
              rewardCouponAccessPlans: {
                createMany: {
                  data: rewardAccessPlanIds.map((accessPlanId) => ({ accessPlanId })),
                },
              },
            }
          : {}),
      },
    });

    await this.logAudit(
      'Task Definition Created',
      'TaskDefinition',
      task.title,
      source === TaskSource.EXTERNAL
        ? `Created EXTERNAL task "${task.title}" for app ${task.externalAppName} (${task.externalClientId}), manual completion, deadline=${task.deadlineDays}d, points=${task.rewardPoints}`
        : `Created task "${task.title}" with target=${task.targetAudience}, trigger=${task.featureKey ?? task.actionUrl ?? 'none'}, deadline=${task.deadlineDays}d, points=${task.rewardPoints}`,
      adminName,
    );

    return { success: true, data: task };
  }

  async updateTaskDefinition(id: string, dto: UpdateTaskDefinitionDto, adminName = 'Admin') {
    const existing = await this.prisma.taskDefinition.findUnique({
      where: { id },
      include: {
        rewardCouponPlans: { select: { planId: true } },
        rewardCouponAccessPlans: { select: { accessPlanId: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const data: Prisma.TaskDefinitionUpdateInput = {};
    if (dto.title !== undefined) {
      const title = this.sanitizeText(dto.title);
      if (!title) throw new BadRequestException('Task title is required');
      data.title = title;
    }
    if (dto.description !== undefined) {
      const description = this.sanitizeText(dto.description);
      if (!description) throw new BadRequestException('Task description is required');
      data.description = description;
    }
    if (dto.targetAudience !== undefined) data.targetAudience = dto.targetAudience;
    if (dto.accessScope !== undefined) data.accessScope = dto.accessScope;
    if (dto.deadlineDays !== undefined) data.deadlineDays = dto.deadlineDays;
    if (dto.rewardPoints !== undefined) data.rewardPoints = dto.rewardPoints;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Source/submission transitions: re-validate trigger/app pairing whenever
    // any of them is touched.
    const sourceTouched = dto.taskSource !== undefined;
    const triggerTouched = dto.featureKey !== undefined;
    const appTouched = dto.externalClientId !== undefined;
    const submissionTouched = dto.submissionType !== undefined;
    const actionTouched = dto.actionUrl !== undefined || dto.actionLabel !== undefined;
    if (sourceTouched || triggerTouched || appTouched || submissionTouched || actionTouched) {
      const effectiveSource = dto.taskSource ?? existing.taskSource ?? TaskSource.INTERNAL;
      const effectiveSubmission =
        effectiveSource === TaskSource.EXTERNAL
          ? TaskSubmissionType.AUTO
          : dto.submissionType ?? existing.submissionType ?? TaskSubmissionType.AUTO;
      data.taskSource = effectiveSource;
      data.submissionType = effectiveSubmission;
      if (effectiveSource === TaskSource.EXTERNAL) {
        const rawKey = dto.featureKey !== undefined ? dto.featureKey : existing.featureKey;
        if (rawKey !== undefined && rawKey !== null && String(rawKey).trim() !== '') {
          throw new BadRequestException('External tasks do not use an event-worker trigger — omit the feature key');
        }
        const rawApp = dto.externalClientId !== undefined ? dto.externalClientId : existing.externalClientId;
        if (!rawApp || !String(rawApp).trim()) {
          throw new BadRequestException('Select an external app registered in the console for external tasks');
        }
        const external = await this.resolveExternalApp(String(rawApp));
        data.featureKey = null;
        data.actionUrl = null;
        data.actionLabel = null;
        data.externalClientId = external.externalClientId;
        data.externalAppName = external.externalAppName;
        data.externalPlatformSlug = external.externalPlatformSlug;
        data.externalAppUrl = external.externalAppUrl;
        data.platform = external.platform;
      } else {
        const rawApp = dto.externalClientId !== undefined ? dto.externalClientId : existing.externalClientId;
        if (rawApp !== undefined && rawApp !== null && String(rawApp).trim() !== '') {
          throw new BadRequestException('Internal tasks run on MCOM Central — omit the external app selection');
        }
        if (effectiveSubmission === TaskSubmissionType.AUTO) {
          const rawKey = dto.featureKey !== undefined ? dto.featureKey : existing.featureKey;
          const key = rawKey?.trim();
          if (!key) {
            throw new BadRequestException('Select a platform trigger feature for internal tasks');
          }
          if (!this.isKnownFeatureKey(key)) {
            throw new BadRequestException(`Unknown feature key "${key}" — select one from the available triggers`);
          }
          data.featureKey = key;
          data.actionUrl = null;
          data.actionLabel = null;
        } else if (effectiveSubmission === TaskSubmissionType.EXTERNAL_LINK) {
          const rawAction = dto.actionUrl !== undefined ? dto.actionUrl : existing.actionUrl;
          const actionUrl = this.normalizeActionUrl(rawAction);
          if (!actionUrl) {
            throw new BadRequestException(
              'Add the destination link users must open to complete this task',
            );
          }
          data.featureKey = null;
          data.actionUrl = actionUrl;
          const labelSource = dto.actionLabel !== undefined ? dto.actionLabel : existing.actionLabel;
          data.actionLabel = this.sanitizeText(labelSource ?? '') || null;
        } else {
          data.featureKey = null;
          data.actionUrl = null;
          data.actionLabel = null;
        }
        data.externalClientId = null;
        data.externalAppName = null;
        data.externalPlatformSlug = null;
        data.externalAppUrl = null;
        data.platform = 'mcom_central';
      }
    } else if (dto.platform !== undefined) {
      // Platform is derived (mcom_central | console platformSlug) — ignore manual edits.
      this.logger.warn(`Ignoring manual platform edit on task ${id}: platform is derived from task source`);
    }

    const capabilitiesTouched =
      dto.targetAudience !== undefined ||
      dto.accessScope !== undefined ||
      dto.submissionType !== undefined ||
      dto.featureKey !== undefined ||
      dto.taskSource !== undefined;
    if (capabilitiesTouched) {
      this.assertAudienceCapabilities({
        targetAudience: dto.targetAudience ?? existing.targetAudience,
        accessScope: dto.accessScope ?? existing.accessScope,
        submissionType:
          (data.submissionType as TaskSubmissionType | undefined) ?? existing.submissionType,
        taskSource: (data.taskSource as TaskSource | undefined) ?? existing.taskSource,
        featureKey:
          data.featureKey !== undefined
            ? (data.featureKey as string | null)
            : existing.featureKey,
      });
    }

    const couponTouched =
      dto.rewardCouponEnabled !== undefined ||
      dto.rewardCouponDiscountType !== undefined ||
      dto.rewardCouponValue !== undefined ||
      dto.rewardCouponAppliesToAll !== undefined ||
      dto.rewardCouponPlanIds !== undefined ||
      dto.rewardCouponAppliesToAllAccess !== undefined ||
      dto.rewardCouponAccessPlanIds !== undefined ||
      dto.rewardCouponValidDays !== undefined ||
      dto.rewardCouponExpiresAt !== undefined;

    let rewardPlanIds: string[] = (existing.rewardCouponPlans ?? []).map((link) => link.planId);
    let rewardAccessPlanIds: string[] = (existing.rewardCouponAccessPlans ?? []).map(
      (link) => link.accessPlanId,
    );
    if (couponTouched) {
      const enabled = dto.rewardCouponEnabled ?? existing.rewardCouponEnabled;
      const appliesToAll = dto.rewardCouponAppliesToAll ?? existing.rewardCouponAppliesToAll;
      const appliesToAllAccess =
        dto.rewardCouponAppliesToAllAccess ?? existing.rewardCouponAppliesToAllAccess;
      const planIds = appliesToAll
        ? []
        : dto.rewardCouponPlanIds !== undefined
          ? [...new Set(dto.rewardCouponPlanIds)]
          : rewardPlanIds;
      const accessPlanIds = appliesToAllAccess
        ? []
        : dto.rewardCouponAccessPlanIds !== undefined
          ? [...new Set(dto.rewardCouponAccessPlanIds)]
          : rewardAccessPlanIds;
      const expiresAt =
        dto.rewardCouponExpiresAt !== undefined
          ? dto.rewardCouponExpiresAt
            ? new Date(dto.rewardCouponExpiresAt)
            : null
          : existing.rewardCouponExpiresAt;
      const validDays =
        dto.rewardCouponValidDays !== undefined
          ? dto.rewardCouponValidDays
          : existing.rewardCouponValidDays;
      const discountType =
        dto.rewardCouponDiscountType !== undefined
          ? dto.rewardCouponDiscountType
          : existing.rewardCouponDiscountType;
      const value =
        dto.rewardCouponValue !== undefined
          ? dto.rewardCouponValue
          : existing.rewardCouponValue;

      await this.validateRewardCouponConfig({
        enabled,
        discountType,
        value,
        appliesToAll,
        planIds,
        appliesToAllAccess,
        accessPlanIds,
        validDays,
        expiresAt,
      });

      data.rewardCouponEnabled = enabled;
      data.rewardCouponDiscountType = enabled ? discountType ?? null : null;
      data.rewardCouponValue = enabled ? value ?? null : null;
      data.rewardCouponAppliesToAll = appliesToAll;
      data.rewardCouponAppliesToAllAccess = appliesToAllAccess;
      data.rewardCouponValidDays = enabled ? validDays ?? null : null;
      data.rewardCouponExpiresAt = enabled ? expiresAt ?? null : null;
      rewardPlanIds = enabled ? planIds : [];
      rewardAccessPlanIds = enabled ? accessPlanIds : [];
    }

    const task = couponTouched
      ? await this.prisma.$transaction(async (tx) => {
          const updated = await tx.taskDefinition.update({ where: { id }, data });
          await tx.taskRewardCouponPlan.deleteMany({ where: { taskId: id } });
          await tx.taskRewardCouponAccessPlan.deleteMany({ where: { taskId: id } });
          if (rewardPlanIds.length > 0) {
            await tx.taskRewardCouponPlan.createMany({
              data: rewardPlanIds.map((planId) => ({ taskId: id, planId })),
            });
          }
          if (rewardAccessPlanIds.length > 0) {
            await tx.taskRewardCouponAccessPlan.createMany({
              data: rewardAccessPlanIds.map((accessPlanId) => ({ taskId: id, accessPlanId })),
            });
          }
          return updated;
        })
      : await this.prisma.taskDefinition.update({ where: { id }, data });

    await this.logAudit(
      'Task Definition Updated',
      'TaskDefinition',
      task.title,
      `Updated task "${task.title}" (ID: ${task.id})`,
      adminName,
    );

    return { success: true, data: task };
  }

  async deleteTaskDefinition(id: string, adminName = 'Admin') {
    const existing = await this.prisma.taskDefinition.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    await this.prisma.taskDefinition.delete({ where: { id } });

    await this.logAudit(
      'Task Definition Deleted',
      'TaskDefinition',
      existing.title,
      `Deleted task definition "${existing.title}" and its assignments`,
      adminName,
    );

    return { success: true, message: `Task "${existing.title}" deleted successfully` };
  }

  // ─── Task Assignment (Bulk or Targeted) ───────────────
  async assignTask(taskId: string, dto: AssignTaskDto, adminName = 'Admin') {
    const task = await this.prisma.taskDefinition.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    let userIdsToTarget: { id: string; role: Role }[] = [];

    if (dto.userIds && dto.userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: dto.userIds } },
        select: { id: true, role: true },
      });
      userIdsToTarget = users;
    } else {
      // Find all eligible users based on task audience
      let roleFilter: Prisma.EnumRoleFilter | undefined;
      if (task.targetAudience === TaskAudience.BUSINESS) {
        roleFilter = { equals: Role.BUSINESS };
      } else if (task.targetAudience === TaskAudience.CUSTOMER) {
        roleFilter = { equals: Role.CUSTOMER };
      } else {
        roleFilter = { in: [Role.BUSINESS, Role.CUSTOMER] };
      }

      userIdsToTarget = await this.prisma.user.findMany({
        where: { role: roleFilter },
        select: { id: true, role: true },
      });
    }

    if (userIdsToTarget.length === 0) {
      return { success: true, assignedCount: 0, message: 'No eligible users found for assignment' };
    }

    // Find users who already have an assignment for this task
    const existingAssignments = await this.prisma.userTaskAssignment.findMany({
      where: {
        taskId,
        userId: { in: userIdsToTarget.map((u) => u.id) },
      },
      select: { userId: true },
    });
    const alreadyAssignedSet = new Set(existingAssignments.map((a) => a.userId));

    const eligibleToCreate = userIdsToTarget.filter((u) => !alreadyAssignedSet.has(u.id));

    if (eligibleToCreate.length === 0) {
      return {
        success: true,
        assignedCount: 0,
        totalEligible: userIdsToTarget.length,
        message: 'All target users are already assigned to this task',
      };
    }

    const now = new Date();
    const deadlineAt = new Date(now.getTime() + task.deadlineDays * 24 * 60 * 60 * 1000);

    const createdAssignments = await this.prisma.$transaction(
      eligibleToCreate.map((u) =>
        this.prisma.userTaskAssignment.create({
          data: {
            taskId: task.id,
            userId: u.id,
            userType: u.role,
            status: TaskAssignmentStatus.PENDING,
            rewardPoints: task.rewardPoints,
            assignedAt: now,
            deadlineAt,
            rewardGranted: false,
          },
        }),
      ),
    );

    await this.logAudit(
      'Task Bulk Assigned',
      'TaskDefinition',
      task.title,
      `Assigned task "${task.title}" to ${createdAssignments.length} users (deadline: ${task.deadlineDays} days)`,
      adminName,
    );

    return {
      success: true,
      assignedCount: createdAssignments.length,
      totalEligible: userIdsToTarget.length,
      message: `Successfully assigned task to ${createdAssignments.length} users`,
    };
  }

  // ─── Query Assignments for a Task ─────────────────────
  async getTaskAssignments(taskId: string, query?: QueryAssignmentsDto) {
    const task = await this.prisma.taskDefinition.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const where: Prisma.UserTaskAssignmentWhereInput = {
      taskId,
      ...(query?.status && { status: query.status }),
      ...(query?.search && {
        OR: [
          { user: { email: { contains: query.search, mode: 'insensitive' } } },
          { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
          { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
          { user: { businessProfile: { businessName: { contains: query.search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 50;
    const skip = (page - 1) * limit;

    const [total, assignments] = await Promise.all([
      this.prisma.userTaskAssignment.count({ where }),
      this.prisma.userTaskAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { assignedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              businessProfile: {
                select: {
                  id: true,
                  businessName: true,
                  category: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formatted = assignments.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      userId: a.userId,
      userType: a.userType,
      status: a.status,
      assignedAt: a.assignedAt,
      deadlineAt: a.deadlineAt,
      completedAt: a.completedAt,
      rewardGranted: a.rewardGranted,
      rewardPoints: a.rewardPoints,
      user: {
        id: a.user.id,
        email: a.user.email,
        name: [a.user.firstName, a.user.lastName].filter(Boolean).join(' ') || a.user.email,
        role: a.user.role,
        businessName: a.user.businessProfile?.businessName || null,
        logoUrl: a.user.businessProfile?.logoUrl || null,
      },
    }));

    return {
      success: true,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Admin: Programme Progress Per User ───────────────
  // Lists businesses/customers with a roll-up of their programme task progress so
  // admins can drill into one user and see what is done, expired, or outstanding.
  async getProgrammeUsersProgress(query?: QueryProgrammeUsersDto) {
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const roles: Role[] =
      query?.role === 'BUSINESS'
        ? [Role.BUSINESS]
        : query?.role === 'CUSTOMER'
          ? [Role.CUSTOMER]
          : [Role.BUSINESS, Role.CUSTOMER];

    const where: Prisma.UserWhereInput = {
      role: { in: roles },
      ...(query?.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              {
                businessProfile: {
                  businessName: { contains: query.search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const now = new Date();

    const [total, users, statusTotals, overdueTotal] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          businessProfile: {
            select: {
              businessName: true,
              logoUrl: true,
              category: true,
              membershipLevel: true,
              membershipTier: true,
              membershipStatus: true,
            },
          },
          customerProfile: {
            select: { membershipStatus: true, phone: true },
          },
        },
      }),
      this.prisma.userTaskAssignment.groupBy({
        by: ['status'],
        where: { user: { role: { in: roles } } },
        _count: { _all: true },
      }),
      this.prisma.userTaskAssignment.count({
        where: {
          user: { role: { in: roles } },
          status: { in: [TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS] },
          deadlineAt: { lt: now },
        },
      }),
    ]);

    const userIds = users.map((u) => u.id);
    const [byStatus, overdueByUser] = await Promise.all([
      userIds.length
        ? this.prisma.userTaskAssignment.groupBy({
            by: ['userId', 'status'],
            where: { userId: { in: userIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ userId: string; status: TaskAssignmentStatus; _count: { _all: number } }>),
      userIds.length
        ? this.prisma.userTaskAssignment.groupBy({
            by: ['userId'],
            where: {
              userId: { in: userIds },
              status: { in: [TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS] },
              deadlineAt: { lt: now },
            },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ userId: string; _count: { _all: number } }>),
    ]);

    const counts = new Map<string, Record<TaskAssignmentStatus, number>>();
    for (const row of byStatus) {
      const entry =
        counts.get(row.userId) ??
        ({
          [TaskAssignmentStatus.PENDING]: 0,
          [TaskAssignmentStatus.IN_PROGRESS]: 0,
          [TaskAssignmentStatus.COMPLETED]: 0,
          [TaskAssignmentStatus.EXPIRED]: 0,
        } as Record<TaskAssignmentStatus, number>);
      entry[row.status] = row._count._all;
      counts.set(row.userId, entry);
    }
    const overdueMap = new Map<string, number>(
      overdueByUser.map((row) => [row.userId, row._count._all]),
    );

    const data = users.map((u) => {
      const c = counts.get(u.id);
      const completed = c?.[TaskAssignmentStatus.COMPLETED] ?? 0;
      const storedExpired = c?.[TaskAssignmentStatus.EXPIRED] ?? 0;
      const inProgress = c?.[TaskAssignmentStatus.IN_PROGRESS] ?? 0;
      const pending = c?.[TaskAssignmentStatus.PENDING] ?? 0;
      const overdue = overdueMap.get(u.id) ?? 0;
      // Open tasks past their deadline count as expired, not as outstanding.
      const expired = storedExpired + overdue;
      const outstanding = Math.max(0, pending + inProgress - overdue);
      const totalTasks = completed + pending + inProgress + storedExpired;
      return {
        id: u.id,
        userId: u.id,
        name:
          u.role === Role.BUSINESS
            ? u.businessProfile?.businessName ||
              [u.firstName, u.lastName].filter(Boolean).join(' ') ||
              u.email.split('@')[0]
            : [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0],
        email: u.email,
        role: u.role,
        logoUrl: u.businessProfile?.logoUrl ?? null,
        category: u.businessProfile?.category ?? null,
        membership: u.businessProfile
          ? `${u.businessProfile.membershipLevel} ${u.businessProfile.membershipTier}`
          : u.customerProfile?.membershipStatus ?? 'None',
        joinedAt: u.createdAt,
        totalTasks,
        completed,
        expired,
        inProgress,
        pending,
        overdue,
        outstanding,
        progress: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
      };
    });

    const totals = statusTotals.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    const totalPending = totals[TaskAssignmentStatus.PENDING] ?? 0;
    const totalInProgress = totals[TaskAssignmentStatus.IN_PROGRESS] ?? 0;

    return {
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        users: total,
        completed: totals[TaskAssignmentStatus.COMPLETED] ?? 0,
        expired: (totals[TaskAssignmentStatus.EXPIRED] ?? 0) + overdueTotal,
        inProgress: totalInProgress,
        pending: totalPending,
        overdue: overdueTotal,
        outstanding: Math.max(0, totalPending + totalInProgress - overdueTotal),
      },
    };
  }

  // ─── Admin: One User's Full Programme Task Breakdown ──
  async getProgrammeUserTasks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        businessProfile: {
          select: {
            businessName: true,
            logoUrl: true,
            category: true,
            membershipLevel: true,
            membershipTier: true,
            membershipStatus: true,
          },
        },
        customerProfile: { select: { membershipStatus: true, phone: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const assignments = await this.prisma.userTaskAssignment.findMany({
      where: { userId },
      include: {
        task: {
          select: {
            title: true,
            description: true,
            featureKey: true,
            taskSource: true,
            platform: true,
            externalAppName: true,
            submissionType: true,
            actionUrl: true,
            actionLabel: true,
            deadlineDays: true,
            rewardCouponEnabled: true,
          },
        },
        rewardCoupon: { select: { code: true } },
      },
      orderBy: [{ status: 'asc' }, { deadlineAt: 'asc' }],
    });

    const now = new Date();
    const data = assignments.map((a) => {
      const isOpen =
        a.status === TaskAssignmentStatus.PENDING ||
        a.status === TaskAssignmentStatus.IN_PROGRESS;
      const effectiveStatus =
        isOpen && a.deadlineAt < now ? TaskAssignmentStatus.EXPIRED : a.status;
      const daysRemaining = Math.max(
        0,
        Math.ceil((new Date(a.deadlineAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );
      return {
        id: a.id,
        taskId: a.taskId,
        title: a.task.title,
        description: a.task.description,
        featureKey: a.task.featureKey,
        taskSource: a.task.taskSource,
        platform: a.task.platform,
        externalAppName: a.task.externalAppName,
        submissionType: a.task.submissionType,
        actionUrl: a.task.actionUrl,
        actionLabel: a.task.actionLabel,
        deadlineDays: a.task.deadlineDays,
        status: effectiveStatus,
        storedStatus: a.status,
        assignedAt: a.assignedAt,
        deadlineAt: a.deadlineAt,
        daysRemaining,
        completedAt: a.completedAt,
        rewardPoints: a.rewardPoints,
        rewardGranted: a.rewardGranted,
        rewardCouponEnabled: a.task.rewardCouponEnabled,
        rewardCouponCode: a.rewardCoupon?.code ?? null,
      };
    });

    const summary = data.reduce(
      (acc, t) => {
        acc.total += 1;
        if (t.status === TaskAssignmentStatus.COMPLETED) acc.completed += 1;
        else if (t.status === TaskAssignmentStatus.EXPIRED) acc.expired += 1;
        else if (t.status === TaskAssignmentStatus.IN_PROGRESS) acc.inProgress += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, completed: 0, expired: 0, inProgress: 0, pending: 0 },
    );

    return {
      success: true,
      data,
      summary: {
        ...summary,
        outstanding: summary.pending + summary.inProgress,
        progress:
          summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0,
      },
      user: {
        id: user.id,
        userId: user.id,
        name:
          user.role === Role.BUSINESS
            ? user.businessProfile?.businessName ||
              [user.firstName, user.lastName].filter(Boolean).join(' ') ||
              user.email.split('@')[0]
            : [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0],
        email: user.email,
        role: user.role,
        logoUrl: user.businessProfile?.logoUrl ?? null,
        category: user.businessProfile?.category ?? null,
        membership: user.businessProfile
          ? `${user.businessProfile.membershipLevel} ${user.businessProfile.membershipTier}`
          : user.customerProfile?.membershipStatus ?? 'None',
        joinedAt: user.createdAt,
      },
    };
  }

  // ─── Manual Status Update (Override) ──────────────────
  async updateAssignmentStatus(
    assignmentId: string,
    dto: UpdateAssignmentStatusDto,
    adminName = 'Admin',
  ) {
    const assignment = await this.prisma.userTaskAssignment.findUnique({
      where: { id: assignmentId },
      include: { task: true, user: true },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    const now = new Date();
    const isNowCompleted = dto.status === TaskAssignmentStatus.COMPLETED;

    const updated = await this.prisma.userTaskAssignment.update({
      where: { id: assignmentId },
      data: {
        status: dto.status,
        ...(isNowCompleted && { completedAt: assignment.completedAt || now }),
      },
    });

    // If marked completed and grantReward requested, dispatch reward if not yet granted
    if (isNowCompleted && dto.grantReward && !assignment.rewardGranted && assignment.rewardPoints > 0 && this.rewardQueue) {
      await this.rewardQueue.add(
        'grant-task-reward',
        {
          assignmentId: assignment.id,
          userId: assignment.userId,
          rewardPoints: assignment.rewardPoints,
          taskTitle: assignment.task.title,
        },
        {
          jobId: `task-reward-${assignment.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }

    if (isNowCompleted) {
      await this.enqueueTaskCouponReward(assignment.id, assignment.task);
    }

    await this.logAudit(
      'User Task Assignment Updated',
      'UserTaskAssignment',
      assignment.task.title,
      `Set status to "${dto.status}" for user ${assignment.user.email} (grantReward: ${dto.grantReward ?? false})`,
      adminName,
    );

    return { success: true, data: updated };
  }

  // ─── Programme Access (paid membership vs trial) ──────
  private async getProgrammeAccessSettings() {
    const rows = await this.prisma.programmeSetting.findMany({
      where: { key: { in: ['verification_required', 'trial_access_days'] } },
      select: { key: true, value: true, updatedAt: true },
    });
    const map = new Map(rows.map((row) => [row.key, row]));
    const verificationSetting = map.get('verification_required');
    const trialSetting = map.get('trial_access_days');
    const configuredTrialDays = trialSetting ? parseInt(trialSetting.value, 10) : 14;

    return {
      verificationRequired: verificationSetting ? verificationSetting.value === 'true' : true,
      trialDays: Number.isNaN(configuredTrialDays) ? 14 : configuredTrialDays,
      verificationOptionalSince: verificationSetting?.updatedAt ?? null,
    };
  }

  private resolveUserAccess(
    user: {
      role: Role;
      businessProfile: {
        membershipStatus: string;
        membershipPlanName: string | null;
        membershipExpiresAt: Date | null;
        hasPaidVerificationFee: boolean;
        verificationFeePaidAt: Date | null;
        trialAccessDays: number;
        trialAccessExpiresAt: Date | null;
        createdAt: Date;
      } | null;
      customerProfile: { membershipStatus: string } | null;
    },
    settings: {
      verificationRequired: boolean;
      trialDays: number;
      verificationOptionalSince: Date | null;
    },
  ): { isPaid: boolean; isTrial: boolean } {
    const now = new Date();
    const businessProfile = user.businessProfile;

    const membershipStatus = (businessProfile?.membershipStatus ?? '').toLowerCase();
    const membershipExpiresAt = businessProfile?.membershipExpiresAt
      ? new Date(businessProfile.membershipExpiresAt)
      : null;
    const hasActiveMembership =
      Boolean(businessProfile?.membershipPlanName) &&
      ['active', 'trial', 'past_due'].includes(membershipStatus) &&
      (!membershipExpiresAt || membershipExpiresAt.getTime() > now.getTime());

    if (hasActiveMembership) {
      return { isPaid: true, isTrial: false };
    }

    if (user.role === Role.CUSTOMER) {
      const customerStatus = (user.customerProfile?.membershipStatus ?? '').toLowerCase();
      return {
        isPaid: customerStatus === 'active' || customerStatus === 'past_due',
        isTrial: false,
      };
    }

    if (!businessProfile) {
      return { isPaid: false, isTrial: false };
    }

    // Mirrors the dashboard-access configuration: verification is mandatory
    // unless an admin turns it off, and the trial length comes from settings.
    const hasTrialEntitlement =
      Boolean(businessProfile.hasPaidVerificationFee) || !settings.verificationRequired;

    let trialExpiresAt = businessProfile.trialAccessExpiresAt
      ? new Date(businessProfile.trialAccessExpiresAt)
      : null;

    if (!trialExpiresAt && businessProfile.hasPaidVerificationFee && businessProfile.verificationFeePaidAt) {
      const paidAt = new Date(businessProfile.verificationFeePaidAt);
      const days = businessProfile.trialAccessDays || settings.trialDays;
      trialExpiresAt = new Date(paidAt.getTime() + days * 24 * 60 * 60 * 1000);
    }

    if (!trialExpiresAt && !settings.verificationRequired) {
      const profileCreatedAt = businessProfile.createdAt ? new Date(businessProfile.createdAt) : null;
      const optionalSince = settings.verificationOptionalSince;
      const trialStartedAt =
        !profileCreatedAt
          ? optionalSince
          : optionalSince && optionalSince.getTime() > profileCreatedAt.getTime()
            ? optionalSince
            : profileCreatedAt;
      if (trialStartedAt && !Number.isNaN(trialStartedAt.getTime())) {
        trialExpiresAt = new Date(
          trialStartedAt.getTime() + settings.trialDays * 24 * 60 * 60 * 1000,
        );
      }
    }

    const isTrial =
      hasTrialEntitlement &&
      Boolean(trialExpiresAt && trialExpiresAt.getTime() > now.getTime());

    return { isPaid: false, isTrial };
  }

  // ─── User-Facing View: List My Tasks ──────────────────
  async getMyTasks(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        businessProfile: {
          select: {
            membershipStatus: true,
            membershipPlanName: true,
            membershipExpiresAt: true,
            hasPaidVerificationFee: true,
            verificationFeePaidAt: true,
            trialAccessDays: true,
            trialAccessExpiresAt: true,
            createdAt: true,
          },
        },
        customerProfile: { select: { membershipStatus: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const audience = user.role === Role.CUSTOMER ? TaskAudience.CUSTOMER : TaskAudience.BUSINESS;
    const accessSettings = await this.getProgrammeAccessSettings();
    const access = this.resolveUserAccess(user, accessSettings);

    const accessScopes: TaskAccessScope[] = [TaskAccessScope.ALL];
    if (access.isPaid) accessScopes.push(TaskAccessScope.PAID);
    if (access.isTrial) accessScopes.push(TaskAccessScope.TRIAL);

    // Find all active task definitions this user is eligible to see.
    const activeTasks = await this.prisma.taskDefinition.findMany({
      where: {
        isActive: true,
        targetAudience: { in: [audience, TaskAudience.BOTH] },
        accessScope: { in: accessScopes },
      },
    });

    // Check which ones are already assigned to this user
    const existing = await this.prisma.userTaskAssignment.findMany({
      where: { userId },
      select: { taskId: true },
    });
    const existingIds = new Set(existing.map((e) => e.taskId));

    const toAssign = activeTasks.filter((t) => !existingIds.has(t.id));
    if (toAssign.length > 0) {
      const now = new Date();
      await this.prisma.userTaskAssignment.createMany({
        data: toAssign.map((t) => {
          const deadline = new Date(now);
          deadline.setDate(deadline.getDate() + t.deadlineDays);
          return {
            taskId: t.id,
            userId,
            userType: user.role === Role.CUSTOMER ? 'CUSTOMER' : 'BUSINESS',
            status: TaskAssignmentStatus.PENDING,
            deadlineAt: deadline,
            rewardPoints: t.rewardPoints,
          };
        }),
      });
    }

    const assignments = await this.prisma.userTaskAssignment.findMany({
      where: {
        userId,
        task: {
          accessScope: { in: accessScopes },
          targetAudience: { in: [audience, TaskAudience.BOTH] },
        },
      },
      include: {
        task: true,
        rewardCoupon: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
            appliesToAllMemberships: true,
            appliesToAllAccess: true,
            expiresAt: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { deadlineAt: 'asc' },
      ],
    });

    // The programme length is driven by the task engine: every configured task
    // contributes its completion window (deadlineDays).
    const programmeAggregate = await this.prisma.taskDefinition.aggregate({
      where: {
        isActive: true,
        targetAudience: { in: [audience, TaskAudience.BOTH] },
      },
      _sum: { deadlineDays: true },
      _count: { _all: true },
    });
    const totalProgrammeDays = programmeAggregate._sum.deadlineDays ?? 0;
    const configuredTaskCount = programmeAggregate._count._all;

    return {
      success: true,
      data: assignments.map((a) => {
        const now = new Date();
        const daysRemaining = Math.max(
          0,
          Math.ceil((new Date(a.deadlineAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );

        return {
          id: a.id,
          taskId: a.taskId,
          title: a.task.title,
          description: a.task.description,
          featureKey: a.task.featureKey,
          taskSource: a.task.taskSource,
          platform: a.task.platform,
          externalAppName: a.task.externalAppName,
          externalAppUrl: a.task.externalAppUrl,
          externalClientId: a.task.externalClientId,
          externalPlatformSlug: a.task.externalPlatformSlug,
          accessScope: a.task.accessScope,
          submissionType: a.task.submissionType,
          actionUrl: a.task.actionUrl,
          actionLabel: a.task.actionLabel,
          deadlineDays: a.task.deadlineDays,
          status: a.status,
          assignedAt: a.assignedAt,
          deadlineAt: a.deadlineAt,
          daysRemaining,
          completedAt: a.completedAt,
          rewardGranted: a.rewardGranted,
          rewardPoints: a.rewardPoints,
          rewardCouponEnabled: a.task.rewardCouponEnabled,
          rewardCoupon: a.rewardCoupon
            ? {
                id: a.rewardCoupon.id,
                code: a.rewardCoupon.code,
                discountType: a.rewardCoupon.discountType,
                discountValue: Number(a.rewardCoupon.discountValue),
                appliesToAllMemberships: a.rewardCoupon.appliesToAllMemberships,
                appliesToAllAccess: a.rewardCoupon.appliesToAllAccess,
                expiresAt: a.rewardCoupon.expiresAt,
              }
            : null,
        };
      }),
      meta: {
        totalProgrammeDays,
        configuredTaskCount,
        accessScope: access.isPaid ? 'PAID' : access.isTrial ? 'TRIAL' : 'NONE',
      },
    };
  }

  async startMyTask(assignmentId: string, userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    const assignment = await this.prisma.userTaskAssignment.findFirst({
      where: { id: assignmentId, userId },
    });
    if (!assignment) {
      throw new NotFoundException('Task assignment not found');
    }

    if (assignment.status === TaskAssignmentStatus.PENDING) {
      const updated = await this.prisma.userTaskAssignment.update({
        where: { id: assignmentId },
        data: { status: TaskAssignmentStatus.IN_PROGRESS },
      });
      return { success: true, data: updated };
    }

    return { success: true, data: assignment };
  }

  // ─── Validate proof submission based on task type ─────
  private validateTaskSubmission(
    task: {
      submissionType: TaskSubmissionType;
      title: string;
      actionUrl?: string | null;
    },
    submission?: { submissionData?: unknown },
    assignmentStatus?: TaskAssignmentStatus,
  ) {
    if (!task.submissionType || task.submissionType === TaskSubmissionType.AUTO) return;

    const raw = (submission?.submissionData ?? {}) as Record<string, unknown>;
    const value = typeof raw.value === 'string' ? raw.value.trim() : '';

    if (task.submissionType === TaskSubmissionType.EXTERNAL_LINK) {
      // MCOM Central link tasks: the admin supplies the destination link and the
      // user completes the task after opening it. Opening the link marks the
      // assignment IN_PROGRESS (or the dashboard sends `openedAt`), which is the
      // proof we record.
      if (task.actionUrl) {
        const openedAt = typeof raw.openedAt === 'string' ? raw.openedAt.trim() : '';
        const hasOpened =
          Boolean(openedAt) || assignmentStatus === TaskAssignmentStatus.IN_PROGRESS;
        if (!hasOpened) {
          throw new BadRequestException(
            'Open the task link before marking this task as complete',
          );
        }
        return;
      }
      // Legacy tasks created before action links existed still ask the user for
      // the link they completed the work at.
      if (!value) {
        throw new BadRequestException('Submit the external link to complete this task');
      }
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
      } catch {
        throw new BadRequestException('Enter a valid http(s) link');
      }
      return;
    }

    if (task.submissionType === TaskSubmissionType.TEXT_INPUT) {
      if (!value) {
        throw new BadRequestException('Enter the requested text to complete this task');
      }
      if (value.length > 5000) {
        throw new BadRequestException('Text submission is too long (maximum 5000 characters)');
      }
      return;
    }

    if (task.submissionType === TaskSubmissionType.DIGIT_INPUT) {
      if (!value) {
        throw new BadRequestException('Enter the requested digits to complete this task');
      }
      if (!/^\d+$/.test(value)) {
        throw new BadRequestException('Only digits are allowed for this task');
      }
      return;
    }

    if (task.submissionType === TaskSubmissionType.IMAGE_UPLOAD) {
      const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '';
      if (!imageUrl) {
        throw new BadRequestException('Upload an image to complete this task');
      }
      return;
    }
  }

  // ─── User-Facing: Complete & Claim Reward ────────────
  async completeMyTask(
    assignmentId: string,
    userId: string,
    submission?: { submissionData?: unknown; notes?: string },
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    const assignment = await this.prisma.userTaskAssignment.findUnique({
      where: { id: assignmentId },
      include: { task: true, user: { include: { businessProfile: true } } },
    });

    if (!assignment) {
      throw new NotFoundException('Task assignment not found');
    }

    if (assignment.userId !== userId) {
      throw new ForbiddenException('You do not own this task assignment');
    }

    if (assignment.status === TaskAssignmentStatus.COMPLETED) {
      return { success: true, message: 'Task already completed', data: assignment };
    }

    const now = new Date();
    if (assignment.deadlineAt < now) {
      await this.prisma.userTaskAssignment.update({
        where: { id: assignmentId },
        data: { status: TaskAssignmentStatus.EXPIRED },
      });
      throw new BadRequestException('Task deadline has expired');
    }

    this.validateTaskSubmission(assignment.task, submission, assignment.status);

    // Record the link visit as proof for admin-supplied action links so admins
    // can audit that the user actually opened the destination.
    if (
      assignment.task.submissionType === TaskSubmissionType.EXTERNAL_LINK &&
      assignment.task.actionUrl &&
      submission?.submissionData === undefined
    ) {
      submission = {
        ...(submission ?? {}),
        submissionData: {
          actionUrl: assignment.task.actionUrl,
          openedAt: now.toISOString(),
        },
      };
    }

    // 1. Mark assignment completed (persist proof when the column exists)
    let updated;
    const completionData: Record<string, unknown> = {
      status: TaskAssignmentStatus.COMPLETED,
      completedAt: now,
    };
    if (submission?.submissionData !== undefined) {
      completionData.submissionData = submission.submissionData;
    }
    try {
      updated = await this.prisma.userTaskAssignment.update({
        where: { id: assignmentId },
        data: completionData as never,
      });
    } catch (err) {
      // Fallback for DBs where the submission_data migration hasn't run yet
      this.logger.warn(
        `completeMyTask: submissionData column unavailable, completing without proof: ${(err as Error).message}`,
      );
      updated = await this.prisma.userTaskAssignment.update({
        where: { id: assignmentId },
        data: { status: TaskAssignmentStatus.COMPLETED, completedAt: now },
      });
    }

    // 2. Queue reward if points exist and not yet granted
    if (assignment.rewardPoints > 0 && !assignment.rewardGranted && this.rewardQueue) {
      await this.rewardQueue.add(
        'grant-task-reward',
        {
          assignmentId: assignment.id,
          userId: assignment.userId,
          rewardPoints: assignment.rewardPoints,
          taskTitle: assignment.task.title,
        },
        {
          jobId: `task-reward-${assignment.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }

    // 3. Cross-sync: if user is BUSINESS, sync to BusinessProgramme.completedMissions
    const businessId = assignment.user?.businessProfile?.id;
    if (businessId) {
      await this.syncToBusinessProgramme(businessId, assignment.task.featureKey || assignment.taskId);
    }

    // 4. Queue the personal completion coupon (independent of point rewards).
    await this.enqueueTaskCouponReward(assignment.id, assignment.task);

    return {
      success: true,
      message: 'Task completed successfully! Reward queued.',
      data: updated,
    };
  }

  private async syncToBusinessProgramme(businessId: string, missionIdentifier: string) {
    try {
      const prog = await this.prisma.businessProgramme.findFirst({
        where: { businessId },
      });
      if (!prog) return;

      if (!prog.completedMissions.includes(missionIdentifier)) {
        await this.prisma.businessProgramme.update({
          where: { id: prog.id },
          data: {
            completedMissions: { push: missionIdentifier },
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to sync task completion to BusinessProgramme: ${msg}`);
    }
  }

  // ─── Nightly Cron: Expiry Check ────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNightlyExpiryCheck() {
    this.logger.log('Running nightly task deadline expiry sweep...');
    const now = new Date();

    const expired = await this.prisma.userTaskAssignment.updateMany({
      where: {
        status: {
          in: [TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS],
        },
        deadlineAt: {
          lt: now,
        },
      },
      data: {
        status: TaskAssignmentStatus.EXPIRED,
      },
    });

    if (expired.count > 0) {
      this.logger.log(`Nightly sweep marked ${expired.count} assignments as EXPIRED`);
    } else {
      this.logger.log('No expired assignments found in nightly sweep');
    }
  }
}
