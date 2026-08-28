import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';
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
    private readonly walletService: WalletService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleHolds(): Promise<void> {
    const expired = await this.prisma.walletHold.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      take: 100,
    });

    for (const hold of expired) {
      try {
        await this.walletService.releaseHoldInternal(hold.id, 'EXPIRED');
        this.logger.log(`Hold ${hold.id} expired and released`);
      } catch (err) {
        this.logger.error(`Failed to release expired hold ${hold.id}: ${err.message}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runReconciliation(): Promise<void> {
    this.logger.log('Starting nightly wallet reconciliation...');

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
  }
}