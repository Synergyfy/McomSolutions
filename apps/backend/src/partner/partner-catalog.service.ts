import { Injectable } from '@nestjs/common';
import { PlanTier } from '@prisma/client';
import { planTierDisplay } from '../pricing/payment-option.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { partnerError, PARTNER_ERRORS, PARTNER_HTTP } from './partner-error.util';

const CATALOG_TTL_SECONDS = 30;

const MEMBERSHIP_INCLUDE = {
  tiers: {
    orderBy: { sortOrder: 'asc' },
    include: {
      features: { orderBy: { sortOrder: 'asc' } },
      entitlements: true,
      paymentOptions: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  },
  appBundles: { orderBy: { createdAt: 'asc' } },
} as const;

const ACCESS_INCLUDE = {
  appBundles: { orderBy: { createdAt: 'asc' } },
} as const;

/**
 * Partner-facing catalogue. Read-only projections of the same membership and
 * access-plan tables the public pricing/access APIs use — active, non-archived
 * rows only. Short-TTL Redis cache (30s) with an in-memory fallback in tests.
 */
@Injectable()
export class PartnerCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listMemberships() {
    const key = 'partner:catalog:memberships';
    const cached = await this.redis.get<ReturnType<typeof this.mapMembership>[]>(key);
    if (cached) return cached;

    const plans = await this.prisma.membershipPlan.findMany({
      where: { archived: false, deletedAt: null },
      orderBy: { name: 'asc' },
      include: MEMBERSHIP_INCLUDE,
    });
    const data = plans.map((plan) => this.mapMembership(plan));
    await this.redis.set(key, data, CATALOG_TTL_SECONDS);
    return data;
  }

  async getMembership(id: string) {
    const key = `partner:catalog:memberships:${id}`;
    const cached = await this.redis.get<ReturnType<typeof this.mapMembership>>(key);
    if (cached) return cached;

    const plan = await this.prisma.membershipPlan.findFirst({
      where: { id, archived: false, deletedAt: null },
      include: MEMBERSHIP_INCLUDE,
    });
    if (!plan) {
      throw partnerError(
        PARTNER_HTTP.NOT_FOUND,
        PARTNER_ERRORS.PLAN_NOT_AVAILABLE,
        'Membership plan not found or not available.',
      );
    }
    const data = this.mapMembership(plan);
    await this.redis.set(key, data, CATALOG_TTL_SECONDS);
    return data;
  }

  async listAccessPlans() {
    const key = 'partner:catalog:access-plans';
    const cached = await this.redis.get<ReturnType<typeof this.mapAccessPlan>[]>(key);
    if (cached) return cached;

    const plans = await this.prisma.accessPlan.findMany({
      where: { archived: false, deletedAt: null },
      orderBy: { name: 'asc' },
      include: ACCESS_INCLUDE,
    });
    const data = plans.map((plan) => this.mapAccessPlan(plan));
    await this.redis.set(key, data, CATALOG_TTL_SECONDS);
    return data;
  }

  async getAccessPlan(id: string) {
    const key = `partner:catalog:access-plans:${id}`;
    const cached = await this.redis.get<ReturnType<typeof this.mapAccessPlan>>(key);
    if (cached) return cached;

    const plan = await this.prisma.accessPlan.findFirst({
      where: { id, archived: false, deletedAt: null },
      include: ACCESS_INCLUDE,
    });
    if (!plan) {
      throw partnerError(
        PARTNER_HTTP.NOT_FOUND,
        PARTNER_ERRORS.PLAN_NOT_AVAILABLE,
        'Access plan not found or not available.',
      );
    }
    const data = this.mapAccessPlan(plan);
    await this.redis.set(key, data, CATALOG_TTL_SECONDS);
    return data;
  }

  // ─── Mappers ───────────────────────────────────────────────────────────────

  private mapMembership(plan: any) {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      billingCycle: plan.billingCycle,
      platformAccess: plan.platformAccess ?? [],
      features: plan.features ?? [],
      whoItIsFor: plan.whoItIsFor,
      badge: plan.badge,
      color: plan.color,
      tiers: (plan.tiers ?? []).map((tier: any) => ({
        id: tier.id,
        tier: planTierDisplay(tier.tier as PlanTier),
        durationDays: tier.durationDays,
        fullPrice: Number(tier.fullPrice),
        features: (tier.features ?? []).map((f: any) => f.feature),
        entitlements: (tier.entitlements ?? []).map((e: any) => ({
          resourceKey: e.resourceKey,
          quotaValue: e.quotaValue,
        })),
        paymentOptions: (tier.paymentOptions ?? []).map((o: any) => ({
          paymentPlan: o.paymentPlan,
          installments: o.installments,
          mode: o.mode,
          perChargePrice: Number(o.perChargePrice),
          totalPrice: Number(o.totalPrice),
          sliceDays: o.sliceDays,
        })),
      })),
      appBundles: (plan.appBundles ?? []).map((b: any) => ({
        platform: b.platform,
        externalPlanId: b.externalPlanId,
        packageName: b.packageName,
      })),
    };
  }

  private mapAccessPlan(plan: any) {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: Number(plan.price),
      durationDays: plan.durationDays,
      platformAccess: plan.platformAccess ?? [],
      features: plan.features ?? [],
      whoItIsFor: plan.whoItIsFor,
      badge: plan.badge,
      color: plan.color,
      appBundles: (plan.appBundles ?? []).map((b: any) => ({
        platform: b.platform,
        externalPlanId: b.externalPlanId,
        packageName: b.packageName,
        durationDays: b.durationDays,
        variantTier: b.variantTier,
        limits: b.limits,
      })),
    };
  }
}
