import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostcodeService, ResolvedPostcode } from './postcode.service';

export interface BusinessLocationInput {
  postcode?: string | null;
  sectorId?: string | null;
  categoryId?: string | null;
  subCategoryId?: string | null;
  industry?: string | null;
  category?: string | null;
  subCategory?: string | null;
  /** Optional pre-resolved metadata (avoids a duplicate upstream lookup). */
  resolvedPostcode?: ResolvedPostcode;
}

export interface AssignedHierarchy {
  cityId: string;
  cityName: string;
  boroughId: string;
  boroughName: string;
  highStreetId: string;
  highStreetName: string;
  localMallId: string;
  localMallName: string;
}

export interface BackfillBusinessSummary {
  dryRun: boolean;
  scanned: number;
  eligible: number;
  processed: number;
  assigned: number;
  skipped: number;
  failed: number;
  errors: Array<{ businessId: string; postcode: string; message: string }>;
}

function slugify(value: string): string {
  return (
    (value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `location-${Date.now()}`
  );
}

/**
 * Resolves the City → Borough → High Street → Local Mall hierarchy for a UK
 * postcode, creating any missing entity, and assigns a business to it.
 *
 * Keeping this in one service means both registration and later profile edits
 * (including the Google claim flow) use exactly the same rules.
 */
@Injectable()
export class LocationAssignmentService {
  private readonly logger = new Logger(LocationAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly postcodeService: PostcodeService,
  ) {}

  /** Validate + resolve a postcode without touching the database. */
  resolvePostcode(postcode: string): Promise<ResolvedPostcode> {
    return this.postcodeService.resolve(postcode);
  }

  /**
   * Assigns the business profile to its hierarchy. Safe to call repeatedly —
   * locations are matched by name before creation.
   */
  async assignBusiness(
    businessId: string,
    input: BusinessLocationInput,
  ): Promise<AssignedHierarchy | null> {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        postcode: true,
        createdAt: true,
        cityId: true,
        boroughId: true,
        highStreetId: true,
        localMallId: true,
        sectorId: true,
        categoryId: true,
        subCategoryId: true,
      },
    });
    if (!business) return null;

    const postcode = input.postcode?.trim() || business.postcode?.trim();
    if (!postcode) return null;

    const resolved = input.resolvedPostcode ?? (await this.postcodeService.resolve(postcode));
    const assignedAt = new Date();

    const hierarchy = await this.prisma.$transaction(async (tx) => {
      const hierarchy = await this.ensureHierarchy(tx, resolved);
      const hasCatalogInput = Boolean(
        input.sectorId ||
          input.categoryId ||
          input.subCategoryId ||
          input.industry ||
          input.category ||
          input.subCategory,
      );
      const catalog = hasCatalogInput
        ? await this.resolveCatalogIds(tx, input)
        : {
            sectorId: business.sectorId,
            categoryId: business.categoryId,
            subCategoryId: business.subCategoryId,
          };

      await tx.businessProfile.update({
        where: { id: businessId },
        data: {
          postcode: resolved.postcode,
          cityId: hierarchy.cityId,
          boroughId: hierarchy.boroughId,
          highStreetId: hierarchy.highStreetId,
          localMallId: hierarchy.localMallId,
          localMallName: hierarchy.localMallName,
          sectorId: catalog.sectorId,
          categoryId: catalog.categoryId,
          subCategoryId: catalog.subCategoryId,
          locationAssignedAt: assignedAt,
        },
      });

      // Only bump the "newest item" watermark — the cron skips scopes whose
      // watermark has already been aggregated.
      await this.touchScopes(tx, hierarchy, catalog, assignedAt, {
        cityId: business.cityId,
        boroughId: business.boroughId,
        highStreetId: business.highStreetId,
        localMallId: business.localMallId,
        sectorId: business.sectorId,
        categoryId: business.categoryId,
        subCategoryId: business.subCategoryId,
      });

      return hierarchy;
    }, { maxWait: 10_000, timeout: 30_000 });

    this.logger.log(
      `Assigned business ${businessId} to ${hierarchy.cityName} > ${hierarchy.boroughName} > ` +
        `${hierarchy.highStreetName} > ${hierarchy.localMallName}`,
    );
    return hierarchy;
  }

  /**
   * One-off backfill for businesses that already have a postcode but were
   * created before location assignment existed (or whose location links are
   * incomplete). Resolves each unique postcode once, assigns the business, and
   * leaves aggregates to the caller.
   */
  async backfillBusinesses(
    options: { limit?: number; dryRun?: boolean } = {},
  ): Promise<BackfillBusinessSummary> {
    const dryRun = Boolean(options.dryRun);
    const candidates = await this.prisma.businessProfile.findMany({
      where: {
        deletedAt: null,
        postcode: { not: null },
        OR: [
          { locationAssignedAt: null },
          { cityId: null },
          { boroughId: null },
          { highStreetId: null },
          { localMallId: null },
        ],
      },
      select: {
        id: true,
        postcode: true,
        sectorId: true,
        categoryId: true,
        subCategoryId: true,
        industry: true,
        category: true,
        subCategory: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const eligible = candidates.filter((business) => (business.postcode || '').trim().length > 0);
    const limited = options.limit ? eligible.slice(0, options.limit) : eligible;

    const summary: BackfillBusinessSummary = {
      dryRun,
      scanned: candidates.length,
      eligible: eligible.length,
      processed: limited.length,
      assigned: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Postcodes are shared across many businesses; resolve each unique one once.
    const resolvedCache = new Map<string, ResolvedPostcode | { error: string }>();

    const resolveOnce = async (postcode: string) => {
      const key = postcode.toUpperCase().replace(/\s+/g, ' ').trim();
      const cached = resolvedCache.get(key);
      if (cached) return cached;
      try {
        const resolved = await this.postcodeService.resolve(postcode);
        resolvedCache.set(key, resolved);
        return resolved;
      } catch (error) {
        const recorded = {
          error: error instanceof Error ? error.message : String(error),
        };
        resolvedCache.set(key, recorded);
        return recorded;
      }
    };

    for (const business of limited) {
      const postcode = (business.postcode || '').trim();
      if (!postcode) {
        summary.skipped += 1;
        continue;
      }

      const resolved = await resolveOnce(postcode);
      if ('error' in resolved) {
        summary.failed += 1;
        summary.errors.push({
          businessId: business.id,
          postcode,
          message: resolved.error,
        });
        continue;
      }

      if (dryRun) {
        summary.assigned += 1;
        continue;
      }

      try {
        await this.assignBusiness(business.id, {
          postcode: resolved.postcode,
          resolvedPostcode: resolved,
          sectorId: business.sectorId,
          categoryId: business.categoryId,
          subCategoryId: business.subCategoryId,
          industry: business.industry,
          category: business.category,
          subCategory: business.subCategory,
        });
        summary.assigned += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          businessId: business.id,
          postcode,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.log(
      `Postcode backfill ${dryRun ? '(dry run) ' : ''}complete: ` +
        `${summary.assigned} assigned, ${summary.failed} failed, ${summary.skipped} skipped ` +
        `across ${summary.processed} businesses`,
    );

    return summary;
  }

  /**
   * Assigns an affiliate profile (Agent / Consultant / Account Manager) to the
   * same City → Borough → High Street → Local Mall hierarchy derived from its
   * validated postcode.
   */
  async assignAffiliate(
    profileType: 'agent' | 'consultant' | 'accountManager',
    profileId: string,
    postcode: string,
    resolvedPostcode?: ResolvedPostcode,
  ): Promise<AssignedHierarchy | null> {
    const select = {
      id: true,
      postcode: true,
      cityId: true,
      boroughId: true,
      highStreetId: true,
      localMallId: true,
    } as const;

    let profile:
      | {
          id: string;
          postcode: string | null;
          cityId: string | null;
          boroughId: string | null;
          highStreetId: string | null;
          localMallId: string | null;
        }
      | null = null;

    if (profileType === 'agent') {
      profile = await this.prisma.agentProfile.findUnique({ where: { id: profileId }, select });
    } else if (profileType === 'consultant') {
      profile = await this.prisma.consultantProfile.findUnique({ where: { id: profileId }, select });
    } else {
      profile = await this.prisma.accountManagerProfile.findUnique({
        where: { id: profileId },
        select,
      });
    }

    if (!profile) return null;

    const effectivePostcode = postcode?.trim() || profile.postcode?.trim();
    if (!effectivePostcode) return null;

    const resolved =
      resolvedPostcode ?? (await this.postcodeService.resolve(effectivePostcode));
    const assignedAt = new Date();

    const hierarchy = await this.prisma.$transaction(async (tx) => {
      const hierarchy = await this.ensureHierarchy(tx, resolved);
      const locationData = {
        postcode: resolved.postcode,
        cityId: hierarchy.cityId,
        boroughId: hierarchy.boroughId,
        highStreetId: hierarchy.highStreetId,
        localMallId: hierarchy.localMallId,
        locationAssignedAt: assignedAt,
      };

      if (profileType === 'agent') {
        await tx.agentProfile.update({ where: { id: profileId }, data: locationData });
      } else if (profileType === 'consultant') {
        await tx.consultantProfile.update({ where: { id: profileId }, data: locationData });
      } else {
        await tx.accountManagerProfile.update({ where: { id: profileId }, data: locationData });
      }

      await this.touchScopes(
        tx,
        hierarchy,
        { sectorId: null, categoryId: null, subCategoryId: null },
        assignedAt,
        {
          cityId: profile.cityId,
          boroughId: profile.boroughId,
          highStreetId: profile.highStreetId,
          localMallId: profile.localMallId,
          sectorId: null,
          categoryId: null,
          subCategoryId: null,
        },
      );

      return hierarchy;
    }, { maxWait: 10_000, timeout: 30_000 });

    this.logger.log(
      `Assigned ${profileType} ${profileId} to ${hierarchy.cityName} > ${hierarchy.boroughName} > ` +
        `${hierarchy.highStreetName} > ${hierarchy.localMallName}`,
    );
    return hierarchy;
  }

  private async ensureHierarchy(
    tx: Prisma.TransactionClient,
    resolved: ResolvedPostcode,
  ): Promise<AssignedHierarchy> {
    const cityName = resolved.city || 'Unknown City';
    const boroughName = resolved.borough || cityName;
    const highStreetName = resolved.highStreet || boroughName;
    const localMallName = resolved.localMall || `${highStreetName} Local Mall`;

    let city = await tx.city.findUnique({ where: { name: cityName } });
    if (!city) {
      city = await tx.city.create({
        data: { name: cityName, region: resolved.region || null },
      });
    } else if (resolved.region && city.region !== resolved.region) {
      city = await tx.city.update({
        where: { id: city.id },
        data: { region: resolved.region },
      });
    }

    let borough = await tx.borough.findUnique({ where: { name: boroughName } });
    if (!borough) {
      borough = await tx.borough.create({
        data: {
          name: boroughName,
          cityId: city.id,
          populationActivity: 'Moderate',
          rewardsParticipation: '0%',
          healthScore: 0,
          manager: 'Unassigned',
          area: cityName,
          region: resolved.region || cityName,
          engagement: 'Unknown',
          health: 'Unknown',
          activity: 'Inactive',
        },
      });
    } else if (!borough.cityId) {
      borough = await tx.borough.update({
        where: { id: borough.id },
        data: { cityId: city.id },
      });
    }

    let highStreet = await tx.highStreet.findFirst({
      where: { name: highStreetName, borough: boroughName },
    });
    if (!highStreet) {
      highStreet = await tx.highStreet.create({
        data: {
          name: highStreetName,
          borough: boroughName,
          cityId: city.id,
          boroughId: borough.id,
          status: 'Active',
          lat: resolved.latitude,
          lng: resolved.longitude,
        },
      });
    } else if (!highStreet.cityId || !highStreet.boroughId) {
      highStreet = await tx.highStreet.update({
        where: { id: highStreet.id },
        data: {
          cityId: highStreet.cityId ?? city.id,
          boroughId: highStreet.boroughId ?? borough.id,
        },
      });
    }

    let localMall = await tx.localMall.findFirst({
      where: { name: localMallName, borough: boroughName },
    });
    if (!localMall) {
      const slug = await this.uniqueMallSlug(tx, localMallName, resolved.outwardCode);
      localMall = await tx.localMall.create({
        data: {
          name: localMallName,
          postcodes: resolved.outwardCode ? [resolved.outwardCode] : [],
          borough: boroughName,
          cityId: city.id,
          boroughId: borough.id,
          highStreetId: highStreet.id,
          primaryHighStreet: highStreetName,
          additionalHighStreets: [],
          status: 'Active',
          description: `${localMallName} local digital economy.`,
          longDescription: `${localMallName} connects local businesses to the MCOM ecosystem.`,
          slug,
          primaryColour: '#1D4ED8',
          secondaryColour: '#F97316',
          welcomeMessage: `Welcome to ${localMallName}.`,
          tagline: 'Shop local, earn rewards.',
          radiusCoverage: '5 miles',
        },
      });
    } else {
      const missingLinks =
        !localMall.cityId || !localMall.boroughId || !localMall.highStreetId;
      if (missingLinks) {
        localMall = await tx.localMall.update({
          where: { id: localMall.id },
          data: {
            cityId: localMall.cityId ?? city.id,
            boroughId: localMall.boroughId ?? borough.id,
            highStreetId: localMall.highStreetId ?? highStreet.id,
          },
        });
      }
      if (resolved.outwardCode && !localMall.postcodes.includes(resolved.outwardCode)) {
        localMall = await tx.localMall.update({
          where: { id: localMall.id },
          data: { postcodes: { push: resolved.outwardCode } },
        });
      }
    }

    return {
      cityId: city.id,
      cityName: city.name,
      boroughId: borough.id,
      boroughName: borough.name,
      highStreetId: highStreet.id,
      highStreetName: highStreet.name,
      localMallId: localMall.id,
      localMallName: localMall.name,
    };
  }

  private async uniqueMallSlug(
    tx: Prisma.TransactionClient,
    name: string,
    outwardCode?: string,
  ): Promise<string> {
    const base = slugify(outwardCode ? `${name}-${outwardCode}` : name);
    let candidate = base;
    let suffix = 1;
    // The slug column is unique; resolve collisions deterministically.
    while (await tx.localMall.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  private async resolveCatalogIds(
    tx: Prisma.TransactionClient,
    input: BusinessLocationInput,
  ): Promise<{
    sectorId: string | null;
    categoryId: string | null;
    subCategoryId: string | null;
  }> {
    let sectorId = input.sectorId || null;
    let categoryId = input.categoryId || null;
    let subCategoryId = input.subCategoryId || null;

    if (sectorId) {
      const sector = await tx.sector.findUnique({ where: { id: sectorId }, select: { id: true } });
      if (!sector) sectorId = null;
    }

    if (categoryId) {
      const category = await tx.category.findUnique({
        where: { id: categoryId },
        select: { id: true, sectorId: true },
      });
      if (!category || (sectorId && category.sectorId !== sectorId)) {
        categoryId = null;
      } else if (!sectorId) {
        sectorId = category.sectorId;
      }
    }

    if (subCategoryId) {
      const subCategory = await tx.subCategory.findUnique({
        where: { id: subCategoryId },
        select: { id: true, categoryId: true },
      });
      if (!subCategory || (categoryId && subCategory.categoryId !== categoryId)) {
        subCategoryId = null;
      } else if (!categoryId) {
        categoryId = subCategory.categoryId;
      }
    }

    // Fall back to text labels captured by older onboarding flows.
    if (!sectorId && input.industry) {
      const sector = await tx.sector.findFirst({
        where: {
          OR: [
            { name: { equals: input.industry, mode: 'insensitive' } },
            { slug: slugify(input.industry) },
          ],
        },
        select: { id: true },
      });
      sectorId = sector?.id ?? null;
    }

    if (!categoryId && input.category) {
      const category = await tx.category.findFirst({
        where: {
          ...(sectorId ? { sectorId } : {}),
          OR: [
            { name: { equals: input.category, mode: 'insensitive' } },
            { slug: slugify(input.category) },
          ],
        },
        select: { id: true, sectorId: true },
      });
      categoryId = category?.id ?? null;
      if (category && !sectorId) sectorId = category.sectorId;
    }

    if (!subCategoryId && input.subCategory) {
      const subCategory = await tx.subCategory.findFirst({
        where: {
          ...(categoryId ? { categoryId } : {}),
          OR: [
            { name: { equals: input.subCategory, mode: 'insensitive' } },
            { slug: slugify(input.subCategory) },
          ],
        },
        select: { id: true, categoryId: true },
      });
      subCategoryId = subCategory?.id ?? null;
      if (subCategory && !categoryId) categoryId = subCategory.categoryId;
    }

    return { sectorId, categoryId, subCategoryId };
  }

  private async touchScopes(
    tx: Prisma.TransactionClient,
    hierarchy: AssignedHierarchy,
    catalog: { sectorId: string | null; categoryId: string | null; subCategoryId: string | null },
    createdAt: Date,
    previous?: {
      cityId: string | null;
      boroughId: string | null;
      highStreetId: string | null;
      localMallId: string | null;
      sectorId: string | null;
      categoryId: string | null;
      subCategoryId: string | null;
    },
  ): Promise<void> {
    const notNewer = { OR: [{ lastItemCreatedAt: null }, { lastItemCreatedAt: { lt: createdAt } }] };

    const ids = {
      city: new Set([hierarchy.cityId, previous?.cityId].filter(Boolean) as string[]),
      borough: new Set([hierarchy.boroughId, previous?.boroughId].filter(Boolean) as string[]),
      highStreet: new Set([hierarchy.highStreetId, previous?.highStreetId].filter(Boolean) as string[]),
      localMall: new Set([hierarchy.localMallId, previous?.localMallId].filter(Boolean) as string[]),
      sector: new Set([catalog.sectorId, previous?.sectorId].filter(Boolean) as string[]),
      category: new Set([catalog.categoryId, previous?.categoryId].filter(Boolean) as string[]),
      subCategory: new Set([catalog.subCategoryId, previous?.subCategoryId].filter(Boolean) as string[]),
    };

    if (ids.city.size) {
      await tx.city.updateMany({
        where: { id: { in: [...ids.city] }, ...notNewer },
        data: { lastItemCreatedAt: createdAt },
      });
    }
    if (ids.borough.size) {
      await tx.borough.updateMany({
        where: { id: { in: [...ids.borough] }, ...notNewer },
        data: { lastItemCreatedAt: createdAt },
      });
    }
    if (ids.highStreet.size) {
      await tx.highStreet.updateMany({
        where: { id: { in: [...ids.highStreet] }, ...notNewer },
        data: { lastItemCreatedAt: createdAt },
      });
    }
    if (ids.localMall.size) {
      await tx.localMall.updateMany({
        where: { id: { in: [...ids.localMall] }, ...notNewer },
        data: { lastItemCreatedAt: createdAt },
      });
    }
    if (ids.sector.size) {
      await tx.sector.updateMany({
        where: { id: { in: [...ids.sector] }, ...notNewer },
        data: { lastItemCreatedAt: createdAt },
      });
    }
    if (ids.category.size) {
      await tx.category.updateMany({
        where: { id: { in: [...ids.category] }, ...notNewer },
        data: { lastItemCreatedAt: createdAt },
      });
    }
    if (ids.subCategory.size) {
      await tx.subCategory.updateMany({
        where: { id: { in: [...ids.subCategory] }, ...notNewer },
        data: { lastItemCreatedAt: createdAt },
      });
    }
  }
}
