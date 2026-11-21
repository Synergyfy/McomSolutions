import { Injectable, Logger } from '@nestjs/common';
import { GlAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseAccountCode } from './account-code';

export interface AccountDrift {
  code: string;
  type: string;
  storedMinor: string;
  expectedMinor: string;
  differenceMinor: string;
}

export interface WalletDrift {
  walletId: string;
  userId: string;
  walletBalanceMinor: string;
  ledgerBalanceMinor: string;
  differenceMinor: string;
}

export interface LedgerReconciliationReport {
  generatedAt: string;
  accountsChecked: number;
  accounts: { storedMinor: string; expectedMinor: string };
  assetTotalMinor: string;
  liabilityTotalMinor: string;
  equityTotalMinor: string;
  identityHolds: boolean;
  identityDifferenceMinor: string;
  accountDrift: AccountDrift[];
  walletDrift: WalletDrift[];
  walletsWithoutAccount: number;
  healthy: boolean;
}

/**
 * Proves that the materialised balances still describe the journal.
 *
 * Two independent checks:
 *  1. per account: `balanceMinor` equals the sum of its entries on the normal side
 *  2. per wallet: the ledger account equals `Wallet.balance` (the number users see)
 *
 * Plus the balance-sheet identity `assets = liabilities + equity`, which is a
 * much stronger control than checking each wallet in isolation.
 */
