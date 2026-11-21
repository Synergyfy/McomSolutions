import { GlIntent } from '@prisma/client';
import { appPayableAccountCode, EQUITY_OPENING_CODE, gatewayAccountCode, PLATFORM_WALLET_CODE, walletAccountCode } from './account-code';
import { INTERNAL_PLATFORM_CLIENT_ID, toMinorUnits } from './money';

export { toMinorUnits };

export interface GlLegPlan {
  account: string;
  direction: 'debit' | 'credit';
  amountMinor: bigint;
}

export interface PostingPlan {
  intent: GlIntent;
  legs: GlLegPlan[];
  /** Why this plan looks the way it does — stored on the transfer metadata. */
  reason: string;
  /** True when a counterparty had to be inferred rather than known. */
  inferred: boolean;
}

export interface WalletTxnLike {
  id: string;
  walletId: string;
  type: 'CREDIT' | 'DEBIT';
  /** Prisma Decimal or number. */
  amount: unknown;
  category: string;
  platformClientId: string | null;
  metadata: unknown;
}

export interface WalletChargeContext {
  appClientId: string;
  amountMinor: bigint;
  feeMinor: bigint;
  netMinor: bigint;
  intent?: GlIntent | null;
}

export interface BackfillContext {
  /** wallet transaction id → the app charge it settled. */
  chargeByWalletTxnId: Map<string, WalletChargeContext>;
  /** wallet transaction id → top-up provider. */
  topUpProviderByWalletTxnId: Map<string, string>;
  /** wallet transaction ids that a settlement transfer already covers. */
  settledWalletTxnIds: Set<string>;
  /** wallet transaction ids that paid a referral commission. */
  referralWalletTxnIds: Set<string>;
}

function categoryIntent(category: string): GlIntent {
  switch (category) {
    case 'TOP_UP':
      return GlIntent.TOP_UP;
    case 'PURCHASE':
      return GlIntent.PURCHASE;
    case 'SUBSCRIPTION':
      return GlIntent.SUBSCRIPTION;
    case 'REFUND':
      return GlIntent.REFUND;
    case 'ADMIN_CREDIT':
    case 'ADMIN_DEBIT':
      return GlIntent.ADJUSTMENT;
    default:
      return GlIntent.TRANSFER;
  }
}

/**
 * Reconstruct the journal entry for one historical wallet transaction.
 *
 * History is single-sided, so a counterparty has to be inferred. The rules are
 * ordered from most-certain to least-certain, and anything we cannot attribute
 * lands on `equity:opening` — never on a real party, and always flagged. This
 * function is pure so the inference table is unit-testable without a database.
 */
