import { Injectable, Logger } from '@nestjs/common';
import { GlIntent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_WALLET_CODE, gatewayAccountCode, appPayableAccountCode } from './account-code';
import {
  BackfillContext,
  planSettlement,
  planWalletTransaction,
  toMinorUnits,
  type GlLegPlan,
  type PostingPlan,
  type WalletChargeContext,
} from './backfill.rules';
import { GlPostingService } from './gl-posting.service';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { planPosting } from './gl-posting.plan';

export interface BackfillOptions {
  dryRun?: boolean;
  since?: Date;
  limit?: number;
}

export interface BackfillSummary {
  dryRun: boolean;
  created: { walletTransactions: number; settlements: number; appCharges: number; appRefunds: number; billingTransactions: number };
  skipped: number;
  failed: Array<{ key: string; reason: string }>;
}

/**
 * Reconstructs the journal from historical single-sided records.
 *
 * Every write is idempotent (`backfill:<source>:<id>`), so running it twice is
 * a no-op and a partial run can be resumed. `dryRun` validates every plan and
 * writes nothing.
 *
 * Historical rows are replayed with balance guards disabled: a reconstruction
 * is not a live spend, and the reconciliation report — not a transient negative
 * during replay — is what certifies the result.
 */
@Injectable()
export class LedgerBackfillService {
  private readonly logger = new Logger(LedgerBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: GlPostingService,
    private readonly chart: ChartOfAccountsService,
  ) {}

  async run(options: BackfillOptions = {}): Promise<BackfillSummary> {
    const dryRun = options.dryRun ?? false;
    const summary: BackfillSummary = {
      dryRun,
      created: { walletTransactions: 0, settlements: 0, appCharges: 0, appRefunds: 0, billingTransactions: 0 },
      skipped: 0,
      failed: [],
    };

    const context = await this.buildContext();

    if (!dryRun) {
      await this.ensureWalletAccounts();
    }

    await this.backfillWalletTransactions(options, context, summary);
    await this.backfillSettlements(options, summary);
    await this.backfillAppCharges(options, summary);
    await this.backfillWalletRefundFees(options, summary);
    await this.backfillBillingTransactions(options, summary);

    this.logger.log(
      `Backfill ${dryRun ? '(dry run) ' : ''}complete: ${JSON.stringify(summary.created)}, skipped ${summary.skipped}, failed ${summary.failed.length}`,
    );

    return summary;
  }

  // ─── Sources ──────────────────────────────────────────────────────────────

  private async backfillWalletTransactions(
    options: BackfillOptions,
    context: BackfillContext,
    summary: BackfillSummary,
  ): Promise<void> {
    const rows = await this.prisma.walletTransaction.findMany({
      where: {
        ledgerEntryId: null,
        ...(options.since ? { createdAt: { gte: options.since } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.limit,
    });

    for (const txn of rows) {
      const plan = planWalletTransaction(
        {
          id: txn.id,
          walletId: txn.walletId,
          type: txn.type,
          amount: txn.amount,
          category: txn.category,
          platformClientId: txn.platformClientId,
          metadata: txn.metadata,
        },
        context,
      );

      if (!plan) {
        summary.skipped += 1;
        continue;
      }

      const key = `backfill:wallet-txn:${txn.id}`;
      const ok = await this.apply(key, plan, {
        dryRun: options.dryRun,
        summary,
        platformId: txn.platformClientId,
        reference: txn.reference,
        description: txn.description ?? `Backfilled ${txn.category}`,
        initiatorType: 'system',
        provenance: { walletTransactionId: txn.id },
        link: async (tx, transferId) => {
          const entry = await tx.glEntry.findFirst({
            where: { walletTransactionId: txn.id },
            select: { id: true },
          });
          await tx.walletTransaction.update({
            where: { id: txn.id },
            data: {
              transferId,
              intent: plan.intent,
              ledgerEntryId: entry?.id ?? null,
            },
          });
        },
      });

      if (ok) summary.created.walletTransactions += 1;
    }
  }

  private async backfillSettlements(
    options: BackfillOptions,
    summary: BackfillSummary,
  ): Promise<void> {
    const settlements = await this.prisma.affiliateTaskSettlement.findMany({
      where: {
        status: 'SETTLED',
        ...(options.since ? { settledAt: { gte: options.since } } : {}),
      },
      orderBy: [{ settledAt: 'asc' }, { id: 'asc' }],
      take: options.limit,
    });

    if (settlements.length === 0) return;

    const userIds = [
      ...new Set(
        settlements.flatMap((s) => [s.businessUserId, s.affiliateUserId].filter(Boolean) as string[]),
      ),
    ];
    const wallets = await this.prisma.wallet.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true },
    });
    const walletByUser = new Map(wallets.map((w) => [w.userId, w.id]));

    for (const settlement of settlements) {
      const businessWalletId = walletByUser.get(settlement.businessUserId);
      if (!businessWalletId) {
        summary.skipped += 1;
        continue;
      }

      const plan = planSettlement({
        id: settlement.id,
        businessWalletId,
        affiliateWalletId: settlement.affiliateUserId
          ? walletByUser.get(settlement.affiliateUserId) ?? null
          : null,
        businessChargeMinor: toMinorUnits(settlement.businessChargeCredits ?? 0),
        affiliatePayoutMinor: toMinorUnits(settlement.affiliatePayoutCredits ?? 0),
        fundingSource: settlement.fundingSource,
      });

      if (!plan) {
        summary.skipped += 1;
        continue;
      }

      const ok = await this.apply(`backfill:settlement:${settlement.id}`, plan, {
        dryRun: options.dryRun,
        summary,
        platformId: 'mcom-central',
        reference: settlement.settlementReference ?? `affiliate-task:${settlement.taskId}:settle`,
        description: `Backfilled delegation settlement ${settlement.id}`,
        initiatorType: 'system',
        provenance: { settlementId: settlement.id },
      });

      if (ok) summary.created.settlements += 1;
    }
  }

