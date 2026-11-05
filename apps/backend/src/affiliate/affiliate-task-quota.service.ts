import { Injectable, Logger } from '@nestjs/common';
import { AffiliateTaskStatus, MembershipTier, PlanTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type DelegationQuotaSource = 'MEMBERSHIP' | 'ACCESS_PASS' | 'NONE';

export interface DelegationAllowance {
  source: DelegationQuotaSource;
  planId: string | null;
  planName: string | null;
  freeLimit: number;
  unlimited: boolean;
  used: number;
  /** null when unlimited. */
  remaining: number | null;
  /** True when this delegation should not charge the business wallet. */
  isFree: boolean;
  periodStart: Date | null;
  periodEnd: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_DAYS = 90;

/**
 * Resolves a business's free delegated-task allowance for its current
 * membership or access pass.
 *
 * Usage is counted from non-cancelled *assigned* tasks created inside the
 * entitlement period. Counting rows (not assignment events) means reassigning a
 * declined task never consumes two slots, while cancelling a task frees its
 * slot for a future delegation.
 */
@Injectable()
export class AffiliateTaskQuotaService {
  private readonly logger = new Logger(AffiliateTaskQuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    businessId: string,
    opts: { excludeTaskId?: string } = {},
  ): Promise<DelegationAllowance> {
    const now = new Date();
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        id: true,
        membershipStatus: true,
        membershipPlanName: true,
        membershipExpiresAt: true,
        membershipTier: true,
      },
    });

    if (!business) {
      return this.none();
    }

    const membershipActive =
      business.membershipStatus === 'active' &&
      !!business.membershipPlanName &&
      (!business.membershipExpiresAt || business.membershipExpiresAt > now);

    if (membershipActive) {
      const plan = await this.prisma.membershipPlan.findFirst({
        where: { name: business.membershipPlanName!, deletedAt: null },
        select: {
          id: true,
          name: true,
          freeDelegatedTasks: true,
          unlimitedFreeDelegatedTasks: true,
          tiers: {
            where: { tier: this.mapTier(business.membershipTier) },
            select: { durationDays: true },
            take: 1,
          },
        },
      });

      const period = await this.membershipPeriod(business.id, business.membershipExpiresAt, plan);
      return this.build(
        'MEMBERSHIP',
        plan?.id ?? null,
        plan?.name ?? business.membershipPlanName,
        plan?.freeDelegatedTasks ?? 0,
        // A paid membership whose plan row no longer exists keeps the legacy
        // "included" behaviour instead of silently charging the business.
        plan?.unlimitedFreeDelegatedTasks ?? true,
        businessId,
        period,
        opts.excludeTaskId,
      );
    }

    const purchase = await this.prisma.accessPurchase.findFirst({
      where: {
        businessId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
      include: {
        accessPlan: {
          select: {
            id: true,
            name: true,
            freeDelegatedTasks: true,
            unlimitedFreeDelegatedTasks: true,
          },
        },
      },
    });

    if (purchase) {
      return this.build(
        'ACCESS_PASS',
        purchase.accessPlan.id,
        purchase.accessPlan.name,
        purchase.accessPlan.freeDelegatedTasks,
        purchase.accessPlan.unlimitedFreeDelegatedTasks,
        businessId,
        { start: purchase.startsAt, end: purchase.expiresAt },
        opts.excludeTaskId,
      );
    }

    return this.none();
  }

  /** Flattened snapshot persisted on the task for audit + fast UI display. */
  async snapshotForTask(businessId: string, excludeTaskId?: string) {
    const allowance = await this.resolve(businessId, { excludeTaskId });
    return {
      freeDelegation: allowance.isFree,
      delegationQuotaSource: allowance.source,
      delegationQuotaLimit: allowance.unlimited ? null : allowance.freeLimit,
      delegationQuotaUsed: allowance.used,
      delegationQuotaUnlimited: allowance.unlimited,
      delegationQuotaPeriodStart: allowance.periodStart,
    };
  }

  private async membershipPeriod(
    businessId: string,
    membershipExpiresAt: Date | null,
    plan: { tiers: Array<{ durationDays: number }> } | null,
  ): Promise<{ start: Date; end: Date }> {
    const now = new Date();
    const activeSubscription = await this.prisma.ecosystemSubscription.findFirst({
      where: {
        businessId,
        type: 'Membership',
        status: 'Active',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { endDate: 'desc' },
      select: { startDate: true, endDate: true },
    });
    if (activeSubscription) {
      return { start: activeSubscription.startDate, end: activeSubscription.endDate };
    }

    const durationDays = plan?.tiers?.[0]?.durationDays ?? FALLBACK_DAYS;
    const end =
      membershipExpiresAt && membershipExpiresAt > now ? membershipExpiresAt : now;
    const start = new Date(Math.min(end.getTime() - durationDays * DAY_MS, now.getTime()));
    return { start, end };
  }

  private async build(
    source: DelegationQuotaSource,
    planId: string | null,
    planName: string | null,
    freeLimit: number,
    unlimited: boolean,
    businessId: string,
    period: { start: Date; end: Date },
    excludeTaskId?: string,
  ): Promise<DelegationAllowance> {
    const used = await this.prisma.affiliateTask.count({
      where: {
        businessId,
        createdAt: { gte: period.start, lte: period.end },
        assigneeId: { not: null },
        status: { not: AffiliateTaskStatus.CANCELLED },
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      },
    });

    if (unlimited) {
      return {
        source,
        planId,
        planName,
        freeLimit: 0,
        unlimited: true,
        used,
        remaining: null,
        isFree: true,
        periodStart: period.start,
        periodEnd: period.end,
      };
    }

    const remaining = Math.max(0, freeLimit - used);
    return {
      source,
      planId,
      planName,
      freeLimit,
      unlimited: false,
      used,
      remaining,
      isFree: used < freeLimit,
      periodStart: period.start,
      periodEnd: period.end,
    };
  }

  private none(): DelegationAllowance {
    return {
      source: 'NONE',
      planId: null,
      planName: null,
      freeLimit: 0,
      unlimited: false,
      used: 0,
      remaining: 0,
      isFree: false,
      periodStart: null,
      periodEnd: null,
    };
  }

  private mapTier(tier: MembershipTier): PlanTier {
    if (tier === MembershipTier.Pro) return PlanTier.Pro;
    if (tier === MembershipTier.ProPlus) return PlanTier.ProPlus;
    return PlanTier.Standard;
  }
}