export function planWalletTransaction(
  txn: WalletTxnLike,
  ctx: BackfillContext,
): PostingPlan | null {
  const amount = toMinorUnits(txn.amount);
  if (amount <= 0n) return null;
  if (ctx.settledWalletTxnIds.has(txn.id)) return null;

  const wallet = walletAccountCode(txn.walletId);
  const walletLeg = (direction: 'debit' | 'credit'): GlLegPlan => ({
    account: wallet,
    direction,
    amountMinor: amount,
  });
  const counterparty = (account: string, direction: 'debit' | 'credit', value = amount): GlLegPlan => ({
    account,
    direction,
    amountMinor: value,
  });

  // 1. Top-ups: the money demonstrably came from a payment provider.
  const provider =
    ctx.topUpProviderByWalletTxnId.get(txn.id) ??
    (txn.category === 'TOP_UP' ? readMetadataString(txn.metadata, 'provider') : undefined);
  if (txn.category === 'TOP_UP' || provider) {
    return {
      intent: GlIntent.TOP_UP,
      reason: provider ? `top-up via ${provider}` : 'top-up, provider unknown',
      inferred: !provider,
      legs: [
        walletLeg('credit'),
        counterparty(gatewayAccountCode(provider ?? 'stripe'), 'debit'),
      ],
    };
  }

  // 2. Wallet-settled app charges: rebuild the whole charge (payer, payee, fee).
  const charge = ctx.chargeByWalletTxnId.get(txn.id);
  if (charge && txn.type === 'DEBIT') {
    const legs: GlLegPlan[] = [
      { account: wallet, direction: 'debit', amountMinor: charge.amountMinor },
    ];
    // A reward-funded charge can legitimately have a zero net/fee split; a
    // zero-amount leg is not a movement and must never reach the journal.
    if (charge.netMinor > 0n) {
      legs.push({ account: appPayableAccountCode(charge.appClientId), direction: 'credit', amountMinor: charge.netMinor });
    }
    if (charge.feeMinor > 0n) {
      legs.push({ account: PLATFORM_WALLET_CODE, direction: 'credit', amountMinor: charge.feeMinor });
    }
    const credited = legs.reduce(
      (sum, leg) => (leg.direction === 'credit' ? sum + leg.amountMinor : sum),
      0n,
    );
    if (credited !== charge.amountMinor) {
      // The stored split does not reconcile; fall through to the safe default
      // rather than book an unbalanced transfer.
      return {
        intent: GlIntent.ORDER,
        reason: `wallet charge ${charge.appClientId} with inconsistent split`,
        inferred: true,
        legs: [
          { account: wallet, direction: 'debit', amountMinor: charge.amountMinor },
          { account: appPayableAccountCode(charge.appClientId), direction: 'credit', amountMinor: charge.amountMinor },
        ],
      };
    }
    return {
      intent: charge.intent ?? GlIntent.ORDER,
      reason: `wallet charge ${charge.appClientId}`,
      inferred: false,
      legs,
    };
  }

  // 3. Platform-bound spending from a wallet (memberships, plans, renewals).
  if (
    txn.type === 'DEBIT' &&
    (txn.category === 'SUBSCRIPTION' || txn.category === 'PURCHASE') &&
    txn.platformClientId === INTERNAL_PLATFORM_CLIENT_ID
  ) {
    return {
      intent: categoryIntent(txn.category),
      reason: 'platform sale funded from the wallet',
      inferred: false,
      legs: [walletLeg('debit'), counterparty(PLATFORM_WALLET_CODE, 'credit')],
    };
  }

  // 4. Partner app movements that are not wallet-to-wallet settlements.
  if (txn.platformClientId && txn.platformClientId !== INTERNAL_PLATFORM_CLIENT_ID) {
    const payable = appPayableAccountCode(txn.platformClientId);
    return {
      // Keep the category: a refund booked by a partner app is still a refund.
      intent: categoryIntent(txn.category),
      reason: `partner app ${txn.platformClientId}`,
      inferred: true,
      legs: txn.type === 'DEBIT'
        ? [walletLeg('debit'), counterparty(payable, 'credit')]
        : [walletLeg('credit'), counterparty(payable, 'debit')],
    };
  }

  // 5. Everything else: opening equity, flagged, so no real party is invented.
  return {
    intent: ctx.referralWalletTxnIds.has(txn.id)
      ? GlIntent.REFERRAL_COMMISSION
      : categoryIntent(txn.category),
    reason: `unattributed ${txn.type.toLowerCase()} (${txn.category})`,
    inferred: true,
    legs: [
      txn.type === 'CREDIT' ? walletLeg('credit') : walletLeg('debit'),
      txn.type === 'CREDIT'
        ? counterparty(EQUITY_OPENING_CODE, 'debit')
        : counterparty(EQUITY_OPENING_CODE, 'credit'),
    ],
  };
}

export interface SettlementPlanInput {
  id: string;
  businessWalletId: string;
  affiliateWalletId: string | null;
  businessChargeMinor: bigint;
  affiliatePayoutMinor: bigint;
  fundingSource: string;
}

/**
 * Rebuild a delegation settlement as one transfer instead of two loose rows.
 * Platform-funded payouts have no business leg — the platform wallet pays.
 */
export function planSettlement(input: SettlementPlanInput): PostingPlan | null {
  const legs: GlLegPlan[] = [];

  if (input.fundingSource === 'PLATFORM') {
    if (input.affiliatePayoutMinor > 0n) {
      legs.push({ account: PLATFORM_WALLET_CODE, direction: 'debit', amountMinor: input.affiliatePayoutMinor });
      if (input.affiliateWalletId) {
        legs.push({ account: walletAccountCode(input.affiliateWalletId), direction: 'credit', amountMinor: input.affiliatePayoutMinor });
      } else {
        legs.push({ account: EQUITY_OPENING_CODE, direction: 'credit', amountMinor: input.affiliatePayoutMinor });
      }
    }
  } else {
    if (input.businessChargeMinor <= 0n) return null;
    legs.push({ account: walletAccountCode(input.businessWalletId), direction: 'debit', amountMinor: input.businessChargeMinor });
    if (input.affiliatePayoutMinor > 0n) {
      if (input.affiliateWalletId) {
        legs.push({ account: walletAccountCode(input.affiliateWalletId), direction: 'credit', amountMinor: input.affiliatePayoutMinor });
      } else {
        legs.push({ account: EQUITY_OPENING_CODE, direction: 'credit', amountMinor: input.affiliatePayoutMinor });
      }
    }
    const retention = input.businessChargeMinor - input.affiliatePayoutMinor;
    if (retention > 0n) {
      legs.push({ account: PLATFORM_WALLET_CODE, direction: 'credit', amountMinor: retention });
    }
  }

  if (legs.length < 2) return null;

  return {
    intent: GlIntent.DELEGATION,
    reason: `delegation settlement ${input.id}`,
    inferred: input.affiliateWalletId === null,
    legs,
  };
}

function readMetadataString(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
