import { Injectable, NotFoundException, ConflictException, Logger, Optional, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TASK_EVENT_QUEUE, TaskEventJobData } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CouponService, CouponChargeQuote } from '../coupon/coupon.service';
import { EcosystemEventsService } from '../ecosystem-events/ecosystem-events.service';
import { MembershipLevel, MembershipTier, MembershipStatus, Prisma, PlanTier, MembershipPaymentPlan, PaymentPriceMode } from '@prisma/client';
import {
  addDaysUtc,
  calculateTierExpiry,
  normalizeTier,
  getTierDurationDays,
  TierType,
} from './tier-duration.util';
import {
  allowedSplit,
  normalizePaymentPlan,
  normalizePlanTier,
  planTierDisplay,
  planTierLabel,
  resolveOptionPrice,
} from './payment-option.util';

/**
 * Phase 2: provider linkage for payment idempotency. Trials were removed —
 * every activation must be backed by a real payment (or an admin manual grant).
 */
export interface MembershipActivationOpts {
  provider?: string;
  providerPaymentId?: string;
  /** Non-full plans activate pay-as-you-go: each charge extends access by the option's slice. */
  paymentPlan?: string;
  /** Actual amount charged after an optional coupon discount. */
  chargedAmount?: number;
  /** Coupon metadata persisted alongside the activation. */
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string;
  couponRedemptionId?: string;
  /**
   * Partner grants: explicit term length in calendar days. Defaults to the
   * tier's canonical duration (`calculateTierExpiry`).
   */
  durationDays?: number;
  /** Partner grants: term start (e.g. current expiry + 1 for stacking). */
  baseDate?: Date;
  /** Provenance marker (e.g. 'mcom-rewards'). */
  source?: string;
  /** Reward-funded grants may legitimately charge 0. */
  allowZeroAmount?: boolean;
  /** Extra audit metadata persisted on the BillingTransaction row. */
  metadata?: Record<string, unknown>;
}

export interface MembershipChargeQuote {
  planId: string;
  planName: string;
  tier: string;
  paymentPlan: MembershipPaymentPlan;
  installments: number;
  sliceDays: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: 'GBP';
  coupon: CouponChargeQuote['coupon'] | null;
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
    private readonly couponService: CouponService,
    private readonly events: EcosystemEventsService,
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

  /**
   * Quote a membership payment option from the relational tables.
   * Falls back to the legacy single-charge price when a plan has no tier
   * rows yet (e.g. created before the relational remodel), so quotes never
   * break on old data. Checkout must display these numbers — never recompute.
   */
  async resolvePaymentQuote(
    level: string,
    tier: string = 'Standard',
    paymentPlan: string = 'full',
  ) {
    const plan = await this.getPlan(level);
    const canonical = normalizeTier(tier);
    const planTier = normalizePlanTier(tier);
    const tierKey = planTierLabel(planTier);
    const wanted = normalizePaymentPlan(paymentPlan);
    const split = allowedSplit(tierKey, wanted);
    if (!split) {
      throw new BadRequestException(
        `The ${paymentPlan} payment option is not available for the ${canonical} tier.`,
      );
    }

    const tierRow = await this.prisma.membershipPlanTier.findFirst({
      where: { planId: plan.id, tier: planTier },
      include: { paymentOptions: { where: { isActive: true } } },
    });

    if (tierRow) {
      const option = tierRow.paymentOptions.find((o) => o.paymentPlan === wanted);
      if (!option) {
        throw new BadRequestException(
          `The ${paymentPlan} payment option is not available for the ${canonical} tier right now. Please choose another option.`,
        );
      }
      return {
        planId: plan.id,
        planName: plan.name,
        tier: canonical,
        paymentPlan: wanted,
        perChargePrice: Number(option.perChargePrice),
        totalPrice: Number(option.totalPrice),
        installments: option.installments,
        sliceDays: option.sliceDays,
        mode: option.mode,
        currency: 'GBP',
      };
    }

    // Legacy fallback: today's single charge grants the whole term, so the
    // legacy price IS the outright (full) price; splits divide it, no surcharge.
    const full = await this.resolveMembershipPrice(plan.name, canonical, 'monthly');
    if (wanted === MembershipPaymentPlan.full) {
      return {
        planId: plan.id,
        planName: plan.name,
        tier: canonical,
        paymentPlan: wanted,
        perChargePrice: full,
        totalPrice: full,
        installments: 1,
        sliceDays: getTierDurationDays(canonical),
        mode: PaymentPriceMode.manual,
        currency: 'GBP',
      };
    }
    const { perChargePrice, totalPrice } = resolveOptionPrice(
      full,
      split.installments,
      PaymentPriceMode.auto,
      null,
      0,
    );
    return {
      planId: plan.id,
      planName: plan.name,
      tier: canonical,
      paymentPlan: wanted,
      perChargePrice,
      totalPrice,
      installments: split.installments,
      sliceDays:
        split.sliceDays === 'duration' ? getTierDurationDays(canonical) : split.sliceDays,
      mode: PaymentPriceMode.auto,
      currency: 'GBP',
    };
  }

