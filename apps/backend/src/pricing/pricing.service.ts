import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipLevel, MembershipTier, MembershipStatus } from '@prisma/client';

/**
 * Tier price multipliers applied over the DB-stored base monthly price.
 * Normal = base, Pro = 2.5x, Pro+ = 5x. The base price is the source of truth
 * in the `membership_plans` table (admin-editable).
 */
const TIER_MULTIPLIERS: Record<string, number> = { Normal: 1, Pro: 2.5, 'Pro+': 5 };
const YEARLY_DISCOUNT = 0.2;

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  private tierMultiplier(tier: string): number {
    return TIER_MULTIPLIERS[tier] ?? 1;
  }

  private async getPlan(level: string) {
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { name: level, archived: false },
    });
    if (!plan) {
      throw new NotFoundException(`Plan level '${level}' does not exist`);
    }
    return plan;
  }

  async resolveMembershipPrice(
    level: string,
    tier: string,
    billing: 'monthly' | 'yearly' = 'monthly',
  ): Promise<number> {
    const plan = await this.getPlan(level);
    const baseMonthly = Number(plan.price) * this.tierMultiplier(tier);
    if (billing === 'yearly') {
      return Math.floor(baseMonthly * (1 - YEARLY_DISCOUNT)) * 12;
    }
    return Math.round(baseMonthly);
  }

  async getPlans() {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { archived: false },
      orderBy: { price: 'asc' },
    });

    return plans.map((p) => ({
      id: p.name,
      name: p.name,
      description: p.description,
      price: {
        Normal: Math.round(Number(p.price)),
        Pro: Math.round(Number(p.price) * 2.5),
        'Pro+': Math.round(Number(p.price) * 5),
      },
      features: p.permissions || [],
      billingCycle: p.billingCycle,
      platformAccess: p.platformAccess || [],
    }));
  }

  async subscribeMembership(
    businessId: string,
    level: string,
    tier: string,
    billing: 'monthly' | 'yearly' = 'monthly',
    isTrial = false,
  ) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    // Validates the plan exists and resolves its real DB-backed price.
    const price = isTrial ? 0 : await this.resolveMembershipPrice(level, tier, billing);

    // Update business profile membership
    const updated = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        membershipLevel: level as MembershipLevel,
        membershipTier: tier as MembershipTier,
        membershipStatus: (isTrial ? 'trial' : 'active') as MembershipStatus,
      },
    });

    // Record billing transaction
    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: price,
        description: isTrial
          ? `[TRIAL] ${level} ${tier} (${billing}) — free trial started`
          : `Ecosystem Membership: ${level} ${tier} (${billing})`,
        status: isTrial ? 'trial' : 'paid',
      },
    });

    return { ...updated, isTrial, billing, price };
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