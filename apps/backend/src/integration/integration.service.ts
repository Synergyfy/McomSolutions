import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationService {
  constructor(private prisma: PrismaService) {}

  async getBusinessByApiKey(apiKey: string) {
    if (!apiKey) {
      throw new UnauthorizedException('API Key is missing');
    }

    const business = await this.prisma.businessProfile.findUnique({
      where: { apiKey },
      include: {
        packages: true,
      },
    });

    if (!business) {
      throw new UnauthorizedException('Invalid API Key');
    }

    return {
      businessId: business.id,
      businessName: business.businessName,
      businessType: business.businessType,
      email: business.email,
      phone: business.phone,
      address: business.address,
      postcode: business.postcode,
      category: business.category,
      industry: business.industry,
      description: business.description,
      logoUrl: business.logoUrl,
      openingHours: business.openingHours,
      socialMedia: business.socialMedia,
      membershipLevel: business.membershipLevel,
      membershipTier: business.membershipTier,
      membershipStatus: business.membershipStatus,
      proximityTier: business.proximityTier,
      packages: business.packages.map((pkg) => ({
        platform: pkg.platform,
        packageName: pkg.packageName,
        status: pkg.status,
        limits: pkg.limits,
      })),
    };
  }
}