  /**
   * Resolve the amount charged today for a membership payment, including an
   * optional coupon discount. This is the single source of truth used by the
   * checkout quote, Stripe, PayPal and the webhook reconciliation path.
   */
  async resolveMembershipCharge(
    level: string,
    tier: string = 'Standard',
    billing: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
    paymentPlan: string = 'full',
    couponCode?: string,
    userId?: string,
  ): Promise<MembershipChargeQuote> {
    const plan = await this.getPlan(level);
    const canonical = normalizeTier(tier);
    const planTier = normalizePlanTier(tier);
    const tierKey = planTierLabel(planTier);
    const wanted = normalizePaymentPlan(paymentPlan);
    const split = allowedSplit(tierKey, wanted);
    if (!split) {
      throw new BadRequestException(
        `The ${paymentPlan} payment option is not available for the ${canonical} tier.`,
      );
    }

    const tierRow = await this.prisma.membershipPlanTier.findFirst({
      where: { planId: plan.id, tier: planTier },
      include: { paymentOptions: { where: { isActive: true } } },
    });

    let originalAmount: number;
    let installments: number;
    let sliceDays: number;

    if (tierRow) {
      const option = tierRow.paymentOptions.find((o) => o.paymentPlan === wanted);
      if (!option) {
        throw new BadRequestException(
          `The ${paymentPlan} payment option is not available for the ${canonical} tier right now. Please choose another option.`,
        );
      }
      originalAmount = Number(option.perChargePrice);
      installments = option.installments;
      sliceDays = option.sliceDays;
    } else {
      const full = await this.resolveMembershipPrice(
        plan.name,
        canonical,
        wanted === MembershipPaymentPlan.full ? billing : 'monthly',
      );
      if (wanted === MembershipPaymentPlan.full) {
        originalAmount = full;
        installments = 1;
        sliceDays = getTierDurationDays(canonical);
      } else {
        const priced = resolveOptionPrice(
          full,
          split.installments,
          PaymentPriceMode.auto,
          null,
          0,
        );
        originalAmount = priced.perChargePrice;
        installments = split.installments;
        sliceDays =
          split.sliceDays === 'duration'
            ? getTierDurationDays(canonical)
            : split.sliceDays;
      }
    }

    const couponQuote = couponCode
      ? await this.couponService.validateForCharge({
          code: couponCode,
          userId: userId ?? '',
          planId: plan.id,
          amount: originalAmount,
        })
      : null;

    return {
      planId: plan.id,
      planName: plan.name,
      tier: canonical,
      paymentPlan: wanted,
      installments,
      sliceDays,
      originalAmount: couponQuote?.originalAmount ?? originalAmount,
      discountAmount: couponQuote?.discountAmount ?? 0,
      finalAmount: couponQuote?.finalAmount ?? originalAmount,
      currency: 'GBP',
      coupon: couponQuote?.coupon ?? null,
    };
  }

