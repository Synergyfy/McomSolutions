import type { ReactNode } from 'react';
import { Check, Copy, Info, Loader2 } from 'lucide-react';
import { useState } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  REDEEMED: 'bg-slate-100 text-slate-700 ring-slate-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200',
  REVERSED: 'bg-rose-50 text-rose-700 ring-rose-200',
  EXPIRED: 'bg-slate-100 text-slate-600 ring-slate-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  SUSPENDED: 'bg-rose-50 text-rose-700 ring-rose-200',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-200',
  VALIDATED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200',
        className,
      )}
    >
      {status.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}

export function AffiliateStat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning' | 'muted';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : tone === 'muted'
          ? 'text-slate-500'
          : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular-nums', toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
      <Info className="h-5 w-5 text-slate-400" />
      <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard can be blocked; fall back to selecting the text.
      const el = document.createElement('textarea');
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function CopyField({ value, label }: { value: string; label?: string }) {
  return (
    <div>
      {label ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-inset ring-slate-200">
          {value}
        </code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
      {message}
    </div>
  );
}

export function formatPoints(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatMoneyMinor(minor: number | null | undefined, currency = 'GBP'): string {
  if (minor === null || minor === undefined) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export const REWARD_STATUS_EXPLANATIONS: Record<string, string> = {
  AWAITING_PROVIDER_CONFIRMATION: 'Waiting for the provider to confirm this transaction.',
  AWAITING_ADMIN_CONFIRMATION: 'Waiting for the business to confirm this activity.',
  AWAITING_REDEMPTION: 'Available once the voucher has been validated.',
  HOLD_PERIOD: 'On a short hold so refunds can be processed.',
  APPROVED: 'Confirmed and available to redeem.',
  BELOW_MIN_PURCHASE: 'The purchase was below the minimum spend for this offer.',
  NOT_ELIGIBLE: 'This activity did not meet the offer conditions.',
  SELF_REFERRAL: 'You cannot earn a reward for your own purchase.',
  DUPLICATE: 'This transaction was already recorded.',
  REFUNDED: 'The transaction was refunded, so the reward was reversed.',
  CANCELLED: 'The booking or order was cancelled.',
  EXPIRED: 'This reward expired before it was redeemed.',
  CAP_REACHED: 'The reward limit for this campaign has been reached.',
  OUTSIDE_WINDOW: 'The purchase happened after the attribution window closed.',
};

export function explainReward(code?: string | null, fallback?: string | null): string | null {
  if (code && REWARD_STATUS_EXPLANATIONS[code]) return REWARD_STATUS_EXPLANATIONS[code];
  return fallback ?? null;
}
