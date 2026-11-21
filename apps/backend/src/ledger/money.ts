import { GlIntent } from '@prisma/client';

/** The platform's own client id — internal movements, not a partner app. */
export const INTERNAL_PLATFORM_CLIENT_ID = 'mcom-central';

const CATEGORY_INTENT: Record<string, GlIntent> = {
  TOP_UP: GlIntent.TOP_UP,
  PURCHASE: GlIntent.PURCHASE,
  SUBSCRIPTION: GlIntent.SUBSCRIPTION,
  REFUND: GlIntent.REFUND,
  SERVICE_FEE: GlIntent.FEE,
  ADMIN_CREDIT: GlIntent.ADJUSTMENT,
  ADMIN_DEBIT: GlIntent.ADJUSTMENT,
  TRANSFER_IN: GlIntent.TRANSFER,
  TRANSFER_OUT: GlIntent.TRANSFER,
  HOLD_CAPTURE: GlIntent.TRANSFER,
  REWARD: GlIntent.TRANSFER,
};

/**
 * Default business intent for a wallet category. Call sites that know better
 * (referral payout, delegation, order) pass an explicit intent instead.
 */
export function intentForCategory(category: string): GlIntent {
  return CATEGORY_INTENT[category] ?? GlIntent.TRANSFER;
}

/**
 * Money is stored as Decimal pounds in wallets and BigInt pence in the ledger.
 * This is the only place that conversion happens, so the two can never disagree
 * on rounding.
 */
export function toMinorUnits(amount: unknown): bigint {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot convert non-numeric amount to minor units: ${String(amount)}`);
  }
  return BigInt(Math.round(value * 100));
}

export function fromMinorUnits(amountMinor: bigint): number {
  return Number(amountMinor) / 100;
}
