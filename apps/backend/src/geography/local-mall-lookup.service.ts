import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostcodeService, ResolvedPostcode } from './postcode.service';

export type LocalMallMatchType =
  | 'assignment'
  | 'outward-code'
  | 'nearest'
  | 'borough'
  | 'none';

export interface LocalMallBusinessSummary {
  id: string;
  businessName: string;
  businessType: string | null;
  description: string | null;
  shortDescription: string | null;
  category: string | null;
  subCategory: string | null;
  address: string | null;
  postcode: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  isClaimed: boolean;
  isVerified: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface LocalMallLookupResult {
  matchType: LocalMallMatchType;
  distanceKm: number | null;
  postcode: string | null;
  outwardCode: string | null;
  latitude: number | null;
  longitude: number | null;
  city: { id: string; name: string; region: string | null; country: string } | null;
  borough: { id: string; name: string } | null;
  highStreet: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  mall: {
    id: string;
    name: string;
    slug: string;
    status: string;
    description: string;
    longDescription: string;
    tagline: string;
    welcomeMessage: string;
    logo: string | null;
    coverBanner: string | null;
    mobileBanner: string | null;
    primaryColour: string;
    secondaryColour: string;
    radiusCoverage: string;
    borough: string;
    postcodes: string[];
    primaryHighStreet: string;
    additionalHighStreets: string[];
    createdDate: Date;
    counts: {
      businesses: number;
      customers: number;
      affiliates: number;
      campaigns: number;
      events: number;
    };
  } | null;
  businesses: LocalMallBusinessSummary[];
}

interface AssignedProfileLocation {
  profileType:
    | 'business'
    | 'customer'
    | 'agent'
    | 'consultant'
    | 'accountManager';
  postcode: string | null;
  localMallId: string | null;
  cityId: string | null;
  boroughId: string | null;
  highStreetId: string | null;
}

const NEAREST_MALL_RADIUS_KM = 40;

@Injectable()
export class LocalMallLookupService {
  private readonly logger = new Logger(LocalMallLookupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly postcodeService: PostcodeService,
  ) {}

