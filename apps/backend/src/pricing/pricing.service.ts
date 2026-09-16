import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipLevel, MembershipTier, MembershipStatus } from '@prisma/client';
import {
  calculateTierExpiry,
  normalizeTier,
  getTierDurationDays,
  TierType,
} from './tier-duration.util';

/**
 * Tier price multipliers applied over the DB-stored base monthly price as fallback.
 * Standard = base, Pro = 2.5x, Pro+ = 5x.
 */
const TIER_MULTIPLIERS: Record<string, number> = { Standard: 1, Normal: 1, Pro: 2.5, 'Pro+': 5 };
const QUARTERLY_DISCOUNT = 0.1;
const YEARLY_DISCOUNT = 0.2;

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

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

    // If explicit tier pricing is configured on this membership plan, use it directly
    if (plan.tierPrices && typeof plan.tierPrices === 'object') {
      const tp = plan.tierPrices as Record<string, any>;
      const directPrice = tp[canonicalTier] ?? (canonicalTier === 'Standard' ? tp['Normal'] : undefined) ?? tp[tier];
      if (directPrice != null && typeof directPrice === 'number' && directPrice >= 0) {
        return directPrice;
      }
    }

    const baseMonthly = plan.monthlyPrice != null ? Number(plan.monthlyPrice) : Number(plan.price);

    if (billing === 'yearly' || canonicalTier === 'Pro+') {
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
    if (canonicalTier === 'Pro') {
      return Math.floor(baseMonthly * 6 * 0.85); // 6-month Pro pricing
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

  async subscribeMembership(
    businessId: string,
    level: string,
    tier: string = 'Standard',
    billing: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
    isTrial = false,
  ) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    const plan = await this.getPlan(level);
    const canonicalTier = normalizeTier(tier);
    const price = isTrial ? 0 : await this.resolveMembershipPrice(level, canonicalTier, billing);

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

    const updated = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        membershipLevel: validLevel,
        membershipPlanName: plan.name,
        membershipTier: validTier,
        membershipStatus: (isTrial ? 'trial' : 'active') as MembershipStatus,
        membershipExpiresAt: expiresAt,
      },
    });

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

    // Record EcosystemSubscription entry
    await this.prisma.ecosystemSubscription.create({
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
    });

    // Record billing transaction
    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: price,
        description: isTrial
          ? `[TRIAL] ${plan.name} (${canonicalTier}) — free trial started`
          : `Ecosystem Membership: ${plan.name} (${canonicalTier}, valid until ${expiresAt.toISOString().split('T')[0]})`,
        status: isTrial ? 'trial' : 'paid',
      },
    });

    return {
      ...updated,
      isTrial,
      billing,
      price,
      planName: plan.name,
      tier: canonicalTier,
      expiresAt,
      durationDays: getTierDurationDays(canonicalTier),
      entitlements: tierQuotas,
    };
  }

  async purchasePackage(businessId: string, platform: string, packageName: string, tier: string = 'Standard') {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    const template = await this.prisma.packageTemplate.findFirst({
      where: { platform, name: { equals: packageName, mode: 'insensitive' }, archived: false },
    });

    if (!template) {
      throw new NotFoundException(`No package template found for "${packageName}" on platform "${platform}"`);
    }

    const canonicalTier = normalizeTier(tier);
    const expiresAt = calculateTierExpiry(canonicalTier);

    // Resolve tier price
    let price = Number(template.price);
    if (template.tierPrices && typeof template.tierPrices === 'object') {
      const tp = template.tierPrices as Record<string, any>;
      const directPrice = tp[canonicalTier] ?? (canonicalTier === 'Standard' ? tp['Normal'] : undefined) ?? tp[tier];
      if (directPrice != null && typeof directPrice === 'number') {
        price = directPrice;
      }
    }

    // Resolve tier limits
    let limits = (template?.usageLimits as any) ?? {};
    if (Array.isArray(template.tierEntitlements)) {
      for (const ent of template.tierEntitlements as any[]) {
        const key = ent.resourceKey || ent.name;
        if (!key) continue;
        const val = canonicalTier === 'Pro+' ? (ent.proPlus ?? ent.pro ?? ent.standard) : canonicalTier === 'Pro' ? (ent.pro ?? ent.standard) : ent.standard;
        limits[key] = val;
      }
    }

    const billingCycle = canonicalTier === 'Pro+' ? 'Annually' : canonicalTier === 'Pro' ? '180 Days' : '90 Days';

    const platformPackage = await this.prisma.platformPackage.upsert({
      where: {
        businessId_platform: {
          businessId,
          platform,
        },
      },
      update: {
        packageName: template.name,
        limits,
        status: 'active',
        amount: price,
        currency: 'GBP',
        billingCycle,
        expiresAt,
      },
      create: {
        businessId,
        platform,
        packageName: template.name,
        limits,
        status: 'active',
        amount: price,
        currency: 'GBP',
        billingCycle,
        expiresAt,
      },
    });

    // Record in ecosystem subscriptions
    await this.prisma.ecosystemSubscription.create({
      data: {
        businessId,
        businessName: business.businessName,
        type: 'Package',
        itemName: `${platform} - ${packageName} (${canonicalTier})`,
        status: 'Active',
        startDate: new Date(),
        endDate: expiresAt,
        amount: price,
        billingCycle,
      },
    });

    // Create billing transaction
    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: price,
        description: `Platform Package purchase: ${platform} - ${packageName} (${canonicalTier})`,
        status: 'paid',
      },
    });

    return platformPackage;
  }

  async getTransactions(businessId: string) {
    return this.prisma.billingTransaction.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }
}