  private async backfillAppCharges(
    options: BackfillOptions,
    summary: BackfillSummary,
  ): Promise<void> {
    const charges = await this.prisma.appCharge.findMany({
      where: {
        method: { not: 'wallet' },
        status: { in: ['paid', 'partially_refunded', 'refunded'] },
        ...(options.since ? { paidAt: { gte: options.since } } : {}),
      },
      orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
      take: options.limit,
    });

    for (const charge of charges) {
      const clearing = gatewayAccountCode(charge.provider ?? charge.method);
      const legs: GlLegPlan[] = [
        { account: clearing, direction: 'debit', amountMinor: charge.amountMinor },
        { account: appPayableAccountCode(charge.appClientId), direction: 'credit', amountMinor: charge.netMinor },
      ];
      if (charge.feeMinor > 0n) {
        legs.push({ account: PLATFORM_WALLET_CODE, direction: 'credit', amountMinor: charge.feeMinor });
      }

      const ok = await this.apply(
        `backfill:app-charge:${charge.id}`,
        // Historical charges predate the `intent` field; they are recorded as
        // orders and flagged rather than guessing a booking vs an order.
        { intent: GlIntent.ORDER, legs, reason: `app charge ${charge.appClientId}`, inferred: true },
        {
          dryRun: options.dryRun,
          summary,
          platformId: charge.appClientId,
          reference: charge.reference,
          description: charge.description ?? `Backfilled charge ${charge.id}`,
          initiatorType: 'app',
          provenance: { appChargeId: charge.id },
        },
      );
      if (ok) summary.created.appCharges += 1;

      // Refunds mirror the charge so net positions are correct.
      const refunds = await this.prisma.appRefund.findMany({
        where: { chargeId: charge.id, status: 'succeeded' },
        orderBy: { createdAt: 'asc' },
      });
      for (const refund of refunds) {
        const refundLegs: GlLegPlan[] = [
          { account: appPayableAccountCode(charge.appClientId), direction: 'debit', amountMinor: refund.netRefundMinor },
          { account: clearing, direction: 'credit', amountMinor: refund.amountMinor },
        ];
        if (refund.feeRefundMinor > 0n) {
          refundLegs.push({ account: PLATFORM_WALLET_CODE, direction: 'debit', amountMinor: refund.feeRefundMinor });
        }
        const refundOk = await this.apply(
          `backfill:app-refund:${refund.id}`,
          { intent: GlIntent.REFUND, legs: refundLegs, reason: `refund of ${charge.id}`, inferred: false },
          {
            dryRun: options.dryRun,
            summary,
            platformId: charge.appClientId,
            reference: charge.reference,
            description: `Backfilled refund ${refund.id}`,
            initiatorType: 'app',
            provenance: { appRefundId: refund.id, appChargeId: charge.id },
          },
        );
        if (refundOk) summary.created.appRefunds += 1;
      }
    }
  }

