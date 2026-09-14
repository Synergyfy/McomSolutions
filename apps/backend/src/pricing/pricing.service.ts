import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipLevel, MembershipTier, MembershipStatus } from '@prisma/client';

/**
 * Tier price multipliers applied over the DB-stored base monthly price.
 * Normal = base, Pro = 2.5x, Pro+ = 5x. The base price is the source of truth
 * in the `membership_plans` table (admin-editable).
 */
const TIER_MULTIPLIERS: Record<string, number> = { Normal: 1, Pro: 2.5, 'Pro+': 5 };
const QUARTERLY_DISCOUNT = 0.1;
const YEARLY_DISCOUNT = 0.2;

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  private tierMultiplier(tier: string): number {
    return TIER_MULTIPLIERS[tier] ?? 1;
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
    tier: string = 'Normal',
    billing: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
  ): Promise<number> {
    const plan = await this.getPlan(level);
    const baseMonthly = plan.monthlyPrice != null ? Number(plan.monthlyPrice) : Number(plan.price);

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
        includedApps: Array.isArray(p.includedApps) ? p.includedApps : [],
        billingCycle: p.billingCycle,
        platformAccess: p.platformAccess || [],
      };
    });
  }

  async subscribeMembership(
    businessId: string,
    level: string,
    tier: string,
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
    const price = isTrial ? 0 : await this.resolveMembershipPrice(level, tier, billing);

    const enumLevels = Object.values(MembershipLevel);
    const validLevel = enumLevels.includes(plan.name as MembershipLevel)
      ? (plan.name as MembershipLevel)
      : MembershipLevel.Bronze;

    let validTier: MembershipTier = MembershipTier.Normal;
    const tLower = (tier || '').toLowerCase().replace('+', 'plus');
    if (tLower === 'pro') validTier = MembershipTier.Pro;
    else if (tLower.includes('plus')) validTier = MembershipTier.ProPlus;
    else if (tLower === 'free') validTier = MembershipTier.Free;
    else if (tLower === 'normal') validTier = MembershipTier.Normal;

    const updated = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        membershipLevel: validLevel,
        membershipPlanName: plan.name,
        membershipTier: validTier,
        membershipStatus: (isTrial ? 'trial' : 'active') as MembershipStatus,
      },
    });

    // Cross-Platform Multi-App Package Auto-Provisioning
    const includedApps = Array.isArray(plan.includedApps) ? (plan.includedApps as any[]) : [];
    const expiresAt = new Date();
    if (billing === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else if (billing === 'quarterly') {
      expiresAt.setMonth(expiresAt.getMonth() + 3);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    for (const app of includedApps) {
      const platformName = app.platform || app.platformName || 'MCOM Solutions';
      const packageName = app.planName || app.name || 'Standard';
      const externalPlanId = app.planId || app.id || null;
      const limits = app.quotas || app.limits || app.usageLimits || {};

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
          billingCycle: billing,
          expiresAt,
        },
        update: {
          packageName,
          externalPlanId,
          status: 'active',
          limits,
          billingCycle: billing,
          expiresAt,
        },
      });
    }

    // Record billing transaction
    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: price,
        description: isTrial
          ? `[TRIAL] ${plan.name} (${tier}, ${billing}) — free trial started`
          : `Ecosystem Membership: ${plan.name} (${tier}, ${billing})`,
        status: isTrial ? 'trial' : 'paid',
      },
    });

    return { ...updated, isTrial, billing, price, planName: plan.name };
  }

  async purchasePackage(businessId: string, platform: string, packageName: string) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    // Pricing and limits come from the PackageTemplate catalog (DB-backed).
    // No silent fallback — a missing template is a misconfiguration, not a £29 sale.
    const template = await this.prisma.packageTemplate.findFirst({
      where: { platform, name: { equals: packageName, mode: 'insensitive' }, archived: false },
    });

    if (!template) {
      throw new NotFoundException(`No package template found for "${packageName}" on platform "${platform}"`);
    }

    const price = Number(template.price);
    const limits = (template?.usageLimits as any) ?? {};
    const billingCycle = template?.billingCycle ?? 'monthly';

    const expiresAt = new Date();
    switch (billingCycle) {
      case 'quarterly':
        expiresAt.setMonth(expiresAt.getMonth() + 3);
        break;
      case 'annual':
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        break;
      default:
        expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const platformPackage = await this.prisma.platformPackage.upsert({
      where: {
        businessId_platform: {
          businessId,
          platform,
        },
      },
      update: {
        packageName,
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
        packageName,
        limits,
        status: 'active',
        amount: price,
        currency: 'GBP',
        billingCycle,
        expiresAt,
      },
    });

    // Create billing transaction
    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: price,
        description: `Platform Package purchase: ${platform} - ${packageName}`,
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