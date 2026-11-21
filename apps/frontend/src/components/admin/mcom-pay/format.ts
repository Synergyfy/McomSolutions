import type { LedgerIntent } from './api/mcom-pay-admin.api';

export const formatMinor = (minor: string | number | null | undefined, currency = 'GBP') => {
  if (minor == null || minor === '') return '—';
  const n = Number(minor) / 100;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

export const INTENT_LABELS: Record<string, string> = {
  ORDER: 'Order',
  BOOKING: 'Booking',
  DELEGATION: 'Delegation',
  PURCHASE: 'Purchase',
  SUBSCRIPTION: 'Subscription',
  REFERRAL_COMMISSION: 'Referral',
  TOP_UP: 'Top-up',
  REFUND: 'Refund',
  PAYOUT: 'Payout',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  FEE: 'Fee',
  CHARGEBACK: 'Chargeback',
  OPENING_BALANCE: 'Opening',
};

export const intentLabel = (intent: string) => INTENT_LABELS[intent] ?? intent;

const INTENT_STYLES: Record<string, string> = {
  ORDER: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  BOOKING: 'bg-violet-50 text-violet-700 border-violet-100',
  DELEGATION: 'bg-amber-50 text-amber-700 border-amber-100',
  PURCHASE: 'bg-sky-50 text-sky-700 border-sky-100',
  SUBSCRIPTION: 'bg-blue-50 text-blue-700 border-blue-100',
  REFERRAL_COMMISSION: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  TOP_UP: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  REFUND: 'bg-rose-50 text-rose-700 border-rose-100',
  PAYOUT: 'bg-slate-100 text-slate-700 border-slate-200',
  ADJUSTMENT: 'bg-gray-100 text-gray-600 border-gray-200',
  TRANSFER: 'bg-teal-50 text-teal-700 border-teal-100',
};

export const intentStyle = (intent: LedgerIntent | string) =>
  INTENT_STYLES[intent] ?? 'bg-gray-100 text-gray-600 border-gray-200';

export const DEFAULT_INTENTS: LedgerIntent[] = [
  'ORDER',
  'BOOKING',
  'DELEGATION',
  'PURCHASE',
  'SUBSCRIPTION',
  'REFERRAL_COMMISSION',
  'TOP_UP',
  'REFUND',
  'PAYOUT',
  'TRANSFER',
  'ADJUSTMENT',
];
