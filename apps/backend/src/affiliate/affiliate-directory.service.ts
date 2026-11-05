import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostcodeService } from '../geography/postcode.service';
import { AffiliateClientService, AffiliateDirectoryEntry } from './affiliate-client.service';
import {
  AFFINITY_WEIGHTS,
  AffinityCandidate,
  AffinityLocation,
  normalizePlatformKey,
  rankByAffinity,
  scoreAffinity,
} from './affiliate-affinity.util';

export const AFFILIATE_ROLES: Role[] = [Role.AGENT, Role.ACCOUNT_MANAGER, Role.CONSULTANT];

export interface PlatformAccessItem {
  key: string;
  name: string;
  platformSlug: string | null;
  clientId: string | null;
}

@Injectable()
export class AffiliateDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postcode: PostcodeService,
    private readonly affiliateClient: AffiliateClientService,
  ) {}

  private readonly geoCache = new Map<
    string,
    { at: number; lat: number | null; lng: number | null }
  >();

  private normalizePostcode(postcode?: string | null): string {
    return (postcode || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  private compactPostcode(postcode?: string | null): string {
    return this.normalizePostcode(postcode).replace(/\s+/g, '');
  }

  private async geocode(postcode?: string | null): Promise<{ lat: number; lng: number } | null> {
    const normalized = this.normalizePostcode(postcode);
    if (!normalized) return null;

    const cached = this.geoCache.get(normalized);
    const ttlMs = 24 * 60 * 60 * 1000;
    if (cached && Date.now() - cached.at < ttlMs) {
      return cached.lat != null && cached.lng != null
        ? { lat: cached.lat, lng: cached.lng }
        : null;
    }

    try {
      const resolved = await this.postcode.resolve(normalized);
      const lat = resolved.latitude ?? null;
      const lng = resolved.longitude ?? null;
      this.geoCache.set(normalized, { at: Date.now(), lat, lng });
      return lat != null && lng != null ? { lat, lng } : null;
    } catch {
      this.geoCache.set(normalized, { at: Date.now(), lat: null, lng: null });
      return null;
    }
  }

  private haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  private estimateDistanceKm(matchedLevel: string): number | null {
    switch (matchedLevel) {
      case 'local_mall':
        return 0.5;
      case 'postcode':
        return 1.5;
      case 'high_street':
        return 2;
      case 'borough':
        return 6;
      case 'city':
        return 15;
      default:
        return null;
    }
  }

  private formatDistance(km: number | null): {
    km: number | null;
    miles: number | null;
    label: string;
  } {
    if (km == null || !Number.isFinite(km)) {
      return { km: null, miles: null, label: 'Distance unavailable' };
    }
    const miles = km * 0.621371;
    const label =
      km < 1
        ? `${Math.max(0.1, Math.round(km * 10) / 10)} km away`
        : `${Math.round(km * 10) / 10} km (~${Math.round(miles * 10) / 10} mi) away`;
    return { km: Math.round(km * 10) / 10, miles: Math.round(miles * 10) / 10, label };
  }

  async getBusiness(userId: string, businessId?: string | null) {
    const business = await this.prisma.businessProfile.findFirst({
      where: {
        OR: [{ userId }, ...(businessId ? [{ id: businessId }] : [])],
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!business) throw new NotFoundException('Business profile not found');
    return business;
  }

  /** Platforms the business can currently tag work under. */
  async getPlatformAccess(businessId: string): Promise<{
    platforms: PlatformAccessItem[];
    accessType: 'MEMBERSHIP' | 'TRIAL' | 'ACCESS_PASS' | 'NONE';
  }> {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        id: true,
        membershipPlanName: true,
        membershipStatus: true,
        membershipExpiresAt: true,
        trialAccessExpiresAt: true,
      },
    });
    if (!business) throw new NotFoundException('Business profile not found');

    const now = new Date();
    const [packages, plan, clients, accessPurchase] = await Promise.all([
      this.prisma.platformPackage.findMany({
        where: {
          businessId,
          status: 'active',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { platform: true, planType: true },
      }),
      business.membershipPlanName
        ? this.prisma.membershipPlan.findFirst({
            where: { name: business.membershipPlanName },
            select: { includedApps: true, platformAccess: true },
          })
        : Promise.resolve(null),
      this.prisma.ssoClient.findMany({
        where: { isActive: true },
        select: { clientId: true, name: true, platformSlug: true },
      }),
      this.prisma.accessPurchase.findFirst({
        where: { businessId, status: 'ACTIVE', expiresAt: { gt: now } },
        select: { id: true },
      }),
    ]);

    const rawNames = new Set<string>();
    for (const pkg of packages) if (pkg.platform) rawNames.add(pkg.platform);
    if (plan) {
      if (Array.isArray(plan.platformAccess)) {
        for (const p of plan.platformAccess) rawNames.add(String(p));
      }
      if (Array.isArray(plan.includedApps)) {
        for (const app of plan.includedApps as any[]) {
          const name = app?.platform || app?.platformName || app?.name;
          if (name) rawNames.add(String(name));
        }
      }
    }

    const isTrial =
      business.membershipStatus === 'trial' ||
      (business.trialAccessExpiresAt != null && business.trialAccessExpiresAt > now);
    const hasAccessPass = !!accessPurchase;
    const hasMembership = rawNames.size > 0;

    let accessType: 'MEMBERSHIP' | 'TRIAL' | 'ACCESS_PASS' | 'NONE' = 'NONE';
    if (hasMembership) accessType = 'MEMBERSHIP';
    else if (hasAccessPass) accessType = 'ACCESS_PASS';
    else if (isTrial) accessType = 'TRIAL';

    // Trial and access-pass businesses may not have package rows; present the
    // full catalogue so they can still tag (and route via an admin).
    if (!hasMembership && (isTrial || hasAccessPass)) {
      for (const client of clients) rawNames.add(client.platformSlug || client.name);
    }

    const platforms: PlatformAccessItem[] = [];
    const seen = new Set<string>();
    const clientByKey = new Map<string, (typeof clients)[number]>();
    for (const client of clients) {
      if (client.platformSlug) clientByKey.set(normalizePlatformKey(client.platformSlug), client);
      clientByKey.set(normalizePlatformKey(client.clientId), client);
      clientByKey.set(normalizePlatformKey(client.name), client);
    }

    for (const raw of rawNames) {
      const match = clientByKey.get(normalizePlatformKey(raw));
      const key = match?.platformSlug || normalizePlatformKey(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      platforms.push({
        key,
        name: match?.name || raw,
        platformSlug: match?.platformSlug ?? null,
        clientId: match?.clientId ?? null,
      });
    }

    platforms.sort((a, b) => a.name.localeCompare(b.name));
    return { platforms, accessType };
  }

  /**
   * Validate requested platform tags against the business entitlements.
   * Unknown/ungranted tags are rejected with a helpful message.
   */
  async assertPlatformsAllowed(businessId: string, requested: string[]): Promise<string[]> {
    const normalised = Array.from(
      new Set(requested.map((p) => normalizePlatformKey(p)).filter(Boolean)),
    );
    if (!normalised.length) return [];

    const { platforms, accessType } = await this.getPlatformAccess(businessId);
    if (!platforms.length) {
      throw new BadRequestException(
        'You have no active platform access to tag this task with. Purchase a membership or access pass first.',
      );
    }

    const allowed = new Map<string, string>();
    for (const platform of platforms) {
      for (const candidate of [platform.key, platform.platformSlug, platform.clientId, platform.name]) {
        const key = normalizePlatformKey(candidate);
        if (key) allowed.set(key, platform.key);
      }
    }

    const resolved: string[] = [];
    for (const key of normalised) {
      const match = allowed.get(key);
      if (!match) {
        throw new BadRequestException(
          `Platform "${key}" is not included in your current ${accessType === 'NONE' ? 'plan' : accessType.toLowerCase()}. ` +
            `Available: ${platforms.map((p) => p.name).join(', ')}.`,
        );
      }
      resolved.push(match);
    }
    return Array.from(new Set(resolved));
  }

  async listNearbyAffiliates(
    business: AffinityLocation,
    options: {
      role?: string;
      page?: number;
      limit?: number;
      postcode?: string;
      skill?: string;
      availableOnly?: string;
    } = {},
  ) {
    const availableOnly = options.availableOnly === 'true';
    const roleFilter = options.role?.toUpperCase();
    const wantedRoles = roleFilter
      ? AFFILIATE_ROLES.filter((role) => role === roleFilter)
      : AFFILIATE_ROLES;
    if (roleFilter && !wantedRoles.length) {
      throw new BadRequestException('role must be AGENT, ACCOUNT_MANAGER or CONSULTANT');
    }

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const skillQuery = options.skill?.trim().toLowerCase() || '';
    const postcodeQuery = this.compactPostcode(options.postcode);

    const [agents, accountManagers, consultants, directory] = await Promise.all([
      wantedRoles.includes(Role.AGENT)
        ? this.prisma.agentProfile.findMany({
            where: { deletedAt: null, status: 'Active', user: { deletedAt: null }, ...(availableOnly ? { availabilityStatus: 'AVAILABLE' } : {}) },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
          })
        : Promise.resolve([]),
      wantedRoles.includes(Role.ACCOUNT_MANAGER)
        ? this.prisma.accountManagerProfile.findMany({
            where: { deletedAt: null, status: 'Active', user: { deletedAt: null }, ...(availableOnly ? { availabilityStatus: 'AVAILABLE' } : {}) },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
          })
        : Promise.resolve([]),
      wantedRoles.includes(Role.CONSULTANT)
        ? this.prisma.consultantProfile.findMany({
            where: { deletedAt: null, status: 'Active', user: { deletedAt: null }, ...(availableOnly ? { availabilityStatus: 'AVAILABLE' } : {}) },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
          })
        : Promise.resolve([]),
      // Skills live in the affiliate app — only fetch for search requests.
      skillQuery || postcodeQuery
        ? this.affiliateClient.getAffiliateDirectory()
        : Promise.resolve(new Map<string, AffiliateDirectoryEntry>()),
    ]);

    const withSkills = <T extends { email: string }>(candidate: T) => {
      const entry = directory.get(candidate.email.toLowerCase());
      return {
        ...candidate,
        skills: entry?.skills ?? [],
        languages: entry?.languages ?? [],
      };
    };

    const candidates: Array<
      AffinityCandidate & {
        name: string;
        email: string;
        specialisation?: string | null;
        skills: string[];
        languages: string[];
      }
    > = [
      ...agents.map((p) =>
        withSkills({
          id: p.id,
          userId: p.userId,
          role: Role.AGENT,
          name: [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || p.user.email,
          email: p.user.email,
          cityId: p.cityId,
          boroughId: p.boroughId,
          highStreetId: p.highStreetId,
          localMallId: p.localMallId,
          postcode: p.postcode,
          reputationScore: p.reputationScore,
          experienceScore: p.experienceScore,
          completedTasksCount: p.completedTasksCount,
          assignedBusinesses: 0,
          availabilityStatus: p.availabilityStatus,
        }),
      ),
      ...accountManagers.map((p) =>
        withSkills({
          id: p.id,
          userId: p.userId,
          role: Role.ACCOUNT_MANAGER,
          name: [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || p.user.email,
          email: p.user.email,
          cityId: p.cityId,
          boroughId: p.boroughId,
          highStreetId: p.highStreetId,
          localMallId: p.localMallId,
          postcode: p.postcode,
          reputationScore: p.reputationScore,
          experienceScore: p.experienceScore,
          completedTasksCount: p.completedTasksCount,
          assignedBusinesses: p.assignedBusinesses,
          availabilityStatus: p.availabilityStatus,
        }),
      ),
      ...consultants.map((p) =>
        withSkills({
          id: p.id,
          userId: p.userId,
          role: Role.CONSULTANT,
          name: [p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || p.user.email,
          email: p.user.email,
          cityId: p.cityId,
          boroughId: p.boroughId,
          highStreetId: p.highStreetId,
          localMallId: p.localMallId,
          postcode: p.postcode,
          reputationScore: p.reputationScore,
          experienceScore: p.experienceScore,
          completedTasksCount: p.completedTasksCount,
          assignedBusinesses: 0,
          availabilityStatus: p.availabilityStatus,
          specialisation: p.specialisation,
        }),
      ),
    ];

    let pool = candidates;

    if (skillQuery) {
      pool = pool.filter((candidate) => {
        const haystack = [
          ...(candidate.skills || []),
          ...(candidate.languages || []),
          candidate.specialisation || '',
          candidate.role,
        ];
        return haystack.some((value) => String(value).toLowerCase().includes(skillQuery));
      });
    }

    if (postcodeQuery) {
      pool = pool.filter((candidate) =>
        this.compactPostcode(candidate.postcode).startsWith(postcodeQuery),
      );
    }

    const ranked = rankByAffinity(business, pool);
    const total = ranked.length;
    const slice = ranked.slice((page - 1) * limit, page * limit);

    // Distance is estimated from the business's own postcode (the user's
    // location). If the postcode cannot be geocoded we fall back to the
    // hierarchy-distance estimate so the UI always shows *something* useful.
    const originPostcode = business.postcode || options.postcode || null;
    const originGeo = await this.geocode(originPostcode);
    const targetGeos = await Promise.all(
      slice.map(({ candidate }) => this.geocode(candidate.postcode)),
    );

    const items = slice.map(({ candidate, score }, index) => {
      const target = targetGeos[index];
      let distanceKm: number | null = null;
      let distanceSource: 'postcode' | 'estimated' | 'unavailable' = 'unavailable';
      let distanceReason:
        | 'BUSINESS_POSTCODE_MISSING'
        | 'AFFILIATE_POSTCODE_MISSING'
        | 'GEOCODE_FAILED'
        | null = null;
      if (originGeo && target) {
        distanceKm = this.haversineKm(originGeo, target);
        distanceSource = 'postcode';
      } else {
        const estimate = this.estimateDistanceKm(score.matchedLevel);
        if (estimate != null) {
          distanceKm = estimate;
          distanceSource = 'estimated';
        } else if (!originPostcode) {
          distanceReason = 'BUSINESS_POSTCODE_MISSING';
        } else if (!candidate.postcode) {
          distanceReason = 'AFFILIATE_POSTCODE_MISSING';
        } else {
          distanceReason = 'GEOCODE_FAILED';
        }
      }
      return {
        userId: candidate.userId,
        profileId: candidate.id,
        name: (candidate as any).name,
        email: candidate.email,
        role: candidate.role,
        specialisation: (candidate as any).specialisation ?? null,
        skills: candidate.skills ?? [],
        languages: candidate.languages ?? [],
        postcode: candidate.postcode ?? null,
        reputationScore: candidate.reputationScore ?? 0,
        experienceScore: candidate.experienceScore ?? 0,
        completedTasksCount: candidate.completedTasksCount ?? 0,
        assignedBusinesses: candidate.assignedBusinesses ?? 0,
        proximity: {
          matchedLevel: score.matchedLevel,
          score: score.total,
          breakdown: score,
        },
        distance: {
          ...this.formatDistance(distanceKm),
          source: distanceSource,
          reason: distanceReason,
        },
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filters: {
        skill: options.skill ?? null,
        postcode: options.postcode ?? null,
      },
      distanceFrom: originPostcode,
    };
  }

  async assertAffiliateUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        agentProfile: { select: { id: true, cityId: true, boroughId: true, highStreetId: true, localMallId: true, postcode: true, status: true } },
        accountManagerProfile: { select: { id: true, cityId: true, boroughId: true, highStreetId: true, localMallId: true, postcode: true, status: true } },
        consultantProfile: { select: { id: true, cityId: true, boroughId: true, highStreetId: true, localMallId: true, postcode: true, status: true } },
      },
    });
    if (!user) throw new NotFoundException('Affiliate not found');
    if (!AFFILIATE_ROLES.includes(user.role)) {
      throw new ForbiddenException('Selected user is not an agent, account manager or consultant');
    }
    const profile = user.agentProfile || user.accountManagerProfile || user.consultantProfile;
    if (!profile || profile.status !== 'Active') {
      throw new ForbiddenException('Selected affiliate is not active');
    }
    return user;
  }

  pickBestAccountManager(business: AffinityLocation, candidates: AffinityCandidate[]) {
    if (!candidates.length) return null;
    return rankByAffinity(business, candidates)[0];
  }

  score(business: AffinityLocation, candidate: AffinityCandidate) {
    return scoreAffinity(business, candidate);
  }

  get weights() {
    return AFFINITY_WEIGHTS;
  }
}
