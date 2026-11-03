import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

interface ScopeRow {
  id: string;
  lastItemCreatedAt: Date | null;
  aggregatedAt: Date | null;
}

export interface AggregationSummary {
  cities: number;
  boroughs: number;
  highStreets: number;
  localMalls: number;
  sectors: number;
  categories: number;
  subCategories: number;
  scannedAt: string;
}

/**
 * Calculates cached business totals per geographic / catalog scope.
 *
 * Efficiency: every scope stores `lastItemCreatedAt` (newest assigned business)
 * and `aggregatedAt` (watermark from the last successful calculation). Scopes
 * whose watermark has not moved are skipped entirely — no COUNT query and no
 * UPDATE. Counts are computed with a single groupBy per model, so the job is
 * O(scopes) not O(businesses × scopes).
 */
@Injectable()
export class LocationAggregationService {
  private readonly logger = new Logger(LocationAggregationService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'location-business-totals' })
  async handleCron(): Promise<void> {
    try {
      await this.aggregateAll();
    } catch (error) {
      this.logger.error(
        `Location aggregation failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }

  async aggregateAll(): Promise<AggregationSummary> {
    if (this.running) {
      return {
        cities: 0,
        boroughs: 0,
        highStreets: 0,
        localMalls: 0,
        sectors: 0,
        categories: 0,
        subCategories: 0,
        scannedAt: new Date().toISOString(),
      };
    }
    this.running = true;
    try {
      const [cities, boroughs, highStreets, localMalls, sectors, categories, subCategories] =
        await Promise.all([
          this.aggregateCities(),
          this.aggregateBoroughs(),
          this.aggregateHighStreets(),
          this.aggregateLocalMalls(),
          this.aggregateSectors(),
          this.aggregateCategories(),
          this.aggregateSubCategories(),
        ]);

      const summary: AggregationSummary = {
        cities,
        boroughs,
        highStreets,
        localMalls,
        sectors,
        categories,
        subCategories,
        scannedAt: new Date().toISOString(),
      };

      if (cities + boroughs + highStreets + localMalls + sectors + categories + subCategories > 0) {
        this.logger.log(`Location totals refreshed: ${JSON.stringify(summary)}`);
      }
      return summary;
    } finally {
      this.running = false;
    }
  }

  private needsRefresh(rows: ScopeRow[]): ScopeRow[] {
    return rows.filter(
      (row) =>
        row.aggregatedAt === null ||
        (row.lastItemCreatedAt !== null &&
          row.aggregatedAt.getTime() < row.lastItemCreatedAt.getTime()),
    );
  }

  /**
   * Sums Agent + Consultant + Account Manager totals per location scope.
   * Three grouped queries total (independent of the number of scopes).
   */
  private async affiliateCountsFor(
    field: 'cityId' | 'boroughId' | 'highStreetId' | 'localMallId',
  ): Promise<Map<string, number>> {
    const where = { deletedAt: null, [field]: { not: null } };
    const [agents, consultants, managers] = await Promise.all([
      this.prisma.agentProfile.groupBy({
        by: [field],
        where,
        _count: { _all: true },
      }),
      this.prisma.consultantProfile.groupBy({
        by: [field],
        where,
        _count: { _all: true },
      }),
      this.prisma.accountManagerProfile.groupBy({
        by: [field],
        where,
        _count: { _all: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const group of [agents, consultants, managers]) {
      for (const row of group as Array<Record<string, unknown> & { _count: { _all: number } }>) {
        const id = row[field] as string | null;
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + row._count._all);
      }
    }
    return counts;
  }

  private async aggregateCities(): Promise<number> {
    const rows = (await this.prisma.city.findMany({
      select: { id: true, lastItemCreatedAt: true, aggregatedAt: true },
    })) as ScopeRow[];
    const changed = this.needsRefresh(rows);
    if (changed.length === 0) return 0;

    const [grouped, affiliateCounts] = await Promise.all([
      this.prisma.businessProfile.groupBy({
        by: ['cityId'],
        where: { deletedAt: null, cityId: { not: null } },
        _count: { _all: true },
      }),
      this.affiliateCountsFor('cityId'),
    ]);
    const counts = new Map(grouped.map((g) => [g.cityId as string, g._count._all]));

    await this.prisma.$transaction(
      changed.map((row) =>
        this.prisma.city.update({
          where: { id: row.id },
          data: {
            businessCount: counts.get(row.id) ?? 0,
            affiliateCount: affiliateCounts.get(row.id) ?? 0,
            aggregatedAt: row.lastItemCreatedAt ?? new Date(),
          },
        }),
      ),
    );
    return changed.length;
  }

  private async aggregateBoroughs(): Promise<number> {
    const rows = (await this.prisma.borough.findMany({
      select: { id: true, lastItemCreatedAt: true, aggregatedAt: true },
    })) as ScopeRow[];
    const changed = this.needsRefresh(rows);
    if (changed.length === 0) return 0;

    const [grouped, affiliateCounts] = await Promise.all([
      this.prisma.businessProfile.groupBy({
        by: ['boroughId'],
        where: { deletedAt: null, boroughId: { not: null } },
        _count: { _all: true },
      }),
      this.affiliateCountsFor('boroughId'),
    ]);
    const counts = new Map(grouped.map((g) => [g.boroughId as string, g._count._all]));

    await this.prisma.$transaction(
      changed.map((row) =>
        this.prisma.borough.update({
          where: { id: row.id },
          data: {
            businessCount: counts.get(row.id) ?? 0,
            affiliateCount: affiliateCounts.get(row.id) ?? 0,
            aggregatedAt: row.lastItemCreatedAt ?? new Date(),
          },
        }),
      ),
    );
    return changed.length;
  }

  private async aggregateHighStreets(): Promise<number> {
    const rows = (await this.prisma.highStreet.findMany({
      select: { id: true, lastItemCreatedAt: true, aggregatedAt: true },
    })) as ScopeRow[];
    const changed = this.needsRefresh(rows);
    if (changed.length === 0) return 0;

    const [grouped, affiliateCounts] = await Promise.all([
      this.prisma.businessProfile.groupBy({
        by: ['highStreetId'],
        where: { deletedAt: null, highStreetId: { not: null } },
        _count: { _all: true },
      }),
      this.affiliateCountsFor('highStreetId'),
    ]);
    const counts = new Map(grouped.map((g) => [g.highStreetId as string, g._count._all]));

    await this.prisma.$transaction(
      changed.map((row) =>
        this.prisma.highStreet.update({
          where: { id: row.id },
          data: {
            businessCount: counts.get(row.id) ?? 0,
            affiliateCount: affiliateCounts.get(row.id) ?? 0,
            aggregatedAt: row.lastItemCreatedAt ?? new Date(),
          },
        }),
      ),
    );
    return changed.length;
  }

  private async aggregateLocalMalls(): Promise<number> {
    const rows = (await this.prisma.localMall.findMany({
      select: { id: true, lastItemCreatedAt: true, aggregatedAt: true },
    })) as ScopeRow[];
    const changed = this.needsRefresh(rows);
    if (changed.length === 0) return 0;

    const [grouped, affiliateCounts] = await Promise.all([
      this.prisma.businessProfile.groupBy({
        by: ['localMallId'],
        where: { deletedAt: null, localMallId: { not: null } },
        _count: { _all: true },
      }),
      this.affiliateCountsFor('localMallId'),
    ]);
    const counts = new Map(grouped.map((g) => [g.localMallId as string, g._count._all]));

    await this.prisma.$transaction(
      changed.map((row) =>
        this.prisma.localMall.update({
          where: { id: row.id },
          data: {
            businesses: counts.get(row.id) ?? 0,
            affiliateCount: affiliateCounts.get(row.id) ?? 0,
            aggregatedAt: row.lastItemCreatedAt ?? new Date(),
          },
        }),
      ),
    );
    return changed.length;
  }

  private async aggregateSectors(): Promise<number> {
    const rows = (await this.prisma.sector.findMany({
      select: { id: true, lastItemCreatedAt: true, aggregatedAt: true },
    })) as ScopeRow[];
    const changed = this.needsRefresh(rows);
    if (changed.length === 0) return 0;

    const grouped = await this.prisma.businessProfile.groupBy({
      by: ['sectorId'],
      where: { deletedAt: null, sectorId: { not: null } },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((g) => [g.sectorId as string, g._count._all]));

    await this.prisma.$transaction(
      changed.map((row) =>
        this.prisma.sector.update({
          where: { id: row.id },
          data: {
            businessCount: counts.get(row.id) ?? 0,
            aggregatedAt: row.lastItemCreatedAt ?? new Date(),
          },
        }),
      ),
    );
    return changed.length;
  }

  private async aggregateCategories(): Promise<number> {
    const rows = (await this.prisma.category.findMany({
      select: { id: true, lastItemCreatedAt: true, aggregatedAt: true },
    })) as ScopeRow[];
    const changed = this.needsRefresh(rows);
    if (changed.length === 0) return 0;

    const grouped = await this.prisma.businessProfile.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null, categoryId: { not: null } },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((g) => [g.categoryId as string, g._count._all]));

    await this.prisma.$transaction(
      changed.map((row) =>
        this.prisma.category.update({
          where: { id: row.id },
          data: {
            businessCount: counts.get(row.id) ?? 0,
            aggregatedAt: row.lastItemCreatedAt ?? new Date(),
          },
        }),
      ),
    );
    return changed.length;
  }

  private async aggregateSubCategories(): Promise<number> {
    const rows = (await this.prisma.subCategory.findMany({
      select: { id: true, lastItemCreatedAt: true, aggregatedAt: true },
    })) as ScopeRow[];
    const changed = this.needsRefresh(rows);
    if (changed.length === 0) return 0;

    const grouped = await this.prisma.businessProfile.groupBy({
      by: ['subCategoryId'],
      where: { deletedAt: null, subCategoryId: { not: null } },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((g) => [g.subCategoryId as string, g._count._all]));

    await this.prisma.$transaction(
      changed.map((row) =>
        this.prisma.subCategory.update({
          where: { id: row.id },
          data: {
            businessCount: counts.get(row.id) ?? 0,
            aggregatedAt: row.lastItemCreatedAt ?? new Date(),
          },
        }),
      ),
    );
    return changed.length;
  }
}
