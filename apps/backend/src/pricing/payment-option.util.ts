import { BadRequestException } from '@nestjs/common';
import {
  MembershipPaymentPlan,
  PaymentPriceMode,
  PlanTier,
} from '@prisma/client';

/**
 * Canonical tier identifiers used by the relational pricing tables.
 * 'Normal' is a legacy alias of Standard (old MembershipTier enum + old UI).
 */
export type CanonicalTier = 'Standard' | 'Pro' | 'ProPlus';

export function normalizePlanTier(raw: string): PlanTier {
  const t = (raw || '').trim().toLowerCase().replace(/[^a-z0-9+]/g, '');
  if (t === 'pro') return PlanTier.Pro;
  if (t.includes('plus') || t.includes('+') || t === 'proplus') return PlanTier.ProPlus;
  return PlanTier.Standard;
}

export function planTierLabel(tier: PlanTier): CanonicalTier {
  if (tier === PlanTier.Pro) return 'Pro';
  if (tier === PlanTier.ProPlus) return 'ProPlus';
  return 'Standard';
}

/** Display label for the tier (ProPlus renders as Pro+ in the UI). */
export function planTierDisplay(tier: PlanTier): string {
  if (tier === PlanTier.ProPlus) return 'Pro+';
  if (tier === PlanTier.Pro) return 'Pro';
  return 'Standard';
}

export function normalizePaymentPlan(raw: string): MembershipPaymentPlan {
  const t = (raw || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (t === 'monthly' || t === 'month' || t === 'm') return MembershipPaymentPlan.monthly;
  if (t === 'quarterly' || t === 'quarter' || t === 'q') return MembershipPaymentPlan.quarterly;
  if (t === 'halfyearly' || t === 'halfyear' || t === 'semiannual' || t === 'half') {
    return MembershipPaymentPlan.halfYearly;
  }
  return MembershipPaymentPlan.full;
}

export interface AllowedSplit {
  paymentPlan: MembershipPaymentPlan;
  installments: number;
  /** Days of access granted per successful charge. 'duration' = whole tier term. */
  sliceDays: number | 'duration';
  sortOrder: number;
}

/**
 * Which payment splits each tier supports. The source of truth for validation:
 * a split with no row here can never be created or quoted.
 * - Standard (90d): outright or 3× monthly (~30d each)
 * - Pro (180d): outright, 2× quarterly (~90d each) or 6× monthly
 * - Pro+ (~365d): outright, 2× half-yearly, 4× quarterly or 12× monthly
 */
export const ALLOWED_SPLITS: Record<CanonicalTier, AllowedSplit[]> = {
  Standard: [
    { paymentPlan: MembershipPaymentPlan.full, installments: 1, sliceDays: 'duration', sortOrder: 0 },
    { paymentPlan: MembershipPaymentPlan.monthly, installments: 3, sliceDays: 30, sortOrder: 1 },
  ],
  Pro: [
    { paymentPlan: MembershipPaymentPlan.full, installments: 1, sliceDays: 'duration', sortOrder: 0 },
    { paymentPlan: MembershipPaymentPlan.quarterly, installments: 2, sliceDays: 90, sortOrder: 1 },
    { paymentPlan: MembershipPaymentPlan.monthly, installments: 6, sliceDays: 30, sortOrder: 2 },
  ],
  ProPlus: [
    { paymentPlan: MembershipPaymentPlan.full, installments: 1, sliceDays: 'duration', sortOrder: 0 },
    { paymentPlan: MembershipPaymentPlan.halfYearly, installments: 2, sliceDays: 180, sortOrder: 1 },
    { paymentPlan: MembershipPaymentPlan.quarterly, installments: 4, sliceDays: 91, sortOrder: 2 },
    { paymentPlan: MembershipPaymentPlan.monthly, installments: 12, sliceDays: 30, sortOrder: 3 },
  ],
};

export function allowedSplit(
  tier: CanonicalTier,
  paymentPlan: MembershipPaymentPlan,
): AllowedSplit | undefined {
  return ALLOWED_SPLITS[tier].find((s) => s.paymentPlan === paymentPlan);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ResolvedOptionPrice {
  perChargePrice: number;
  totalPrice: number;
}

/**
 * Server-side price resolution for one payment option row.
 * - manual: charges `manualPrice` per installment (admin-set).
 * - auto: per-charge = round2((fullPrice / installments) * (1 + surchargePct/100)),
 *   so partitioned payers pay slightly more in total than outright payers.
 * Throws layman-friendly BadRequestException on invalid input (never leaks internals).
 */
export function resolveOptionPrice(
  fullPrice: number,
  installments: number,
  mode: PaymentPriceMode,
  manualPrice?: number | null,
  surchargePct?: number | null,
): ResolvedOptionPrice {
  if (!Number.isFinite(fullPrice) || fullPrice < 0) {
    throw new BadRequestException('The full-term price must be £0 or more.');
  }
  if (!Number.isInteger(installments) || installments < 1) {
    throw new BadRequestException('Installments must be a whole number of 1 or more.');
  }
  if (mode === PaymentPriceMode.manual) {
    if (manualPrice == null || !Number.isFinite(manualPrice)) {
      throw new BadRequestException('Please enter a price for the manual payment option.');
    }
    if (manualPrice < 0) {
      throw new BadRequestException('Price cannot be negative.');
    }
    const perChargePrice = round2(manualPrice);
    return { perChargePrice, totalPrice: round2(perChargePrice * installments) };
  }
  const pct = surchargePct ?? 0;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new BadRequestException('Surcharge must be between 0% and 100%.');
  }
  const perChargePrice = round2((fullPrice / installments) * (1 + pct / 100));
  return { perChargePrice, totalPrice: round2(perChargePrice * installments) };
}
