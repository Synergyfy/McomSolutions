import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LocalMallHierarchyNode {
  id: string;
  name: string;
}

export interface LocalMallPartner {
  id: string;
  businessName: string;
  logoUrl: string | null;
  category: string | null;
  industry: string | null;
  membershipTier: string | null;
}

export interface MyLocalMallOverview {
  /** True when at least one level of the hierarchy is attached to the profile. */
  assigned: boolean;
  role: Role;
  postcode: string | null;
  city: LocalMallHierarchyNode | null;
  borough: LocalMallHierarchyNode | null;
  highStreet: LocalMallHierarchyNode | null;
  localMall: (LocalMallHierarchyNode & {
    slug: string | null;
    status: string | null;
    postcodes: string[];
  }) | null;
  locationAssignedAt: string | null;
  partners: LocalMallPartner[];
  partnerCount: number;
}

/** How many partner businesses the card lists before deferring to the count. */
const PARTNER_PREVIEW_LIMIT = 12;

/**
 * Read-only "my local mall" overview for the business and customer dashboards.
 *
 * Sources the hierarchy from the profile's stored FKs (written by
 * `LocationAssignmentService`) rather than re-resolving the postcode, so the
 * dashboards always show exactly what administration sees. Partner businesses
 * are whatever else is assigned to the same local mall.
 */
@Injectable()
export class LocalMallOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string): Promise<MyLocalMallOverview> {
    if (!userId) {
      // Never fall through to an unfiltered lookup: Prisma drops `undefined`
      // filters, which would return an arbitrary user's location.
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        businessProfile: {
          select: {
            id: true,
            postcode: true,
            cityId: true,
            boroughId: true,
            highStreetId: true,
            localMallId: true,
            locationAssignedAt: true,
          },
        },
        customerProfile: {
          select: {
            id: true,
            postcode: true,
            cityId: true,
            boroughId: true,
            highStreetId: true,
            localMallId: true,
            locationAssignedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = user.businessProfile ?? user.customerProfile;
    const ownBusinessId = user.businessProfile?.id ?? null;

    if (!profile) {
      return {
        assigned: false,
        role: user.role,
        postcode: null,
        city: null,
        borough: null,
        highStreet: null,
        localMall: null,
        locationAssignedAt: null,
        partners: [],
        partnerCount: 0,
      };
    }

    const [city, borough, highStreet, localMall] = await Promise.all([
      profile.cityId
        ? this.prisma.city.findUnique({
            where: { id: profile.cityId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      profile.boroughId
        ? this.prisma.borough.findUnique({
            where: { id: profile.boroughId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      profile.highStreetId
        ? this.prisma.highStreet.findUnique({
            where: { id: profile.highStreetId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      profile.localMallId
        ? this.prisma.localMall.findUnique({
            where: { id: profile.localMallId },
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              postcodes: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const { partners, partnerCount } = profile.localMallId
      ? await this.getPartners(profile.localMallId, ownBusinessId)
      : { partners: [], partnerCount: 0 };

    return {
      assigned: Boolean(city || borough || highStreet || localMall),
      role: user.role,
      postcode: profile.postcode,
      city,
      borough,
      highStreet,
      localMall,
      locationAssignedAt: profile.locationAssignedAt
        ? profile.locationAssignedAt.toISOString()
        : null,
      partners,
      partnerCount,
    };
  }

  private async getPartners(localMallId: string, excludeBusinessId: string | null) {
    const where = {
      localMallId,
      deletedAt: null,
      ...(excludeBusinessId ? { id: { not: excludeBusinessId } } : {}),
    };

    const [partners, partnerCount] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where,
        select: {
          id: true,
          businessName: true,
          logoUrl: true,
          category: true,
          industry: true,
          membershipTier: true,
        },
        orderBy: { businessName: 'asc' },
        take: PARTNER_PREVIEW_LIMIT,
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    return {
      partners: partners.map((partner) => ({
        ...partner,
        membershipTier: partner.membershipTier ? String(partner.membershipTier) : null,
      })),
      partnerCount,
    };
  }
}
