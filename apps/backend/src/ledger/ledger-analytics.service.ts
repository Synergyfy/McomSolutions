import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GlIntent, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_WALLET_CODE } from './account-code';

export type TrendMetric = 'volume' | 'transfers' | 'platformInflow' | 'platformOutflow';
export type TrendGrouping = 'day' | 'week' | 'month';

export interface TrendQuery {
  from?: string;
  to?: string;
  groupBy?: TrendGrouping;
  platformId?: string;
  intent?: GlIntent;
}

interface BucketRow {
  bucket: string;
  volumeMinor: bigint;
  transfers: number;
  platformInflowMinor: bigint;
  platformOutflowMinor: bigint;
}

/**
 * Analytics over the ledger.
 *
 * Rollups hold one row per (day, platform, intent) with the transfer *value* —
 * the amount of the transfer's first step, counted once. Later steps move the
 * same money on, so summing them would inflate every figure.
 *
 * Platform inflow/outflow cannot be derived from a per-transfer value (a card
 * sale passes through the platform wallet), so those come from the platform
 * account's entries directly and are merged into the same buckets.
 */
@Injectable()
export class LedgerAnalyticsService {
  private readonly logger = new Logger(LedgerAnalyticsService.name);
  private lastEnsureAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Rollups ──────────────────────────────────────────────────────────────

  /** Recompute yesterday (and a short window behind it) once a day. */
  @Cron('10 1 * * *')
  async rebuildRecentHistory(): Promise<void> {
    const to = startOfUtcDay(new Date());
    const from = new Date(to.getTime() - 7 * 86400000);
    await this.rebuildRange(from, to);
  }

  /** Keep today's partial bucket current. */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshToday(): Promise<void> {
    const from = startOfUtcDay(new Date());
    const to = new Date(from.getTime() + 86400000);
    await this.rebuildRange(from, to);
  }

