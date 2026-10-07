import { Injectable, NotFoundException, ConflictException, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TASK_EVENT_QUEUE, TaskEventJobData } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipLevel, MembershipTier, MembershipStatus, Prisma } from '@prisma/client';
import {
  calculateTierExpiry,
  normalizeTier,
  getTierDurationDays,
  TierType,
} from './tier-duration.util';

/**
 * Phase 2: provider linkage for payment idempotency. Trials were removed —
 * every activation must be backed by a real payment (or an admin manual grant).
 */
export interface MembershipActivationOpts {
  provider?: string;
  providerPaymentId?: string;
}

/**
 * Tier price multipliers applied over the DB-stored base monthly price as fallback.
 * Standard = base, Pro = 2.5x, Pro+ = 5x.
 */
const TIER_MULTIPLIERS: Record<string, number> = { Standard: 1, Normal: 1, Pro: 2.5, 'Pro+': 5 };
const QUARTERLY_DISCOUNT = 0.1;
const YEARLY_DISCOUNT = 0.2;

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private prisma: PrismaService,
    @Optional()
    @InjectQueue(TASK_EVENT_QUEUE)
    private readonly taskEventQueue?: Queue<TaskEventJobData>,
  ) {}

  private tierMultiplier(tier: string): number {
    const canonical = normalizeTier(tier);
    return TIER_MULTIPLIERS[canonical] ?? 1;
  }

  private async getPlan(levelOrId: string) {
    const plan = await this.prisma.membershipPlan.findFirst({
      where: {
        OR: [
          { id: levelOrId },
          { name: { equals: levelOrId, mode: 'insensitive' } },
        ],
        archived: false,
      },
    });
    if (!plan) {
      throw new NotFoundException(`Plan '${levelOrId}' does not exist`);
    }
    return plan;
  }

  async resolveMembershipPrice(
    level: string,
    tier: string = 'Standard',
    billing: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
  ): Promise<number> {
    const plan = await this.getPlan(level);
    const canonicalTier = normalizeTier(tier);
    const baseMonthly = plan.monthlyPrice != null ? Number(plan.monthlyPrice) : Number(plan.price);

    // 1. Explicit sub-tier pricing (Pro+ annual package or Pro 6-month package)
    if (canonicalTier === 'Pro+') {
      const proPlusPrice = (plan.tierPrices as any)?.['Pro+'] ?? (plan.tierPrices as any)?.['ProPlus'];
      if (proPlusPrice != null && typeof proPlusPrice === 'number' && proPlusPrice >= 0) {
        return proPlusPrice;
      }
      if (plan.annualPrice != null) {
        return Number(plan.annualPrice);
      }
      return Math.floor(baseMonthly * (1 - YEARLY_DISCOUNT)) * 12;
    }

    if (canonicalTier === 'Pro') {
      const proPrice = (plan.tierPrices as any)?.['Pro'];
      if (proPrice != null && typeof proPrice === 'number' && proPrice >= 0 && billing === 'monthly') {
        return proPrice;
      }
      return Math.floor(baseMonthly * 6 * 0.85); // 6-month Pro pricing
    }

    // 2. Standard tier billing cycles (Yearly, Quarterly, Monthly)
    if (billing === 'yearly') {
      if (plan.annualPrice != null) {
        return Number(plan.annualPrice);
      }
      return Math.floor(baseMonthly * (1 - YEARLY_DISCOUNT)) * 12;
    }

    if (billing === 'quarterly') {
      if (plan.quarterlyPrice != null) {
        return Number(plan.quarterlyPrice);
      }
      return Math.floor(baseMonthly * (1 - QUARTERLY_DISCOUNT)) * 3;
    }

    // Monthly billing: check explicit tierPrices override, fallback to base monthly
    if (plan.tierPrices && typeof plan.tierPrices === 'object') {
      const tp = plan.tierPrices as Record<string, any>;
      const directPrice = tp[canonicalTier] ?? tp['Normal'] ?? tp[tier];
      if (directPrice != null && typeof directPrice === 'number' && directPrice >= 0) {
        return directPrice;
      }
    }

    return Math.round(baseMonthly);
  }

  async getPlans() {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { archived: false },
      orderBy: { price: 'asc' },
    });

    return plans.map((p) => {
      const baseMonthly = p.monthlyPrice != null ? Math.round(Number(p.monthlyPrice)) : Math.round(Number(p.price));
      const quarterlyPrice = p.quarterlyPrice != null ? Math.round(Number(p.quarterlyPrice)) : Math.floor(baseMonthly * (1 - QUARTERLY_DISCOUNT)) * 3;
      const annualPrice = p.annualPrice != null ? Math.round(Number(p.annualPrice)) : Math.floor(baseMonthly * (1 - YEARLY_DISCOUNT)) * 12;

      const features = Array.isArray(p.features) && p.features.length > 0
        ? p.features
        : Array.isArray(p.permissions) && p.permissions.length > 0
        ? p.permissions
        : ['Core Ecosystem Access'];

      return {
        id: p.name,
        planId: p.id,
        name: p.name,
        description: p.description,
        whoItIsFor: p.whoItIsFor || 'Businesses',
        badge: p.badge || (p.name.toLowerCase() === 'gold' ? 'MOST POPULAR' : ''),
        color: p.color || (p.name.toLowerCase() === 'gold' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700 bg-gray-50'),
        price: baseMonthly,
        monthlyPrice: baseMonthly,
        quarterlyPrice,
        annualPrice,
        features,
        tierPrices: p.tierPrices || { Standard: baseMonthly, Pro: Math.round(baseMonthly * 2.5), 'Pro+': Math.round(baseMonthly * 5) },
        tierFeatures: p.tierFeatures || { Standard: features, Pro: features, 'Pro+': features },
        tierEntitlements: p.tierEntitlements || [],
        tierDurations: p.tierDurations || { Standard: 90, Pro: 180, 'Pro+': 365 },
        includedApps: Array.isArray(p.includedApps) ? p.includedApps : [],
        billingCycle: p.billingCycle,
        platformAccess: p.platformAccess || [],
      };
    });
  }

  /**
   * Phase 2: idempotent, ledger-backed activation. `providerPaymentId` is the
   * idempotency key (Stripe payment intent ID / PayPal order ID / manual grant ID).
   * Replays return the current state (200); mismatched business/amount → 409.
   * Trials no longer exist — every call path must be backed by a real payment.
   */
  async subscribeMembership(
    businessId: string,
    level: string,
    tier: string = 'Standard',
    billing: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
    opts: MembershipActivationOpts = {},
  ) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    const plan = await this.getPlan(level);
    const canonicalTier = normalizeTier(tier);
    const price = await this.resolveMembershipPrice(level, canonicalTier, billing);

    const enumLevels = Object.values(MembershipLevel);
    const validLevel = enumLevels.includes(plan.name as MembershipLevel)
      ? (plan.name as MembershipLevel)
      : MembershipLevel.Bronze;

    let validTier: MembershipTier = MembershipTier.Normal;
    if (canonicalTier === 'Pro') validTier = MembershipTier.Pro;
    else if (canonicalTier === 'Pro+') validTier = MembershipTier.ProPlus;
    else validTier = MembershipTier.Normal; // Normal maps to Standard in DB enum

    // Calculate leap-year aware expiry date
    const expiresAt = calculateTierExpiry(canonicalTier);

    // Idempotent replay: same payment reference seen before.
    if (opts.providerPaymentId) {
      const existing = await this.prisma.billingTransaction.findUnique({
        where: { providerPaymentId: opts.providerPaymentId },
      });
      if (existing) {
        return this.resolveMembershipReplay(existing, businessId, price);
      }
    }

    let updated;
    try {
      const [profileUpdate] = await this.prisma.$transaction([
        this.prisma.businessProfile.update({
          where: { id: businessId },
          data: {
            membershipLevel: validLevel,
            membershipPlanName: plan.name,
            membershipTier: validTier,
            membershipStatus: 'active' as MembershipStatus,
            membershipExpiresAt: expiresAt,
          },
        }),
        // Record EcosystemSubscription entry
        this.prisma.ecosystemSubscription.create({
          data: {
            businessId,
            businessName: business.businessName,
            type: 'Membership',
            itemName: `${plan.name} (${canonicalTier})`,
            status: 'Active',
            startDate: new Date(),
            endDate: expiresAt,
            amount: price,
            billingCycle: canonicalTier === 'Pro+' ? 'Annually' : canonicalTier === 'Pro' ? '180 Days' : '90 Days',
          },
        }),
        // Record billing transaction (idempotency key when backed by a provider payment)
        this.prisma.billingTransaction.create({
          data: {
            businessId,
            amount: price,
            description: `Ecosystem Membership: ${plan.name} (${canonicalTier}, valid until ${expiresAt.toISOString().split('T')[0]})`,
            status: 'paid',
            provider: opts.provider ?? null,
            providerPaymentId: opts.providerPaymentId ?? null,
          },
        }),
      ]);
      updated = profileUpdate;
    } catch (err) {
      // Lost the race with a concurrent activation using the same payment reference.
      if (
        opts.providerPaymentId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.billingTransaction.findUnique({
          where: { providerPaymentId: opts.providerPaymentId },
        });
        if (existing) {
          return this.resolveMembershipReplay(existing, businessId, price);
        }
      }
      throw err;
    }

    if (this.taskEventQueue && updated?.userId) {
      this.taskEventQueue
        .add(
          'evaluate-task',
          {
            userId: updated.userId,
            userType: 'BUSINESS',
            featureKey: 'business.membership_purchased',
            meta: {
              level: validLevel,
              tier: canonicalTier,
              billing,
              timestamp: new Date().toISOString(),
            },
          },
          {
            jobId: `task-event-membership-${updated.userId}-${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        )
        .catch((err) => this.logger.warn('Failed to emit task event for membership:', err));
    }

    // Extract tier-specific quotas from tierEntitlements
    const tierQuotas: Record<string, any> = {};
    if (Array.isArray(plan.tierEntitlements)) {
      for (const ent of plan.tierEntitlements as any[]) {
        const key = ent.resourceKey || ent.name;
        if (!key) continue;
        const val = canonicalTier === 'Pro+' ? (ent.proPlus ?? ent.pro ?? ent.standard) : canonicalTier === 'Pro' ? (ent.pro ?? ent.standard) : ent.standard;
        tierQuotas[key] = val;
      }
    }

    // Cross-Platform Multi-App Package Auto-Provisioning
    const includedApps = Array.isArray(plan.includedApps) ? (plan.includedApps as any[]) : [];

    for (const app of includedApps) {
      const platformName = app.platform || app.platformName || 'MCOM Solutions';
      const packageName = app.planName || app.name || `${plan.name} (${canonicalTier})`;
      let externalPlanId = app.planId || app.id || null;

      // Extract tier-specific app quotas & feature flags if the app has 3-tier variant configuration
      let appTierLimits = app.quotas || app.limits || app.usageLimits || {};

      if (Array.isArray(app.variants) && app.variants.length > 0) {
        const matchingVariant = app.variants.find((v: any) => {
          const t = String(v.tier || v.tierLevel?.name || '').toUpperCase().replace('-', '_');
          const target = canonicalTier === 'Pro+' ? 'PRO_PLUS' : canonicalTier.toUpperCase();
          return t === target || t === canonicalTier.toUpperCase();
        });
        if (matchingVariant) {
          externalPlanId = matchingVariant.id || externalPlanId;
          appTierLimits = {
            ...appTierLimits,
            ...(matchingVariant.configuration?.quotas || {}),
            ...(matchingVariant.configuration?.featureFlags || {}),
          };
        }
      } else if (app.tierQuotas && typeof app.tierQuotas === 'object') {
        const tq = app.tierQuotas[canonicalTier] || app.tierQuotas[canonicalTier === 'Standard' ? 'Normal' : canonicalTier] || {};
        appTierLimits = { ...appTierLimits, ...tq };
      }

      const limits = { ...appTierLimits, ...tierQuotas };

      await this.prisma.platformPackage.upsert({
        where: {
          businessId_platform: {
            businessId,
            platform: platformName,
          },
        },
        create: {
          businessId,
          platform: platformName,
          packageName,
          externalPlanId,
          status: 'active',
          limits,
          amount: 0,
          currency: 'GBP',
          billingCycle: canonicalTier === 'Pro+' ? 'Annually' : canonicalTier === 'Pro' ? '180 Days' : '90 Days',
          expiresAt,
        },
        update: {
          packageName,
          externalPlanId,
          status: 'active',
          limits,
          billingCycle: canonicalTier === 'Pro+' ? 'Annually' : canonicalTier === 'Pro' ? '180 Days' : '90 Days',
          expiresAt,
        },
      });
    }

    return {
      ...updated,
      billing,
      price,
      planName: plan.name,
      tier: canonicalTier,
      expiresAt,
      durationDays: getTierDurationDays(canonicalTier),
      entitlements: tierQuotas,
    };
  }

  /**
   * Shared replay/conflict resolution for an already-processed payment reference.
   * Same business + same amount → current state (idempotent 200).
   * Anything else → 409 Conflict + security log (possible order hijacking).
   */
  private async resolveMembershipReplay(
    existing: { businessId: string; amount: number },
    businessId: string,
    price: number,
  ) {
    if (existing.businessId !== businessId) {
      this.logger.warn(
        `Payment replay conflict: reference already processed for business ${existing.businessId}, replay attempted by ${businessId}`,
      );
      throw new ConflictException('This payment has already been processed for a different business.');
    }
    if (Math.abs(existing.amount - price) > 0.005) {
      this.logger.warn(
        `Payment replay conflict: reference amount ${existing.amount} does not match expected ${price} for business ${businessId}`,
      );
      throw new ConflictException('This payment has already been processed for a different amount.');
    }
    const current = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
    });
    return { ...(current ?? { id: businessId }), replayed: true, price: existing.amount };
  }

  // purchasePackage + getPackageTemplates — REMOVED (memberships-only model).
  // Standalone packages are bought on the console-registered external platforms
  // themselves, not here. Membership purchase/activation below is unchanged.

  async getTransactions(businessId: string) {
    return this.prisma.billingTransaction.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubscriptions(businessId: string) {
    const [ecosystemSubs, platformPackages] = await Promise.all([
      this.prisma.ecosystemSubscription.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformPackage.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      subscriptions: ecosystemSubs,
      packages: platformPackages,
    };
  }
}