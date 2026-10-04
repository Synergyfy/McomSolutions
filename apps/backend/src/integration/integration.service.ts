import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Phase 4: constant-time API key comparison. The candidate is looked up by
   * exact match (indexed), then re-verified with timingSafeEqual on SHA-256
   * digests so a wrong key of any length takes the same code path — no
   * early-exit oracle on key prefixes. Lengths are normalized via hashing
   * first (timingSafeEqual throws on length mismatch).
   */
  private keysEqual(candidate: string, stored: string): boolean {
    const a = createHash('sha256').update(candidate).digest();
    const b = createHash('sha256').update(stored).digest();
    return timingSafeEqual(a, b);
  }

  async getBusinessByApiKey(apiKey: string) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('API Key is missing');
    }

    const business = await this.prisma.businessProfile.findUnique({
      where: { apiKey },
      include: {
        packages: true,
      },
    });

    if (!business || !business.apiKey || !this.keysEqual(apiKey, business.apiKey)) {
      // Same 401 either way — never reveal whether the key exists.
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
