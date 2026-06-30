import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const MEMBERSHIP_PLANS = [
  {
    id: 'Bronze',
    name: 'Bronze',
    description: 'Perfect for local brands and new startups.',
    whoItIsFor: 'New businesses',
    iconName: 'Building2',
    color: 'border-amber-600/20 text-amber-600 bg-amber-50',
    price: { Normal: 10, Pro: 25, 'Pro+': 50 },
    features: ['Basic business listing', 'Community access', 'Essential insights'],
    tierFeatures: {
      Normal: ['Base Visibility', 'Local Listings'],
      Pro: ['Enhanced Visibility', 'Extended Listings'],
      'Pro+': ['Priority Visibility', 'Featured Placement'],
    },
  },
  {
    id: 'Silver',
    name: 'Silver',
    description: 'Advanced tools for growing teams.',
    whoItIsFor: 'Growing businesses',
    iconName: 'Zap',
    color: 'border-slate-400/20 text-slate-500 bg-slate-50',
    price: { Normal: 75, Pro: 150, 'Pro+': 250 },
    features: ['Marketing tools', 'Campaign participation', 'Quarterly reviews', 'Everything in Bronze'],
    tierFeatures: {
      Normal: ['Standard Ads', 'Campaign Basic'],
      Pro: ['Premium Ads', 'Campaign Priority'],
      'Pro+': ['Aggressive Ads', 'Exclusive Early Access'],
    },
  },
  {
    id: 'Gold',
    name: 'Gold',
    description: 'Scale your operations with priority access.',
    whoItIsFor: 'Scaling businesses',
    iconName: 'Star',
    color: 'border-yellow-500/30 text-yellow-600 bg-yellow-50',
    price: { Normal: 350, Pro: 600, 'Pro+': 900 },
    features: ['Full campaign access', 'Multi-location support', 'Advanced AI insights', 'Everything in Silver'],
    tierFeatures: {
      Normal: ['Direct API', 'Dashboard Basic'],
      Pro: ['Custom API', 'Dashboard Pro'],
      'Pro+': ['Enterprise API', 'Full AI Suite'],
    },
  },
  {
    id: 'Platinum',
    name: 'Platinum',
    description: 'Tailored solutions for market leaders.',
    whoItIsFor: 'Established businesses',
    iconName: 'Trophy',
    color: 'border-blue-600/20 text-blue-700 bg-blue-50',
    price: { Normal: 1200, Pro: 2500, 'Pro+': 4500 },
    features: ['Priority visibility', 'Dedicated support', 'Executive reporting', 'Everything in Gold'],
    tierFeatures: {
      Normal: ['Dedicated AM', 'Monthly Strategy'],
      Pro: ['Global AM', 'Bi-weekly Strategy'],
      'Pro+': ['VP Support', 'Weekly Audits'],
    },
  },
];

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async getPlans() {
    return MEMBERSHIP_PLANS;
  }

  async subscribeMembership(businessId: string, level: string, tier: string) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    const plan = MEMBERSHIP_PLANS.find((p) => p.id === level);
    if (!plan) {
      throw new NotFoundException(`Plan level '${level}' does not exist`);
    }

    const price = plan.price[tier] || 0;

    // Update business profile
    const updated = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        membershipLevel: level,
        membershipTier: tier,
        membershipStatus: 'active',
      },
    });

    // Create billing transaction
    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: price,
        description: `Ecosystem Membership subscription: ${level} - ${tier}`,
        status: 'paid',
      },
    });

    return updated;
  }

  async purchasePackage(businessId: string, platform: string, packageName: string) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business profile not found');
    }

    // Determine pricing and limits
    let price = 29;
    let limits: any = { campaignsLimit: 1, rewardsLimit: 5 };

    if (packageName.toLowerCase() === 'standard') {
      price = 79;
      limits = { campaignsLimit: 5, rewardsLimit: 20 };
    } else if (packageName.toLowerCase() === 'enterprise') {
      price = 199;
      limits = { campaignsLimit: -1, rewardsLimit: -1 }; // -1 represents unlimited
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
      },
      create: {
        businessId,
        platform,
        packageName,
        limits,
        status: 'active',
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
