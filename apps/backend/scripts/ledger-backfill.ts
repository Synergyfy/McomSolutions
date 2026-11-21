/* eslint-disable no-console */
/**
 * Reconstruct the central ledger from historical single-sided records.
 *
 * Usage:
 *   npx ts-node scripts/ledger-backfill.ts                  # dry run + report
 *   npx ts-node scripts/ledger-backfill.ts --apply          # write + report
 *   npx ts-node scripts/ledger-backfill.ts --apply --since=2026-01-01
 *   npx ts-node scripts/ledger-backfill.ts --rebuild        # recompute balances
 *
 * Every write is idempotent (`backfill:<source>:<id>`), so re-running is safe.
 * A dry run validates every planned transfer and writes nothing.
 */
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ChartOfAccountsService } from '../src/ledger/chart-of-accounts.service';
import { GlPostingService } from '../src/ledger/gl-posting.service';
import { LedgerBackfillService } from '../src/ledger/ledger-backfill.service';
import { LedgerReconciliationService } from '../src/ledger/ledger-reconciliation.service';

/**
 * Deliberately does NOT import LedgerModule: that module now carries the admin
 * controller, which drags in AuthModule and the whole auth graph (Redis, JWT,
 * profile sync). A maintenance CLI needs five providers, not an application.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    ChartOfAccountsService,
    GlPostingService,
    LedgerBackfillService,
    LedgerReconciliationService,
  ],
})
class LedgerCliModule {}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function printReport(report: Awaited<ReturnType<LedgerReconciliationService['getReport']>>) {
  console.log('\n── Ledger reconciliation ─────────────────────────────');
  console.log(`accounts checked      ${report.accountsChecked}`);
  console.log(`assets                £${(Number(report.assetTotalMinor) / 100).toFixed(2)}`);
  console.log(`liabilities           £${(Number(report.liabilityTotalMinor) / 100).toFixed(2)}`);
  console.log(`equity                £${(Number(report.equityTotalMinor) / 100).toFixed(2)}`);
  console.log(`identity holds        ${report.identityHolds ? 'yes' : `NO (${report.identityDifferenceMinor})`}`);
  console.log(`account drift         ${report.accountDrift.length}`);
  console.log(`wallet drift          ${report.walletDrift.length}`);
  console.log(`wallets w/o account   ${report.walletsWithoutAccount}`);

  for (const drift of report.accountDrift.slice(0, 20)) {
    console.log(`  account ${drift.code}: stored ${drift.storedMinor}, expected ${drift.expectedMinor}`);
  }
  for (const drift of report.walletDrift.slice(0, 20)) {
    console.log(`  wallet ${drift.walletId}: wallet ${drift.walletBalanceMinor}, ledger ${drift.ledgerBalanceMinor}`);
  }

  console.log(`\nHEALTHY: ${report.healthy ? 'yes' : 'NO'}`);
}

async function main() {
  const logger = new Logger('ledger-cli');
  const app = await NestFactory.createApplicationContext(LedgerCliModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const backfill = app.get(LedgerBackfillService);
    const reconciliation = app.get(LedgerReconciliationService);

    if (flag('rebuild')) {
      const result = await reconciliation.rebuildBalances();
      console.log(`Balances rebuilt: ${result.repaired} repaired, ${result.remainingDrift} remaining.`);
      return;
    }

    if (flag('shadow')) {
      const shadow = await reconciliation.shadowCompare();
      console.log('\n── Shadow comparison ─────────────────────────────────');
      console.log(`paid charges          ${shadow.charges.paid}`);
      console.log(`with journal entries  ${shadow.charges.withJournal}`);
      console.log(`missing journal       ${shadow.charges.missing.length}`);
      for (const miss of shadow.charges.missing.slice(0, 20)) {
        console.log(`  ${miss.id} (${miss.appClientId})`);
      }
      console.log(`app payable mismatch  ${shadow.appPayables.length}`);
      for (const row of shadow.appPayables.slice(0, 20)) {
        console.log(
          `  ${row.appClientId}: expected ${row.expectedMinor}, ledger ${row.ledgerMinor} (${row.differenceMinor})`,
        );
      }
      console.log(`wallet drift          ${shadow.walletDrift}`);
      console.log(`identity holds        ${shadow.identityHolds ? 'yes' : 'NO'}`);
      console.log(`\nHEALTHY: ${shadow.healthy ? 'yes' : 'NO'}`);
      if (!shadow.healthy) process.exitCode = 1;
      return;
    }

    const apply = flag('apply');
    const sinceRaw = arg('since');
    const limitRaw = arg('limit');

    const summary = await backfill.run({
      dryRun: !apply,
      since: sinceRaw ? new Date(`${sinceRaw}T00:00:00.000Z`) : undefined,
      limit: limitRaw ? Number(limitRaw) : undefined,
    });

    console.log('\n── Backfill summary ──────────────────────────────────');
    console.log(`mode                  ${summary.dryRun ? 'DRY RUN (nothing written)' : 'APPLIED'}`);
    console.log(`wallet transactions   ${summary.created.walletTransactions}`);
    console.log(`settlements           ${summary.created.settlements}`);
    console.log(`app charges           ${summary.created.appCharges}`);
    console.log(`app refunds           ${summary.created.appRefunds}`);
    console.log(`billing transactions  ${summary.created.billingTransactions}`);
    console.log(`skipped               ${summary.skipped}`);
    console.log(`failed                ${summary.failed.length}`);
    for (const failure of summary.failed.slice(0, 20)) {
      console.log(`  ${failure.key}: ${failure.reason}`);
    }

    if (apply) {
      printReport(await reconciliation.getReport());
    }

    if (summary.failed.length > 0) {
      logger.error(`${summary.failed.length} transfers failed — review before switching reads to the ledger.`);
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Ledger CLI failed:', err);
  process.exitCode = 1;
});
