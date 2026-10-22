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
  TaskAssignmentStatus,
  TaskAudience,
  TaskSource,
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

  private isKnownFeatureKey(key: string): boolean {
    return CENTRAL_FEATURE_KEYS.some((f) => f.key === key);
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
    const title = this.sanitizeText(dto.title);
    const description = this.sanitizeText(dto.description);
    if (!title || !description) {
      throw new BadRequestException('Task title and description are required');
    }

    let featureKey: string | null = null;
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
      const key = dto.featureKey?.trim();
      if (!key) {
        throw new BadRequestException('Select a platform trigger feature for internal tasks');
      }
      if (!this.isKnownFeatureKey(key)) {
        throw new BadRequestException(`Unknown feature key "${key}" — select one from the available triggers`);
      }
      featureKey = key;
      platform = 'mcom_central';
    }

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
        taskSource: source,
        featureKey,
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
        : `Created task "${task.title}" with target=${task.targetAudience}, feature=${task.featureKey}, deadline=${task.deadlineDays}d, points=${task.rewardPoints}`,
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
    if (dto.deadlineDays !== undefined) data.deadlineDays = dto.deadlineDays;
    if (dto.rewardPoints !== undefined) data.rewardPoints = dto.rewardPoints;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Source transitions: re-validate trigger/app pairing whenever touched.
    const sourceTouched = dto.taskSource !== undefined;
    const triggerTouched = dto.featureKey !== undefined;
    const appTouched = dto.externalClientId !== undefined;
    if (sourceTouched || triggerTouched || appTouched) {
      const effectiveSource = dto.taskSource ?? existing.taskSource ?? TaskSource.INTERNAL;
      data.taskSource = effectiveSource;
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
        const rawKey = dto.featureKey !== undefined ? dto.featureKey : existing.featureKey;
        const key = rawKey?.trim();
        if (!key) {
          throw new BadRequestException('Select a platform trigger feature for internal tasks');
        }
        if (!this.isKnownFeatureKey(key)) {
          throw new BadRequestException(`Unknown feature key "${key}" — select one from the available triggers`);
        }
        data.featureKey = key;
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

  // ─── User-Facing View: List My Tasks ──────────────────
  async getMyTasks(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const audience = user.role === Role.CUSTOMER ? TaskAudience.CUSTOMER : TaskAudience.BUSINESS;

    // Find all active task definitions matching this audience or BOTH
    const activeTasks = await this.prisma.taskDefinition.findMany({
      where: {
        isActive: true,
        targetAudience: { in: [audience, TaskAudience.BOTH] },
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
      where: { userId },
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
