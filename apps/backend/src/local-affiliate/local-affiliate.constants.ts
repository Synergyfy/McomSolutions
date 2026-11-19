import {
  AffiliateIntegrationLevel,
  AffiliateLedgerEntryType,
  AffiliateQualifyingEvent,
  AffiliateRewardStatus,
  Role,
} from '@prisma/client';

/** Version string recorded on every affiliate profile at activation. */
export const LOCAL_AFFILIATE_TERMS_VERSION = '2026-11-01';

/**
 * Default attribution window (days). Configurable per offer/campaign; the
 * effective value is snapshotted onto the conversion so a later policy change
 * never rewrites history.
 */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/** Roles allowed to hold a Local Affiliate profile. ADMIN is excluded. */
export const AFFILIATE_ELIGIBLE_ROLES: Role[] = [
  Role.CUSTOMER,
  Role.BUSINESS,
  Role.PARTNER,
];

/** Events that imply a purchase-like outcome and therefore need a click. */
export const PURCHASE_LIKE_EVENTS: AffiliateQualifyingEvent[] = [
  AffiliateQualifyingEvent.APPROVED_PURCHASE,
  AffiliateQualifyingEvent.COMPLETED_BOOKING,
];

const ALL_EVENTS: AffiliateQualifyingEvent[] = [
  AffiliateQualifyingEvent.LINK_CLICK,
  AffiliateQualifyingEvent.QUALIFIED_VISIT,
  AffiliateQualifyingEvent.VERIFIED_LEAD,
  AffiliateQualifyingEvent.COMPLETED_BOOKING,
  AffiliateQualifyingEvent.APPROVED_PURCHASE,
  AffiliateQualifyingEvent.VERIFIED_REDEMPTION,
  AffiliateQualifyingEvent.CANCELLED_REFUNDED,
];

/**
 * Which qualifying events an integration level can actually verify.
 *
 * This is the enforcement of the source model §16: "the campaign configuration
 * must restrict rewards to events the integration can actually verify". A
 * LINK_ONLY provider can record traffic but can never prove a sale.
 */
export const VERIFIABLE_EVENTS: Record<
  AffiliateIntegrationLevel,
  AffiliateQualifyingEvent[]
> = {
  LINK_ONLY: [AffiliateQualifyingEvent.LINK_CLICK],
  REDEMPTION_CODE: [
    AffiliateQualifyingEvent.LINK_CLICK,
    AffiliateQualifyingEvent.QUALIFIED_VISIT,
    AffiliateQualifyingEvent.VERIFIED_LEAD,
    AffiliateQualifyingEvent.VERIFIED_REDEMPTION,
  ],
  MANUAL_CONFIRMATION: ALL_EVENTS,
  PROVIDER_API: ALL_EVENTS,
  PROVIDER_WEBHOOK: ALL_EVENTS,
};

/**
 * Legal ledger status transitions. Units never change; only status moves.
 * Any transition not listed here is rejected by AffiliateRewardService.
 */
export const LEDGER_TRANSITIONS: Record<
  AffiliateRewardStatus,
  AffiliateRewardStatus[]
> = {
  PENDING: [
    AffiliateRewardStatus.APPROVED,
    AffiliateRewardStatus.REJECTED,
    AffiliateRewardStatus.CANCELLED,
    AffiliateRewardStatus.REVERSED,
  ],
  APPROVED: [
    AffiliateRewardStatus.AVAILABLE,
    AffiliateRewardStatus.REVERSED,
  ],
  AVAILABLE: [
    AffiliateRewardStatus.REDEEMED,
    AffiliateRewardStatus.EXPIRED,
    AffiliateRewardStatus.REVERSED,
  ],
  REDEEMED: [],
  REJECTED: [],
  CANCELLED: [],
  REVERSED: [],
  EXPIRED: [],
};

/**
 * Plain-English reasons surfaced in the affiliate dashboard. The source model
 * requires that a pending/rejected/reversed reward always states why.
 */
export const EXPLANATION_MESSAGES: Record<string, string> = {
  AWAITING_PROVIDER_CONFIRMATION:
    'Waiting for the provider to confirm this transaction.',
  AWAITING_ADMIN_CONFIRMATION:
    'Waiting for the business to confirm this activity.',
  AWAITING_REDEMPTION:
    'This reward becomes available once the voucher is validated.',
  HOLD_PERIOD:
    'This reward is on a short hold so refunds can be processed.',
  APPROVED:
    'Confirmed and available to redeem.',
  BELOW_MIN_PURCHASE:
    'This purchase was below the minimum spend for the offer.',
  NOT_ELIGIBLE:
    'This activity did not meet the offer conditions.',
  SELF_REFERRAL:
    'You cannot earn a reward for your own purchase.',
  DUPLICATE:
    'This transaction was already recorded — no second reward is due.',
  REFUNDED:
    'The transaction was refunded, so the reward was reversed.',
  CANCELLED: 'The booking or order was cancelled.',
  EXPIRED: 'This reward expired before it was redeemed.',
  CAP_REACHED: 'The reward limit for this campaign has been reached.',
  OUTSIDE_WINDOW:
    'The purchase happened after the attribution window closed.',
  VOUCHER_EXPIRED: 'This voucher has expired.',
  VOUCHER_REVOKED: 'This voucher was cancelled by the business.',
  VOUCHER_ALREADY_REDEEMED: 'This voucher has already been used.',
  VOUCHER_USE_LIMIT_REACHED: 'This voucher has reached its usage limit.',
};

export function explain(code: string | null | undefined): string | null {
  if (!code) return null;
  return EXPLANATION_MESSAGES[code] ?? null;
}

/**
 * Human-readable id for an affiliate: LAF-000125.
 *
 * Sequential and permanent by design — these are printed, shared and quoted,
 * so a random token would look untrustworthy. Gaps on rollback are accepted.
 */
export function formatAffiliateCode(sequence: number): string {
  return `LAF-${String(sequence).padStart(6, '0')}`;
}

/** Which ledger entry types reduce the spendable balance. */
export const DEBITING_ENTRY_TYPES: AffiliateLedgerEntryType[] = [
  AffiliateLedgerEntryType.DEBIT,
  AffiliateLedgerEntryType.EXPIRY,
  AffiliateLedgerEntryType.REVERSAL,
];