  /**
   * Resolves the local mall that should be shown to a user.
   *
   * Order of preference:
   *  1. The mall already assigned to the user's profile (business/customer/
   *     affiliate) in Central — this is the canonical assignment.
   *  2. A curated mall that covers the postcode's outward code.
   *  3. The geographically closest active mall (only malls with coordinates).
   *  4. Any active mall in the same borough.
   */
  async resolve(options: {
    userId?: string | null;
    postcode?: string | null;
  }): Promise<LocalMallLookupResult> {
    const profile = options.userId
      ? await this.findProfileLocation(options.userId)
      : null;

    // For an already-assigned user the profile postcode matches the mall they
    // belong to. Prefer it over a stale/query postcode so the displayed mall
    // and place hierarchy never disagree.
    const submittedPostcode = profile?.localMallId
      ? profile.postcode?.trim() || (options.postcode || '').trim() || null
      : (options.postcode || '').trim() || profile?.postcode?.trim() || null;

    let resolved: ResolvedPostcode | null = null;
    if (submittedPostcode) {
      try {
        resolved = await this.postcodeService.resolve(submittedPostcode);
      } catch (error) {
        // A missing/invalid postcode should not block an already-assigned
        // user from seeing their mall.
        if (!profile?.localMallId) throw error;
        this.logger.warn(
          `Could not resolve postcode "${submittedPostcode}" for local mall lookup: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const outwardCode = resolved?.outwardCode ?? this.outwardCodeFrom(submittedPostcode);
    const latitude = resolved?.latitude ?? null;
    const longitude = resolved?.longitude ?? null;

    let matchType: LocalMallMatchType = 'none';
    let distanceKm: number | null = null;

    let mall = profile?.localMallId
      ? await this.prisma.localMall.findUnique({
          where: { id: profile.localMallId },
        })
      : null;
    if (mall) matchType = 'assignment';

    if (!mall && outwardCode) {
      const match = await this.findByOutwardCode(
        outwardCode,
        resolved?.borough || null,
        latitude,
        longitude,
      );
      if (match) {
        mall = match.mall;
        matchType = 'outward-code';
        distanceKm = match.distanceKm;
      }
    }

    if (
      !mall &&
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      const nearest = await this.findNearestMall(latitude, longitude);
      if (nearest) {
        mall = nearest.mall;
        distanceKm = nearest.distanceKm;
        matchType = 'nearest';
      }
    }

    if (!mall && resolved?.borough) {
      mall = await this.prisma.localMall.findFirst({
        where: {
          borough: { equals: resolved.borough, mode: 'insensitive' },
          status: 'Active',
        },
        orderBy: [{ createdDate: 'asc' }, { name: 'asc' }],
      });
      if (mall) matchType = 'borough';
    }

    const [businesses, counts] = mall
      ? await Promise.all([
          this.getMallBusinesses(mall.id),
          this.getMallCounts(mall.id, {
            cachedBusinesses: mall.businesses,
            cachedCustomers: mall.customers,
            cachedAffiliates: mall.affiliateCount,
            cachedCampaigns: mall.campaigns,
            cachedEvents: mall.events,
          }),
        ])
      : [[], null];

    const city = mall?.cityId
      ? await this.prisma.city.findUnique({ where: { id: mall.cityId } })
      : resolved?.city
        ? await this.prisma.city.findFirst({
            where: { name: { equals: resolved.city, mode: 'insensitive' } },
          })
        : null;

    const borough = mall?.boroughId
      ? await this.prisma.borough.findUnique({ where: { id: mall.boroughId } })
      : resolved?.borough
        ? await this.prisma.borough.findFirst({
            where: {
              name: { equals: resolved.borough, mode: 'insensitive' },
            },
          })
        : null;

    const highStreet = mall?.highStreetId
      ? await this.prisma.highStreet.findUnique({
          where: { id: mall.highStreetId },
        })
      : null;

    return {
      matchType,
      distanceKm:
        distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
      postcode: resolved?.postcode ?? submittedPostcode,
      outwardCode,
      latitude,
      longitude,
      city: city
        ? {
            id: city.id,
            name: city.name,
            region: city.region,
            country: city.country,
          }
        : null,
      borough: borough
        ? { id: borough.id, name: borough.name }
        : resolved?.borough
          ? { id: '', name: resolved.borough }
          : null,
      highStreet: highStreet
        ? {
            id: highStreet.id,
            name: highStreet.name,
            latitude: highStreet.lat,
            longitude: highStreet.lng,
          }
        : resolved?.highStreet
          ? {
              id: profile?.highStreetId ?? '',
              name: resolved.highStreet,
              latitude: latitude,
              longitude: longitude,
            }
          : null,
      mall: mall
        ? {
            id: mall.id,
            name: mall.name,
            slug: mall.slug,
            status: mall.status,
            description: mall.description,
            longDescription: mall.longDescription,
            tagline: mall.tagline,
            welcomeMessage: mall.welcomeMessage,
            logo: mall.logo,
            coverBanner: mall.coverBanner,
            mobileBanner: mall.mobileBanner,
            primaryColour: mall.primaryColour,
            secondaryColour: mall.secondaryColour,
            radiusCoverage: mall.radiusCoverage,
            borough: mall.borough,
            postcodes: mall.postcodes,
            primaryHighStreet: mall.primaryHighStreet,
            additionalHighStreets: mall.additionalHighStreets,
            createdDate: mall.createdDate,
            counts: counts ?? {
              businesses: 0,
              customers: 0,
              affiliates: 0,
              campaigns: 0,
              events: 0,
            },
          }
        : null,
      businesses,
    };
  }

  private async findProfileLocation(
    userId: string,
  ): Promise<AssignedProfileLocation | null> {
    const business = await this.prisma.businessProfile.findFirst({
      where: { userId, deletedAt: null },
      select: {
        postcode: true,
        localMallId: true,
        cityId: true,
        boroughId: true,
        highStreetId: true,
      },
    });
    if (business) {
      return { profileType: 'business', ...business };
    }

    const customer = await this.prisma.customerProfile.findFirst({
      where: { userId, deletedAt: null },
      select: {
        postcode: true,
        localMallId: true,
        cityId: true,
        boroughId: true,
        highStreetId: true,
      },
    });
    if (customer) {
      return { profileType: 'customer', ...customer };
    }

    const agent = await this.prisma.agentProfile.findFirst({
      where: { userId },
      select: {
        postcode: true,
        localMallId: true,
        cityId: true,
        boroughId: true,
        highStreetId: true,
      },
    });
    if (agent) {
      return { profileType: 'agent', ...agent };
    }

    const consultant = await this.prisma.consultantProfile.findFirst({
      where: { userId },
      select: {
        postcode: true,
        localMallId: true,
        cityId: true,
        boroughId: true,
        highStreetId: true,
      },
    });
    if (consultant) {
      return { profileType: 'consultant', ...consultant };
    }

    const accountManager = await this.prisma.accountManagerProfile.findFirst({
      where: { userId },
      select: {
        postcode: true,
        localMallId: true,
        cityId: true,
        boroughId: true,
        highStreetId: true,
      },
    });
    if (accountManager) {
      return { profileType: 'accountManager', ...accountManager };
    }

    return null;
  }

  private async findByOutwardCode(
    outwardCode: string,
    boroughName: string | null,
    latitude: number | null,
    longitude: number | null,
  ) {
    const candidates = await this.prisma.localMall.findMany({
      where: {
        postcodes: { has: outwardCode },
        status: 'Active',
      },
      include: {
        highStreetRef: { select: { lat: true, lng: true } },
      },
    });
    if (!candidates.length) return null;

    const distanceOf = (mall: (typeof candidates)[number]) => {
      if (latitude == null || longitude == null) return null;
      const lat = mall.highStreetRef?.lat;
      const lng = mall.highStreetRef?.lng;
      if (lat == null || lng == null) return null;
      return this.haversineKm(latitude, longitude, lat, lng);
    };

    const sorted = [...candidates].sort((a, b) => {
      const scoreDiff =
        this.matchScore(b, boroughName) - this.matchScore(a, boroughName);
      if (scoreDiff !== 0) return scoreDiff;
      // Among equally-strong matches (e.g. two curated malls sharing an
      // outcode), prefer the geographically closest one.
      const aDistance = distanceOf(a);
      const bDistance = distanceOf(b);
      if (aDistance != null && bDistance != null && aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      const createdDiff =
        (a.createdDate?.getTime() ?? 0) - (b.createdDate?.getTime() ?? 0);
      if (createdDiff !== 0) return createdDiff;
      return a.name.localeCompare(b.name);
    });

    return { mall: sorted[0], distanceKm: distanceOf(sorted[0]) };
  }

  private matchScore(
    mall: { borough: string; osmId: string | null; postcodes: string[] },
    boroughName: string | null,
  ): number {
    let score = 0;
    if (
      boroughName &&
      mall.borough?.toLowerCase() === boroughName.toLowerCase()
    ) {
      score += 100;
    }
    if (mall.osmId) score += 5;
    score += Math.min((mall.postcodes || []).length, 10) * 10;
    return score;
  }

  private async findNearestMall(latitude: number, longitude: number) {
    const malls = await this.prisma.localMall.findMany({
      where: {
        status: 'Active',
        highStreetId: { not: null },
      },
      include: {
        highStreetRef: { select: { lat: true, lng: true } },
      },
    });

    let best: { mall: (typeof malls)[number]; distanceKm: number } | null = null;
    for (const mall of malls) {
      const lat = mall.highStreetRef?.lat;
      const lng = mall.highStreetRef?.lng;
      if (lat == null || lng == null) continue;
      const distanceKm = this.haversineKm(latitude, longitude, lat, lng);
      if (
        distanceKm <= NEAREST_MALL_RADIUS_KM &&
        (!best || distanceKm < best.distanceKm)
      ) {
        best = { mall, distanceKm };
      }
    }
    return best;
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async getMallBusinesses(
    mallId: string,
  ): Promise<LocalMallBusinessSummary[]> {
    const businesses = await this.prisma.businessProfile.findMany({
      where: { localMallId: mallId, deletedAt: null },
      orderBy: { businessName: 'asc' },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        description: true,
        address: true,
        postcode: true,
        logoUrl: true,
        bannerUrl: true,
        website: true,
        phone: true,
        email: true,
        membershipStatus: true,
        hasPaidVerificationFee: true,
        verificationFeePaidAt: true,
        category: true,
        subCategory: true,
        categoryRef: { select: { name: true } },
        subCategoryRef: { select: { name: true } },
        highStreet: { select: { lat: true, lng: true } },
      },
    });

    return businesses.map((business) => ({
      id: business.id,
      businessName: business.businessName,
      businessType: business.businessType || null,
      description: business.description || null,
      shortDescription: business.description
        ? business.description.length > 180
          ? `${business.description.slice(0, 179).trimEnd()}…`
          : business.description
        : null,
      category: business.categoryRef?.name || business.category || null,
      subCategory:
        business.subCategoryRef?.name || business.subCategory || null,
      address: business.address || null,
      postcode: business.postcode || null,
      logoUrl: business.logoUrl || null,
      bannerUrl: business.bannerUrl || null,
      website: business.website || null,
      phone: business.phone || null,
      email: business.email || null,
      isClaimed: true,
      isVerified:
        business.hasPaidVerificationFee ||
        business.verificationFeePaidAt != null,
      latitude: business.highStreet?.lat ?? null,
      longitude: business.highStreet?.lng ?? null,
    }));
  }

  private async getMallCounts(
    mallId: string,
    cached: {
      cachedBusinesses: number;
      cachedCustomers: number;
      cachedAffiliates: number;
      cachedCampaigns: number;
      cachedEvents: number;
    },
  ) {
    const [businesses, customers, affiliates, campaigns] = await Promise.all([
      this.prisma.businessProfile.count({
        where: { localMallId: mallId, deletedAt: null },
      }),
      this.prisma.customerProfile.count({
        where: { localMallId: mallId, deletedAt: null },
      }),
      this.prisma.agentProfile.count({ where: { localMallId: mallId } }),
      this.prisma.campaign.count({
        where: { locationType: 'local_mall', locationId: mallId },
      }),
    ]);

    // Fall back to the cached aggregate when Central has not counted a scope
    // yet (the cron populates these columns).
    return {
      businesses: businesses || cached.cachedBusinesses,
      customers: customers || cached.cachedCustomers,
      affiliates: affiliates || cached.cachedAffiliates,
      campaigns: campaigns || cached.cachedCampaigns,
      events: cached.cachedEvents,
    };
  }

  private outwardCodeFrom(postcode: string | null): string | null {
    if (!postcode) return null;
    const clean = postcode.toUpperCase().replace(/\s+/g, '');
    return clean.length > 3 ? clean.slice(0, clean.length - 3) : null;
  }
}