  async rebuildRange(from: Date, to: Date): Promise<{ days: number; rows: number }> {
    const fromDate = isoDay(from);
    const toDate = isoDay(to);

    const rows = await this.prisma.$queryRaw<
      Array<{
        date: string;
        platform_id: string;
        intent: string;
        currency: string;
        amount_minor: bigint;
        n: number;
      }>
    >`
      SELECT
        to_char(tr.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        COALESCE(tr.platform_id, 'mcom-central') AS platform_id,
        tr.intent::text AS intent,
        ft.currency,
        SUM(ft.amount_minor)::bigint AS amount_minor,
        COUNT(*)::int AS n
      FROM gl_transfers tr
      CROSS JOIN LATERAL (
        SELECT t.currency, t.amount_minor
        FROM gl_transactions t
        WHERE t.transfer_id = tr.id
        ORDER BY t.posted_at ASC
        LIMIT 1
      ) ft
      WHERE tr.created_at >= ${from}
        AND tr.created_at < ${to}
      GROUP BY 1, 2, 3, 4
    `;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM gl_daily_rollups
        WHERE date >= ${fromDate} AND date <= ${toDate}
      `;

      if (rows.length > 0) {
        await tx.glDailyRollup.createMany({
          data: rows.map((row) => ({
            id: crypto.randomUUID(),
            date: row.date,
            platformId: row.platform_id,
            intent: row.intent as GlIntent,
            currency: row.currency,
            debitMinor: row.amount_minor,
            creditMinor: row.amount_minor,
            txnCount: row.n,
          })),
          skipDuplicates: true,
        });
      }
    });

    return { days: daysBetween(from, to), rows: rows.length };
  }

  /**
   * Analytics reads the rollups, not the journal. If a range has never been
   * rolled up — a fresh deploy, or history backfilled after the last cron — the
   * chart would silently show nothing. Rebuild that range once, on demand.
   */
  private async ensureRange(from: Date, to: Date): Promise<void> {
    const fromDay = isoDay(from);
    const toDay = isoDay(new Date(to.getTime() - 1));

    const existing = await this.prisma.glDailyRollup.count({
      where: { date: { gte: fromDay, lte: toDay } },
    });
    if (existing > 0) return;

    // Cheap stampede guard: never more than one rebuild a minute per instance.
    if (Date.now() - this.lastEnsureAt < 60_000) return;
    this.lastEnsureAt = Date.now();

    const transfers = await this.prisma.glTransfer.count({
      where: { createdAt: { gte: from, lt: to } },
    });
    if (transfers === 0) return;

    this.logger.log(`No rollups for ${fromDay}..${toDay}; rebuilding from ${transfers} transfer(s).`);
    await this.rebuildRange(from, to);
  }

  /** Rebuild every day that has transfers (backfill / first deploy). */
  async rebuildAll(): Promise<{ days: number; rows: number }> {
    const first = await this.prisma.glTransfer.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const to = new Date(startOfUtcDay(new Date()).getTime() + 86400000);
    const from = first
      ? startOfUtcDay(first.createdAt)
      : new Date(to.getTime() - 30 * 86400000);
    return this.rebuildRange(from, to);
  }

  /** Rebuild the last `days` of rollups on demand (admin / post-backfill). */
  async rebuildRecent(days = 90): Promise<{ days: number; rows: number }> {
    const span = Math.min(3650, Math.max(1, Math.floor(days)));
    const to = new Date(startOfUtcDay(new Date()).getTime() + 86400000);
    const from = new Date(to.getTime() - span * 86400000);
    return this.rebuildRange(from, to);
  }

  // ─── Reads ────────────────────────────────────────────────────────────────

  async trend(query: TrendQuery) {
    const { from, to } = range(query.from, query.to);
    const groupBy = query.groupBy ?? 'day';
    await this.ensureRange(from, to);

    const rollups = await this.prisma.glDailyRollup.findMany({
      where: {
        date: { gte: isoDay(from), lte: isoDay(new Date(to.getTime() - 1)) },
        ...(query.platformId ? { platformId: query.platformId } : {}),
        ...(query.intent ? { intent: query.intent } : {}),
      },
    });

    const buckets = new Map<string, BucketRow>();
    for (const row of rollups) {
      const bucket = bucketOf(row.date, groupBy);
      const entry = buckets.get(bucket) ?? emptyBucket(bucket);
      entry.volumeMinor += row.debitMinor;
      entry.transfers += row.txnCount;
      buckets.set(bucket, entry);
    }

    const flows = await this.platformFlows(from, to, groupBy, query.platformId);
    for (const flow of flows) {
      const entry = buckets.get(flow.bucket) ?? emptyBucket(flow.bucket);
      entry.platformInflowMinor += flow.inflowMinor;
      entry.platformOutflowMinor += flow.outflowMinor;
      buckets.set(flow.bucket, entry);
    }

    const data = [...buckets.values()]
      .sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0))
      .map((bucket) => ({
        bucket: bucket.bucket,
        volumeMinor: bucket.volumeMinor.toString(),
        transfers: bucket.transfers,
        platformInflowMinor: bucket.platformInflowMinor.toString(),
        platformOutflowMinor: bucket.platformOutflowMinor.toString(),
      }));

    return {
      success: true as const,
      data,
      meta: {
        from: isoDay(from),
        to: isoDay(to),
        groupBy,
        platformId: query.platformId ?? null,
        intent: query.intent ?? null,
        /** True when the range extends past the last completed rollup day. */
        includesToday: isoDay(to) === isoDay(new Date()),
      },
    };
  }

  async byPlatform(fromRaw?: string, toRaw?: string) {
    const { from, to } = range(fromRaw, toRaw);
    await this.ensureRange(from, to);

    const rollups = await this.prisma.glDailyRollup.groupBy({
      by: ['platformId'],
      where: { date: { gte: isoDay(from), lte: isoDay(new Date(to.getTime() - 1)) } },
      _sum: { debitMinor: true, txnCount: true },
    });

    const flowsByPlatform = await this.platformFlowsByPlatform(from, to);

    const totalVolume = rollups.reduce((sum, row) => sum + (row._sum.debitMinor ?? 0n), 0n);
    let totalInflow = 0n;
    let totalOutflow = 0n;
    for (const flow of flowsByPlatform.values()) {
      totalInflow += flow.inflow;
      totalOutflow += flow.outflow;
    }

    // Sort on the numbers, not their string form: '9000' > '40000' lexically.
    const ranked = [...rollups].sort((a, b) => {
      const av = a._sum.debitMinor ?? 0n;
      const bv = b._sum.debitMinor ?? 0n;
      return av === bv ? 0 : av > bv ? -1 : 1;
    });

    return {
      success: true as const,
      data: ranked.map((row) => ({
        platformId: row.platformId,
        volumeMinor: (row._sum.debitMinor ?? 0n).toString(),
        transfers: row._sum.txnCount ?? 0,
        platformInflowMinor: (flowsByPlatform.get(row.platformId)?.inflow ?? 0n).toString(),
        platformOutflowMinor: (flowsByPlatform.get(row.platformId)?.outflow ?? 0n).toString(),
      })),
      totals: {
        volumeMinor: totalVolume.toString(),
        platformInflowMinor: totalInflow.toString(),
        platformOutflowMinor: totalOutflow.toString(),
      },
      meta: { from: isoDay(from), to: isoDay(to) },
    };
  }

  async byIntent(fromRaw?: string, toRaw?: string) {
    const { from, to } = range(fromRaw, toRaw);
    await this.ensureRange(from, to);

    const rows = await this.prisma.glDailyRollup.groupBy({
      by: ['intent'],
      where: { date: { gte: isoDay(from), lte: isoDay(new Date(to.getTime() - 1)) } },
      _sum: { debitMinor: true, txnCount: true },
    });

    const totalVolume = rows.reduce((sum, row) => sum + (row._sum.debitMinor ?? 0n), 0n);

    const rankedIntents = [...rows].sort((a, b) => {
      const av = a._sum.debitMinor ?? 0n;
      const bv = b._sum.debitMinor ?? 0n;
      return av === bv ? 0 : av > bv ? -1 : 1;
    });

    return {
      success: true as const,
      data: rankedIntents.map((row) => {
        const volume = row._sum.debitMinor ?? 0n;
        return {
          intent: row.intent,
          volumeMinor: volume.toString(),
          transfers: row._sum.txnCount ?? 0,
          share: totalVolume > 0n ? Number((volume * 10000n) / totalVolume) / 100 : 0,
        };
      }),
      meta: { from: isoDay(from), to: isoDay(to), totalVolumeMinor: totalVolume.toString() },
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async platformAccountId(): Promise<string | null> {
    const account = await this.prisma.glAccount.findUnique({
      where: { code: PLATFORM_WALLET_CODE },
      select: { id: true },
    });
    return account?.id ?? null;
  }

  private async platformFlows(
    from: Date,
    to: Date,
    groupBy: TrendGrouping,
    platformId?: string,
  ): Promise<Array<{ bucket: string; inflowMinor: bigint; outflowMinor: bigint; volumeMinor: bigint }>> {
    const accountId = await this.platformAccountId();
    if (!accountId) return [];

    const unit = groupBy === 'day' ? 'day' : groupBy === 'week' ? 'week' : 'month';

    const rows = await this.prisma.$queryRaw<
      Array<{ bucket: Date; direction: string; total: bigint }>
    >`
      SELECT
        date_trunc(${unit}, e.created_at AT TIME ZONE 'UTC') AS bucket,
        e.direction::text AS direction,
        SUM(e.amount_minor)::bigint AS total
      FROM gl_entries e
      JOIN gl_transactions t ON t.id = e.transaction_id
      JOIN gl_transfers tr ON tr.id = t.transfer_id
      WHERE e.account_id = ${accountId}
        AND e.created_at >= ${from}
        AND e.created_at < ${to}
        ${platformId ? Prisma.sql`AND tr.platform_id = ${platformId}` : Prisma.empty}
      GROUP BY 1, 2
      ORDER BY 1
    `;

    const buckets = new Map<
      string,
      { bucket: string; inflowMinor: bigint; outflowMinor: bigint; volumeMinor: bigint }
    >();

    for (const row of rows) {
      const key = bucketOfDate(row.bucket, groupBy);
      const entry = buckets.get(key) ?? {
        bucket: key,
        inflowMinor: 0n,
        outflowMinor: 0n,
        volumeMinor: 0n,
      };
      if (row.direction === 'credit') entry.inflowMinor += row.total;
      else entry.outflowMinor += row.total;
      buckets.set(key, entry);
    }

    return [...buckets.values()];
  }

  private async platformFlowsByPlatform(
    from: Date,
    to: Date,
  ): Promise<Map<string, { inflow: bigint; outflow: bigint }>> {
    const accountId = await this.platformAccountId();
    const result = new Map<string, { inflow: bigint; outflow: bigint }>();
    if (!accountId) return result;

    const rows = await this.prisma.$queryRaw<
      Array<{ platform_id: string; direction: string; total: bigint }>
    >`
      SELECT
        COALESCE(tr.platform_id, 'mcom-central') AS platform_id,
        e.direction::text AS direction,
        SUM(e.amount_minor)::bigint AS total
      FROM gl_entries e
      JOIN gl_transactions t ON t.id = e.transaction_id
      JOIN gl_transfers tr ON tr.id = t.transfer_id
      WHERE e.account_id = ${accountId}
        AND e.created_at >= ${from}
        AND e.created_at < ${to}
      GROUP BY 1, 2
    `;

    for (const row of rows) {
      const entry = result.get(row.platform_id) ?? { inflow: 0n, outflow: 0n };
      if (row.direction === 'credit') entry.inflow += row.total;
      else entry.outflow += row.total;
      result.set(row.platform_id, entry);
    }

    return result;
  }
}

function emptyBucket(bucket: string): BucketRow {
  return {
    bucket,
    volumeMinor: 0n,
    transfers: 0,
    platformInflowMinor: 0n,
    platformOutflowMinor: 0n,
  };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
}

function range(fromRaw?: string, toRaw?: string): { from: Date; to: Date } {
  const to = toRaw ? new Date(`${toRaw}T00:00:00.000Z`) : new Date();
  const toExclusive = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1));
  const from = fromRaw
    ? new Date(`${fromRaw}T00:00:00.000Z`)
    : new Date(toExclusive.getTime() - 30 * 86400000);
  return { from, to: toExclusive };
}

function bucketOf(date: string, groupBy: TrendGrouping): string {
  if (groupBy === 'day') return date;
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (groupBy === 'month') return date.slice(0, 7);
  // ISO week: Monday start
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday);
  return isoDay(d);
}

function bucketOfDate(date: Date, groupBy: TrendGrouping): string {
  return bucketOf(isoDay(date), groupBy);
}