  /**
   * Wallet-charge refunds are reconstructed by the wallet pass: the payer's
   * credit is booked as `debit payable (gross) / credit wallet`. That over-charges
   * the app by the refunded fee, so the fee share is handed back to it here.
   *
   * Card refunds post their fee leg directly and are not touched.
   */
  private async backfillWalletRefundFees(
    options: BackfillOptions,
    summary: BackfillSummary,
  ): Promise<void> {
    const refunds = await this.prisma.appRefund.findMany({
      where: {
        status: 'succeeded',
        feeRefundMinor: { gt: 0 },
        charge: { method: 'wallet' },
      },
      select: {
        id: true,
        feeRefundMinor: true,
        charge: { select: { id: true, appClientId: true, reference: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: options.limit,
    });

    for (const refund of refunds) {
      const fee = refund.feeRefundMinor;
      if (fee <= 0n) continue;

      const ok = await this.apply(
        `backfill:wallet-refund-fee:${refund.id}`,
        {
          intent: GlIntent.REFUND,
          legs: [
            { account: PLATFORM_WALLET_CODE, direction: 'debit', amountMinor: fee },
            { account: appPayableAccountCode(refund.charge.appClientId), direction: 'credit', amountMinor: fee },
          ],
          reason: `fee returned to app for wallet refund ${refund.id}`,
          inferred: false,
        },
        {
          dryRun: options.dryRun,
          summary,
          platformId: refund.charge.appClientId,
          reference: refund.charge.reference,
          description: `Backfilled refund fee ${refund.id}`,
          initiatorType: 'app',
          provenance: { appRefundId: refund.id, appChargeId: refund.charge.id },
        },
      );
      if (ok) summary.created.appRefunds += 1;
    }
  }

  private async backfillBillingTransactions(
    options: BackfillOptions,
    summary: BackfillSummary,
  ): Promise<void> {
    const rows = await this.prisma.billingTransaction.findMany({
      where: {
        provider: { in: ['stripe', 'paypal'] },
        status: 'paid',
        amount: { gt: 0 },
        ...(options.since ? { createdAt: { gte: options.since } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: options.limit,
    });

    for (const row of rows) {
      const amountMinor = toMinorUnits(row.amount);
      if (amountMinor <= 0n) continue;

      const ok = await this.apply(
        `backfill:billing:${row.id}`,
        {
          intent: GlIntent.PURCHASE,
          legs: [
            { account: gatewayAccountCode(row.provider ?? 'stripe'), direction: 'debit', amountMinor },
            { account: PLATFORM_WALLET_CODE, direction: 'credit', amountMinor },
          ],
          reason: 'central sale via payment provider',
          inferred: false,
        },
        {
          dryRun: options.dryRun,
          summary,
          platformId: 'mcom-central',
          reference: row.providerPaymentId,
          description: row.description,
          initiatorType: 'system',
        },
      );
      if (ok) summary.created.billingTransactions += 1;
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /**
   * Every wallet gets a ledger account, even a dormant one, so the chart is a
   * complete mirror of the wallet table and reconciliation has nothing to
   * excuse.
   */
  private async ensureWalletAccounts(): Promise<void> {
    const wallets = await this.prisma.wallet.findMany({ select: { id: true } });
    // Small batches with a generous timeout: a managed Postgres pooler (e.g.
    // Supabase) aborts long interactive transactions, and creating hundreds of
    // accounts in one transaction is exactly that.
    const batchSize = 100;

    for (let i = 0; i < wallets.length; i += batchSize) {
      const codes = wallets
        .slice(i, i + batchSize)
        .map((wallet) => `wallet:${wallet.id}`);

      await this.prisma.$transaction(
        async (tx) => {
          await this.chart.ensureAccounts(tx, codes);
        },
        { timeout: 120_000 },
      );
    }
  }

  private async buildContext(): Promise<BackfillContext> {
    const settled = await this.prisma.affiliateTaskSettlement.findMany({
      where: {
        OR: [
          { businessTransactionId: { not: null } },
          { affiliateTransactionId: { not: null } },
        ],
      },
      select: { businessTransactionId: true, affiliateTransactionId: true },
    });

    const settledWalletTxnIds = new Set<string>();
    for (const row of settled) {
      if (row.businessTransactionId) settledWalletTxnIds.add(row.businessTransactionId);
      if (row.affiliateTransactionId) settledWalletTxnIds.add(row.affiliateTransactionId);
    }

    const chargeByWalletTxnId = new Map<string, WalletChargeContext>();
    const walletCharges = await this.prisma.appCharge.findMany({
      where: { method: 'wallet' },
      select: {
        id: true,
        appClientId: true,
        amountMinor: true,
        feeMinor: true,
        netMinor: true,
      },
    });
    if (walletCharges.length > 0) {
      const keys = walletCharges.map((c) => `appcharge:${c.id}:wallet`);
      const txns = await this.prisma.walletTransaction.findMany({
        where: { idempotencyKey: { in: keys } },
        select: { id: true, idempotencyKey: true },
      });
      const chargeById = new Map(walletCharges.map((c) => [c.id, c]));
      for (const txn of txns) {
        const chargeId = txn.idempotencyKey?.replace(/^appcharge:/, '').replace(/:wallet$/, '');
        const charge = chargeId ? chargeById.get(chargeId) : undefined;
        if (charge) {
          chargeByWalletTxnId.set(txn.id, {
            appClientId: charge.appClientId,
            amountMinor: charge.amountMinor,
            feeMinor: charge.feeMinor,
            netMinor: charge.netMinor,
          });
        }
      }
    }

    const topUpProviderByWalletTxnId = new Map<string, string>();
    const topUps = await this.prisma.walletTopUpRequest.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true, provider: true },
    });
    if (topUps.length > 0) {
      // Top-up rows do not store the wallet transaction id, but the credit is
      // written with a deterministic key: `topup:<requestId>`.
      const txns = await this.prisma.walletTransaction.findMany({
        where: { idempotencyKey: { in: topUps.map((t) => `topup:${t.id}`) } },
        select: { id: true, idempotencyKey: true },
      });
      const providerByKey = new Map(topUps.map((t) => [`topup:${t.id}`, t.provider]));
      for (const txn of txns) {
        const provider = txn.idempotencyKey ? providerByKey.get(txn.idempotencyKey) : undefined;
        if (provider) topUpProviderByWalletTxnId.set(txn.id, provider);
      }
    }

    const referralWalletTxnIds = new Set<string>();
    const referralCredits = await this.prisma.referralCommission.findMany({
      where: { walletTransactionId: { not: null } },
      select: { walletTransactionId: true },
    });
    for (const row of referralCredits) {
      if (row.walletTransactionId) referralWalletTxnIds.add(row.walletTransactionId);
    }

    return {
      chargeByWalletTxnId,
      topUpProviderByWalletTxnId,
      settledWalletTxnIds,
      referralWalletTxnIds,
    };
  }

  private async apply(
    key: string,
    plan: PostingPlan,
    opts: {
      dryRun?: boolean;
      summary: BackfillSummary;
      platformId?: string | null;
      reference?: string | null;
      description?: string;
      initiatorType: 'user' | 'app' | 'admin' | 'system';
      provenance?: {
        walletTransactionId?: string | null;
        appChargeId?: string | null;
        appRefundId?: string | null;
        settlementId?: string | null;
      };
      link?: (tx: Prisma.TransactionClient, transferId: string) => Promise<void>;
    },
  ): Promise<boolean> {
    try {
      if (opts.dryRun) {
        // Validate the shape without touching the database.
        planPosting([{ legs: plan.legs }]);
        return true;
      }

      let wrote = false;

      await this.prisma.$transaction(
        async (tx) => {
        const result = await this.posting.post(tx, {
          intent: plan.intent,
          platformId: opts.platformId ?? null,
          reference: opts.reference ?? null,
          description: opts.description,
          initiatorType: opts.initiatorType,
          idempotencyKey: key,
          transactions: [{ legs: plan.legs }],
          metadata: {
            backfilled: true,
            sourceReason: plan.reason,
            inferredCounterparty: plan.inferred,
          },
          provenance: opts.provenance,
          // Replay is a reconstruction, not a live spend.
          allowNegative: plan.legs.map((leg) => leg.account),
        });

        // Run the link even on replay: it repairs a crash between posting and
        // linking, and is idempotent.
        if (opts.link) await opts.link(tx, result.transferId);
        wrote = !result.replayed;
        },
        { timeout: 60_000 },
      );

      return wrote;
    } catch (err: any) {
      opts.summary.failed.push({ key, reason: err?.message ?? String(err) });
      this.logger.warn(`Backfill failed for ${key}: ${err?.message ?? err}`);
      return false;
    }
  }
}