  async getPlans() {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { archived: false },
      orderBy: { price: 'asc' },
      include: {
        tiers: {
          orderBy: { sortOrder: 'asc' },
          include: {
            paymentOptions: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
            features: { orderBy: { sortOrder: 'asc' } },
            entitlements: true,
          },
        },
        appBundles: true,
      },
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
        tiers: (p.tiers ?? []).map((t) => ({
          tier: planTierDisplay(t.tier),
          durationDays: t.durationDays,
          fullPrice: Number(t.fullPrice),
          features: (t.features ?? []).map((f) => f.feature),
          entitlements: (t.entitlements ?? []).map((e) => ({
            resourceKey: e.resourceKey,
            quotaValue: e.quotaValue,
          })),
          paymentOptions: (t.paymentOptions ?? []).map((o) => ({
            paymentPlan: o.paymentPlan,
            installments: o.installments,
            mode: o.mode,
            perChargePrice: Number(o.perChargePrice),
            totalPrice: Number(o.totalPrice),
            sliceDays: o.sliceDays,
          })),
        })),
        appBundles: (p.appBundles ?? []).map((b) => ({
          platform: b.platform,
          externalPlanId: b.externalPlanId,
          packageName: b.packageName,
        })),
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
    const listPrice = await this.resolveMembershipPrice(level, canonicalTier, billing);
    const price =
      opts.chargedAmount !== undefined
        ? Math.round((opts.chargedAmount + Number.EPSILON) * 100) / 100
        : listPrice;
    const couponSuffix =
      opts.couponCode && opts.discountAmount
        ? `, coupon ${opts.couponCode} -£${Number(opts.discountAmount).toFixed(2)}`
        : '';

    const enumLevels = Object.values(MembershipLevel);
    const validLevel = enumLevels.includes(plan.name as MembershipLevel)
      ? (plan.name as MembershipLevel)
      : MembershipLevel.Bronze;

    let validTier: MembershipTier = MembershipTier.Normal;
    if (canonicalTier === 'Pro') validTier = MembershipTier.Pro;
    else if (canonicalTier === 'Pro+') validTier = MembershipTier.ProPlus;
    else validTier = MembershipTier.Normal; // Normal maps to Standard in DB enum

    // Calculate leap-year aware expiry date. Partner grants may override the
    // duration and/or stack from a future base date.
    const activationStart = opts.baseDate ? new Date(opts.baseDate) : new Date();
    const explicitDays = Number(opts.durationDays);
    const expiresAt =
      Number.isFinite(explicitDays) && explicitDays > 0
        ? addDaysUtc(activationStart, explicitDays)
        : calculateTierExpiry(canonicalTier, activationStart);

    // Idempotent replay: same payment reference seen before.
    if (opts.providerPaymentId) {
      const existing = await this.prisma.billingTransaction.findUnique({
        where: { providerPaymentId: opts.providerPaymentId },
      });
      if (existing) {
        return this.resolveMembershipReplay(existing, businessId, price);
      }
    }

    // Partitioned payment: each charge extends access by the option's slice
    // instead of unlocking the whole term (see subscribeMembershipInstallment).
    const wantedPlan = normalizePaymentPlan(opts.paymentPlan ?? 'full');
    if (wantedPlan !== MembershipPaymentPlan.full) {
      return this.subscribeMembershipInstallment(
        business,
        plan,
        canonicalTier,
        validLevel,
        validTier,
        wantedPlan,
        billing,
        opts,
      );
    }

    let updated;
    try {
      const activation = await this.prisma.$transaction(async (tx) => {
        const profileUpdate = await tx.businessProfile.update({
          where: { id: businessId },
          data: {
            membershipLevel: validLevel,
            membershipPlanName: plan.name,
            membershipTier: validTier,
            membershipStatus: 'active' as MembershipStatus,
            membershipExpiresAt: expiresAt,
          },
        });
        // Record EcosystemSubscription entry
        await tx.ecosystemSubscription.create({
          data: {
            businessId,
            businessName: business.businessName,
            type: 'Membership',
            itemName: `${plan.name} (${canonicalTier})`,
            status: 'Active',
            startDate: activationStart,
            endDate: expiresAt,
            amount: price,
            billingCycle: canonicalTier === 'Pro+' ? 'Annually' : canonicalTier === 'Pro' ? '180 Days' : '90 Days',
          },
        });
        // Record billing transaction (idempotency key when backed by a provider payment)
        const billing = await tx.billingTransaction.create({
          data: {
            businessId,
            amount: price,
            description: `Ecosystem Membership: ${plan.name} (${canonicalTier}, valid until ${expiresAt.toISOString().split('T')[0]})${couponSuffix}`,
            status: 'paid',
            provider: opts.provider ?? null,
            providerPaymentId: opts.providerPaymentId ?? null,
            metadata: (opts.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        if (opts.couponRedemptionId) {
          await this.couponService.completeRedemption(
            tx,
            opts.couponRedemptionId,
            billing.id,
            { businessId },
          );
        }
        return { profileUpdate, billingId: billing.id };
      });
      updated = activation.profileUpdate;
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

    const tierQuotas = await this.finalizeMembershipActivation({
      updatedUserId: updated?.userId ?? null,
      businessId,
      planName: plan.name,
      tierEntitlements: plan.tierEntitlements,
      includedApps: plan.includedApps,
      canonicalTier,
      validLevel,
      billing,
      price,
      expiresAt,
    });

    // Post-commit lifecycle event (never blocks the response).
    if (opts.couponRedemptionId) {
      void this.events.emitCouponRedeemedForRedemption(opts.couponRedemptionId);
    }

    return {
      ...updated,
      billing,
      price,
      planName: plan.name,
      tier: canonicalTier,
      startsAt: activationStart,
      expiresAt,
      durationDays: Number.isFinite(explicitDays) && explicitDays > 0
        ? explicitDays
        : getTierDurationDays(canonicalTier, activationStart),
      entitlements: tierQuotas,
    };
  }

  /**
   * Shared tail for both activation paths: task-engine event, tier quota
   * extraction and bundled platform-package provisioning. Returns the
   * tier quotas for the response envelope.
   */
  private async finalizeMembershipActivation(input: {
    updatedUserId?: string | null;
    businessId: string;
    planName: string;
    tierEntitlements: unknown;
    includedApps: unknown;
    canonicalTier: TierType;
    validLevel: MembershipLevel;
    billing: string;
    price: number;
    expiresAt: Date;
  }): Promise<Record<string, any>> {
    const {
      updatedUserId,
      businessId,
      planName,
      tierEntitlements,
      includedApps: rawApps,
      canonicalTier,
      validLevel,
      billing,
      expiresAt,
    } = input;

    if (this.taskEventQueue && updatedUserId) {
      this.taskEventQueue
        .add(
          'evaluate-task',
          {
            userId: updatedUserId,
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
            jobId: `task-event-membership-${updatedUserId}-${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          },
        )
        .catch((err) => this.logger.warn('Failed to emit task event for membership:', err));
    }

    // Extract tier-specific quotas from tierEntitlements
    const tierQuotas: Record<string, any> = {};
    if (Array.isArray(tierEntitlements)) {
      for (const ent of tierEntitlements as any[]) {
        const key = ent.resourceKey || ent.name;
        if (!key) continue;
        const val = canonicalTier === 'Pro+' ? (ent.proPlus ?? ent.pro ?? ent.standard) : canonicalTier === 'Pro' ? (ent.pro ?? ent.standard) : ent.standard;
        tierQuotas[key] = val;
      }
    }

    // Cross-Platform Multi-App Package Auto-Provisioning
    const includedApps = Array.isArray(rawApps) ? (rawApps as any[]) : [];

    for (const app of includedApps) {
      const platformName = app.platform || app.platformName || 'MCOM Solutions';
      const packageName = app.planName || app.name || `${planName} (${canonicalTier})`;
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

    return tierQuotas;
  }

  /**
   * Pay-as-you-go activation for one instalment step. Each successful charge
   * extends `membershipExpiresAt` by the option's slice; the final step tops
   * up to the exact full-term expiry. Runs in an interactive transaction with
   * a row lock on the business so concurrent steps can never lose an extension.
   */
  private async subscribeMembershipInstallment(
    business: { id: string; businessName: string },
    plan: { id: string; name: string; tierEntitlements: unknown; includedApps: unknown },
    canonicalTier: TierType,
    validLevel: MembershipLevel,
    validTier: MembershipTier,
    wantedPlan: MembershipPaymentPlan,
    billing: 'monthly' | 'quarterly' | 'yearly',
    opts: MembershipActivationOpts,
  ) {
    const planTier = normalizePlanTier(canonicalTier);
    const option = await this.prisma.membershipPaymentOption.findFirst({
      where: {
        paymentPlan: wantedPlan,
        isActive: true,
        tier: { planId: plan.id, tier: planTier },
      },
    });
    if (!option) {
      throw new BadRequestException(
        `The selected payment option is not available for the ${canonicalTier} tier right now. Please choose another option.`,
      );
    }
    const price =
      opts.chargedAmount !== undefined
        ? Math.round((opts.chargedAmount + Number.EPSILON) * 100) / 100
        : Number(option.perChargePrice);
    const couponSuffix =
      opts.couponCode && opts.discountAmount
        ? `, coupon ${opts.couponCode} -£${Number(opts.discountAmount).toFixed(2)}`
        : '';
    const planLabel =
      wantedPlan === MembershipPaymentPlan.monthly
        ? 'Monthly'
        : wantedPlan === MembershipPaymentPlan.quarterly
          ? 'Quarterly'
          : 'Half-yearly';

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent steps for this business (no lost extensions).
      await tx.$queryRaw`SELECT "id" FROM "business_profiles" WHERE "id" = ${business.id} FOR UPDATE`;

      if (opts.providerPaymentId) {
        const existing = await tx.billingTransaction.findUnique({
          where: { providerPaymentId: opts.providerPaymentId },
        });
        if (existing) {
          return { replay: await this.resolveMembershipReplay(existing, business.id, price) };
        }
      }

      const fresh = await tx.businessProfile.findFirst({
        where: { id: business.id, deletedAt: null },
      });
      if (!fresh) {
        throw new NotFoundException('Business profile not found');
      }

      const openSub = await tx.membershipInstallmentSubscription.findFirst({
        where: {
          businessId: business.id,
          paymentOptionId: option.id,
          status: { in: ['active', 'past_due'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const now = new Date();
      let installmentNo: number;
      let termStart: Date;
      let base: Date;
      let continuedSubId: string | null = null;
      if (openSub && openSub.installmentsPaid < openSub.installmentsTotal) {
        installmentNo = openSub.installmentsPaid + 1;
        termStart = openSub.createdAt;
        continuedSubId = openSub.id;
        base =
          fresh.membershipExpiresAt && fresh.membershipExpiresAt > now
            ? fresh.membershipExpiresAt
            : now;
      } else {
        if (openSub) {
          await tx.membershipInstallmentSubscription.update({
            where: { id: openSub.id },
            data: { status: 'completed' },
          });
        }
        installmentNo = 1;
        termStart = now;
        base = now;
      }

      const isFinal = installmentNo >= option.installments;
      let expiresAt = isFinal
        ? calculateTierExpiry(canonicalTier, termStart)
        : addDaysUtc(base, option.sliceDays);
      if (expiresAt.getTime() < base.getTime()) {
        // Safety: access never moves backwards.
        expiresAt = base;
      }

      const updated = await tx.businessProfile.update({
        where: { id: business.id },
        data: {
          membershipLevel: validLevel,
          membershipPlanName: plan.name,
          membershipTier: validTier,
          membershipStatus: 'active' as MembershipStatus,
          membershipExpiresAt: expiresAt,
        },
      });
      await tx.ecosystemSubscription.create({
        data: {
          businessId: business.id,
          businessName: business.businessName,
          type: 'Membership',
          itemName: `${plan.name} (${canonicalTier})`,
          status: 'Active',
          startDate: new Date(),
          endDate: expiresAt,
          amount: price,
          billingCycle: `${planLabel} instalment ${installmentNo} of ${option.installments}`,
        },
      });
      const billing = await tx.billingTransaction.create({
        data: {
          businessId: business.id,
          amount: price,
          description: `Ecosystem Membership: ${plan.name} (${canonicalTier}, ${planLabel.toLowerCase()} instalment ${installmentNo} of ${option.installments}, access until ${expiresAt.toISOString().split('T')[0]})${couponSuffix}`,
          status: 'paid',
          provider: opts.provider ?? null,
          providerPaymentId: opts.providerPaymentId ?? null,
        },
      });
      if (opts.couponRedemptionId) {
        await this.couponService.completeRedemption(tx, opts.couponRedemptionId, billing.id, {
          businessId: business.id,
        });
      }
      if (continuedSubId) {
        await tx.membershipInstallmentSubscription.update({
          where: { id: continuedSubId },
          data: {
            installmentsPaid: installmentNo,
            status: isFinal ? 'completed' : 'active',
            currentPeriodEnd: expiresAt,
            nextDueAt: isFinal ? null : expiresAt,
          },
        });
      } else {
        await tx.membershipInstallmentSubscription.create({
          data: {
            businessId: business.id,
            tierId: option.tierId,
            paymentOptionId: option.id,
            installmentsTotal: option.installments,
            installmentsPaid: 1,
            status: isFinal ? 'completed' : 'active',
            currentPeriodEnd: expiresAt,
            nextDueAt: isFinal ? null : expiresAt,
          },
        });
      }
      return { updated, installmentNo, expiresAt };
    });

    if ('replay' in result) {
      return result.replay;
    }

    if (opts.couponRedemptionId) {
      void this.events.emitCouponRedeemedForRedemption(opts.couponRedemptionId);
    }

    const tierQuotas = await this.finalizeMembershipActivation({
      updatedUserId: result.updated.userId ?? null,
      businessId: business.id,
      planName: plan.name,
      tierEntitlements: plan.tierEntitlements,
      includedApps: plan.includedApps,
      canonicalTier,
      validLevel,
      billing: `${planLabel} ${result.installmentNo}/${option.installments}`,
      price,
      expiresAt: result.expiresAt,
    });

    return {
      ...result.updated,
      billing,
      price,
      planName: plan.name,
      tier: canonicalTier,
      expiresAt: result.expiresAt,
      durationDays: getTierDurationDays(canonicalTier),
      entitlements: tierQuotas,
      paymentPlan: wantedPlan,
      installmentNo: result.installmentNo,
      installmentsTotal: option.installments,
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
    const [ecosystemSubs, platformPackages, recurring] = await Promise.all([
      this.prisma.ecosystemSubscription.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.platformPackage.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recurringSubscription.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          scope: true,
          provider: true,
          planName: true,
          platform: true,
          amount: true,
          currency: true,
          status: true,
          autoRenew: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
          nextChargeAt: true,
          lastError: true,
        },
      }),
    ]);
    return {
      subscriptions: ecosystemSubs,
      packages: platformPackages,
      recurring,
    };
  }
}