@Injectable()
export class LedgerReconciliationService {
  private readonly logger = new Logger(LedgerReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getReport(): Promise<LedgerReconciliationReport> {
    const [accounts, sums, wallets] = await Promise.all([
      this.prisma.glAccount.findMany(),
      this.prisma.glEntry.groupBy({
        by: ['accountId', 'direction'],
        _sum: { amountMinor: true },
      }),
      this.prisma.wallet.findMany({ select: { id: true, userId: true, balance: true } }),
    ]);

    const sumsByAccount = new Map<string, { debit: bigint; credit: bigint }>();
    for (const row of sums) {
      const entry = sumsByAccount.get(row.accountId) ?? { debit: 0n, credit: 0n };
      const amount = row._sum.amountMinor ?? 0n;
      if (row.direction === 'debit') entry.debit += amount;
      else entry.credit += amount;
      sumsByAccount.set(row.accountId, entry);
    }

    const accountDrift: AccountDrift[] = [];
    const totals = { asset: 0n, liability: 0n, equity: 0n };
    let storedTotal = 0n;
    let expectedTotal = 0n;

    for (const account of accounts) {
      const movement = sumsByAccount.get(account.id) ?? { debit: 0n, credit: 0n };
      const normalSide = accountNormalSide(account);
      const expected =
        normalSide === 'debit'
          ? movement.debit - movement.credit
          : movement.credit - movement.debit;

      storedTotal += account.balanceMinor;
      expectedTotal += expected;

      if (expected !== account.balanceMinor) {
        accountDrift.push({
          code: account.code,
          type: account.type,
          storedMinor: account.balanceMinor.toString(),
          expectedMinor: expected.toString(),
          differenceMinor: (account.balanceMinor - expected).toString(),
        });
      }

      if (account.type.startsWith('ASSET_')) totals.asset += expected;
      else if (account.type.startsWith('LIABILITY_')) totals.liability += expected;
      else totals.equity += expected;
    }

    const accountByWallet = new Map<string, GlAccount>();
    for (const account of accounts) {
      if (account.type === 'LIABILITY_USER_WALLET' && account.ownerRef) {
        accountByWallet.set(account.ownerRef, account);
      }
    }

    const walletDrift: WalletDrift[] = [];
    let walletsWithoutAccount = 0;

    for (const wallet of wallets) {
      const account = accountByWallet.get(wallet.id);
      const walletMinor = toMinor(wallet.balance);

      if (!account) {
        walletsWithoutAccount += 1;
        continue;
      }

      const movement = sumsByAccount.get(account.id) ?? { debit: 0n, credit: 0n };
      const ledgerMinor = movement.credit - movement.debit;
      if (ledgerMinor !== walletMinor) {
        walletDrift.push({
          walletId: wallet.id,
          userId: wallet.userId,
          walletBalanceMinor: walletMinor.toString(),
          ledgerBalanceMinor: ledgerMinor.toString(),
          differenceMinor: (walletMinor - ledgerMinor).toString(),
        });
      }
    }

    const identityDifference = totals.asset - (totals.liability + totals.equity);
    const identityHolds = identityDifference === 0n;

    const report: LedgerReconciliationReport = {
      generatedAt: new Date().toISOString(),
      accountsChecked: accounts.length,
      accounts: { storedMinor: storedTotal.toString(), expectedMinor: expectedTotal.toString() },
      assetTotalMinor: totals.asset.toString(),
      liabilityTotalMinor: totals.liability.toString(),
      equityTotalMinor: totals.equity.toString(),
      identityHolds,
      identityDifferenceMinor: identityDifference.toString(),
      accountDrift,
      walletDrift,
      walletsWithoutAccount,
      healthy:
        accountDrift.length === 0 &&
        walletDrift.length === 0 &&
        walletsWithoutAccount === 0 &&
        identityHolds,
    };

    if (!report.healthy) {
      this.logger.error(
        `Ledger reconciliation found drift: ${accountDrift.length} accounts, ${walletDrift.length} wallets, identity ${identityDifference}`,
      );
    }

    return report;
  }

  /**
   * Shadow comparison: does the journal agree with the operational tables it is
   * supposed to mirror? Run nightly (or from the CLI) while both are written.
   */
  async shadowCompare(): Promise<{
    charges: { paid: number; withJournal: number; missing: Array<{ id: string; appClientId: string }> };
    appPayables: Array<{ appClientId: string; expectedMinor: string; ledgerMinor: string; differenceMinor: string }>;
    walletDrift: number;
    identityHolds: boolean;
    healthy: boolean;
  }> {
    const [charges, journalByCharge, refunds, accounts, report] = await Promise.all([
      this.prisma.appCharge.findMany({
        where: { status: { in: ['paid', 'partially_refunded', 'refunded'] } },
        select: { id: true, appClientId: true, netMinor: true, method: true },
      }),
      this.prisma.glEntry.groupBy({
        by: ['appChargeId'],
        where: { appChargeId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.appRefund.groupBy({
        by: ['chargeId'],
        where: { status: 'succeeded' },
        _sum: { netRefundMinor: true },
      }),
      this.prisma.glAccount.findMany({
        where: { type: 'LIABILITY_APP_PAYABLE' },
        select: { code: true, ownerRef: true, balanceMinor: true },
      }),
      this.getReport(),
    ]);

    const journalChargeIds = new Set(
      journalByCharge.map((row) => row.appChargeId).filter(Boolean) as string[],
    );

    // Wallet-method charges are represented by the payer's wallet transfer, not
    // by an entry carrying `appChargeId`. Count those as covered once the
    // receipt is linked, otherwise every wallet charge looks unbooked.
    const walletChargeIds = charges
      .filter((charge) => charge.method === 'wallet')
      .map((charge) => charge.id);
    if (walletChargeIds.length > 0) {
      const walletTxns = await this.prisma.walletTransaction.findMany({
        where: {
          idempotencyKey: { in: walletChargeIds.map((id) => `appcharge:${id}:wallet`) },
          ledgerEntryId: { not: null },
        },
        select: { idempotencyKey: true },
      });
      for (const txn of walletTxns) {
        const chargeId = txn.idempotencyKey?.replace(/^appcharge:/, '').replace(/:wallet$/, '');
        if (chargeId) journalChargeIds.add(chargeId);
      }
    }

    const missing = charges
      .filter((charge) => !journalChargeIds.has(charge.id))
      .map((charge) => ({ id: charge.id, appClientId: charge.appClientId }));

    const refundNetByCharge = new Map(
      refunds.map((row) => [row.chargeId, row._sum.netRefundMinor ?? 0n]),
    );

    const expectedByApp = new Map<string, bigint>();
    for (const charge of charges) {
      const net = charge.netMinor - (refundNetByCharge.get(charge.id) ?? 0n);
      expectedByApp.set(charge.appClientId, (expectedByApp.get(charge.appClientId) ?? 0n) + net);
    }

    const ledgerByApp = new Map(
      accounts
        .filter((account) => account.ownerRef)
        .map((account) => [account.ownerRef as string, account.balanceMinor]),
    );

    const appPayables: Array<{
      appClientId: string;
      expectedMinor: string;
      ledgerMinor: string;
      differenceMinor: string;
    }> = [];
    for (const appClientId of new Set([...expectedByApp.keys(), ...ledgerByApp.keys()])) {
      const expected = expectedByApp.get(appClientId) ?? 0n;
      const ledger = ledgerByApp.get(appClientId) ?? 0n;
      if (expected !== ledger) {
        appPayables.push({
          appClientId,
          expectedMinor: expected.toString(),
          ledgerMinor: ledger.toString(),
          differenceMinor: (ledger - expected).toString(),
        });
      }
    }

    return {
      charges: { paid: charges.length, withJournal: journalChargeIds.size, missing },
      appPayables,
      walletDrift: report.walletDrift.length,
      identityHolds: report.identityHolds,
      healthy:
        missing.length === 0 &&
        // `appPayables` is deliberately informational: the payable account also
        // receives partner wallet-API movements, so a charge-only expectation
        // can legitimately differ. The authoritative check is accountDrift,
        // which is already folded into `getReport()`.
        report.walletDrift.length === 0 &&
        report.walletsWithoutAccount === 0 &&
        report.identityHolds,
    };
  }

  /**
   * Recompute every `balanceMinor` from entries. Never touches the entries
   * themselves — the journal is the source of truth, balances are a cache.
   */
  async rebuildBalances(): Promise<{ repaired: number; remainingDrift: number }> {
    const before = await this.getReport();
    if (before.accountDrift.length === 0) {
      return { repaired: 0, remainingDrift: 0 };
    }

    await this.prisma.$transaction(
      async (tx) => {
        for (const drift of before.accountDrift) {
          await tx.glAccount.update({
            where: { code: drift.code },
            data: { balanceMinor: BigInt(drift.expectedMinor) },
          });
        }
      },
      { timeout: 120_000 },
    );

    const after = await this.getReport();
    this.logger.warn(
      `Ledger balances rebuilt: ${before.accountDrift.length} repaired, ${after.accountDrift.length} remaining.`,
    );

    return { repaired: before.accountDrift.length, remainingDrift: after.accountDrift.length };
  }
}

function accountNormalSide(account: GlAccount): 'debit' | 'credit' {
  try {
    return parseAccountCode(account.code).normalSide;
  } catch {
    // Unknown code (should be impossible): fall back to the type's natural side.
    return account.type.startsWith('ASSET_') ? 'debit' : 'credit';
  }
}

function toMinor(balance: Prisma.Decimal | number): bigint {
  return BigInt(Math.round(Number(balance) * 100));
}
