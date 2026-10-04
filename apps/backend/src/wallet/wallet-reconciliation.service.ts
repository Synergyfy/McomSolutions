import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Background jobs for wallet integrity:
 *  - Hold expiry (every 5 minutes): releases stale ACTIVE holds back to balance.
 *  - Reconciliation (nightly 02:00): verifies Wallet.balance equals the sum
 *    derivable from the ledger. ANY drift is logged as an error — drift = bug.
 */
@Injectable()
export class WalletReconciliationService {
  private readonly logger = new Logger(WalletReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleHolds(): Promise<void> {
    const lockKey = 'cron:expire-holds';
    const acquired = await this.redis.setNx(lockKey, '1', 290);
    if (!acquired) {
      this.logger.debug('Hold expiry cron already running on another instance — skipping');
      return;
    }

    try {
      const BATCH = 100;
      let cursor: string | undefined;
      let totalExpired = 0;
      let batches = 0;
      for (;;) {
        const page = await this.prisma.walletHold.findMany({
          where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
          orderBy: { expiresAt: 'asc' },
          take: BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (page.length === 0) break;

        const now = new Date();
        // Batch flip with the ACTIVE guard in the predicate, so a hold that
        // was CAPTURED between read and write is never touched (same guarantee
        // as the old per-hold path). One shared releasedAt per batch.
        const flipped = await this.prisma.walletHold.updateMany({
          where: {
            id: { in: page.map((h) => h.id) },
            status: 'ACTIVE',
            expiresAt: { lt: now },
          },
          data: { status: 'EXPIRED', releasedAt: now },
        });
        if (flipped.count < page.length) {
          this.logger.debug(
            `${page.length - flipped.count} hold(s) changed state concurrently — left untouched`,
          );
        }

        // Batched cache invalidation for affected wallets.
        const walletIds = [...new Set(page.map((h) => h.walletId))];
        const wallets = await this.prisma.wallet.findMany({
          where: { id: { in: walletIds } },
          select: { userId: true },
        });
        await Promise.all(
          [...new Set(wallets.map((w) => w.userId))].map((userId) =>
            this.redis.del(`wallet:balance:${userId}`).catch(() => {}),
          ),
        );

        totalExpired += flipped.count;
        batches += 1;
        this.logger.log(`Expired ${flipped.count} stale hold(s) (batch of ${page.length})`);
        if (page.length < BATCH) break;
        cursor = page[page.length - 1].id;
      }

      // G6: single audit row per tick (not per hold, not per batch) so the
      // expiry trail is queryable without spamming the audit table.
      if (totalExpired > 0) {
        await this.prisma.auditLog.create({
          data: {
            action: 'WALLET_HOLD_EXPIRE',
            adminName: 'system',
            targetType: 'WalletHold',
            targetName: `${totalExpired} hold(s) in ${batches} batch(es)`,
            details: `Cron released ${totalExpired} stale hold(s) across ${batches} batch(es)`,
            category: 'wallet',
          },
        });
      }
    } finally {
      await this.redis.del(lockKey).catch(() => {});
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runReconciliation(): Promise<void> {
    const lockKey = 'cron:reconciliation';
    const acquired = await this.redis.setNx(lockKey, '1', 3500);
    if (!acquired) {
      this.logger.debug('Wallet reconciliation cron already running on another instance — skipping');
      return;
    }

    this.logger.log('Starting nightly wallet reconciliation...');

    try {
      const [credits, debits, holds, wallets] = await Promise.all([
        this.prisma.walletTransaction.groupBy({
          by: ['walletId'],
          where: { type: 'CREDIT', status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        this.prisma.walletTransaction.groupBy({
          by: ['walletId'],
          where: { type: 'DEBIT', status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        this.prisma.walletHold.groupBy({
          by: ['walletId'],
          where: { status: 'ACTIVE' },
          _sum: { amount: true },
        }),
        this.prisma.wallet.findMany({ select: { id: true, balance: true } }),
      ]);

      const toMap = (rows: Array<{ walletId: string; _sum: { amount: Decimal | null } }>) => {
        const map = new Map<string, Decimal>();
        for (const row of rows) {
          map.set(row.walletId, row._sum.amount ?? new Decimal(0));
        }
        return map;
      };

      const creditMap = toMap(credits);
      const debitMap = toMap(debits);
      const holdMap = toMap(holds);

      let discrepancies = 0;
      for (const wallet of wallets) {
        const expected = (creditMap.get(wallet.id) ?? new Decimal(0))
          .minus(debitMap.get(wallet.id) ?? new Decimal(0))
          .minus(holdMap.get(wallet.id) ?? new Decimal(0));

        const actual = wallet.balance;
        if (!expected.equals(actual)) {
          discrepancies++;
          this.logger.error(
            `RECONCILIATION DRIFT — wallet ${wallet.id}: expected ${expected.toNumber()}, actual ${actual.toNumber()}`,
          );
        }
      }

      this.logger.log(
        `Reconciliation complete: ${wallets.length} wallets checked, ${discrepancies} discrepancy(ies) found.`,
      );
    } finally {
      await this.redis.del(lockKey).catch(() => {});
    }
  }
}