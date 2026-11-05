import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAffiliateSettlements,
  useAffiliateSettlementSummary,
  useReleaseAffiliateSettlement,
  useRetryAffiliateSettlement,
} from '../../services/admin/hooks';
import type {
  AdminAffiliateSettlement,
  AdminAffiliateSettlementQuery,
} from '../../services/admin/types';

const STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'No money',
  PENDING_HOLD: 'Hold pending',
  HELD: 'Escrowed',
  SETTLING: 'Settling',
  SETTLED: 'Settled',
  RELEASED: 'Released',
  FAILED: 'Needs attention',
};

const STATUS_STYLES: Record<string, string> = {
  NOT_REQUIRED: 'bg-gray-100 text-gray-600',
  PENDING_HOLD: 'bg-amber-100 text-amber-800',
  HELD: 'bg-sky-100 text-sky-800',
  SETTLING: 'bg-indigo-100 text-indigo-800',
  SETTLED: 'bg-emerald-100 text-emerald-800',
  RELEASED: 'bg-gray-100 text-gray-600',
  FAILED: 'bg-red-100 text-red-700',
};

const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;

const formatCredits = (value: string | number | null | undefined) =>
  num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'bad'
          ? 'text-red-700'
          : 'text-gray-900';
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className={cn('mt-1 text-xl font-black tabular-nums', toneCls)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

export default function AffiliateSettlementLedger() {
  const [status, setStatus] = useState<AdminAffiliateSettlementQuery['status']>('');
  const [search, setSearch] = useState('');

  const query = useMemo(
    () => ({
      status: status || undefined,
      search: search.trim() || undefined,
      limit: 50,
    }),
    [status, search],
  );

  const settlementsRes = useAffiliateSettlements(query);
  const summaryRes = useAffiliateSettlementSummary();
  const retrySettlement = useRetryAffiliateSettlement();
  const releaseSettlement = useReleaseAffiliateSettlement();
  const settlements: AdminAffiliateSettlement[] = settlementsRes.data?.data ?? [];
  const summary = summaryRes.data?.data;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-gray-900">
              <ShieldCheck className="h-4 w-4 text-brand-blue" /> Escrow &amp; payout ledger
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-gray-500">
              Money is reserved from the business wallet when a paid task is assigned, captured only when
              the work is approved, and paid into the affiliate&apos;s central MCOM wallet. Active paid
              memberships are platform-funded and never charged again.
            </p>
          </div>
          <button
            onClick={() => {
              void settlementsRes.refetch();
              void summaryRes.refetch();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', settlementsRes.isFetching && 'animate-spin')} />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Currently escrowed"
            value={`${formatCredits(summary?.held)} MCOM`}
            hint={`${summary?.heldCount ?? 0} active hold${summary?.heldCount === 1 ? '' : 's'}`}
            tone="warn"
          />
          <SummaryCard
            label="Settled payouts"
            value={`${formatCredits(summary?.settledPayouts)} MCOM`}
            hint={`${summary?.settledCount ?? 0} settled task${summary?.settledCount === 1 ? '' : 's'}`}
            tone="good"
          />
          <SummaryCard
            label="Platform retention"
            value={`${formatCredits(summary?.platformRetention)} MCOM`}
            hint={`Fee ${formatCredits(summary?.platformFees)} · margin ${formatCredits(summary?.platformMargin)}`}
            tone="default"
          />
          <SummaryCard
            label="Needs attention"
            value={String(summary?.failedCount ?? 0)}
            hint={`${summary?.releasedCount ?? 0} released / cancelled`}
            tone={(summary?.failedCount ?? 0) > 0 ? 'bad' : 'default'}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task, affiliate email or reference"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AdminAffiliateSettlementQuery['status'])}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold"
          >
            <option value="">All settlement states</option>
            {Object.keys(STATUS_LABELS).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {settlementsRes.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
          </div>
        ) : settlements.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm font-bold text-gray-700">No settlement records yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Assign a priced task to create the first escrow record.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {settlements.map((settlement) => {
              const task = settlement.task;
              const outgoing = num(settlement.affiliatePayoutCredits);
              return (
                <div key={settlement.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-gray-900">
                          {task?.title ?? 'Delegated task'}
                        </p>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                            STATUS_STYLES[settlement.status] ?? 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {STATUS_LABELS[settlement.status] ?? settlement.status}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                          {settlement.fundingSource === 'PLATFORM' ? 'platform funded' : 'business wallet'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        <span className="font-bold text-gray-700">
                          {task?.business?.businessName ?? 'Business'}
                        </span>
                        <span className="mx-1.5">·</span>
                        {task?.assignee
                          ? [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') ||
                            task.assignee.email
                          : settlement.affiliateEmail ?? 'No affiliate'}
                        <span className="mx-1.5">·</span>
                        Created {formatDate(settlement.createdAt)}
                      </p>
                      {settlement.settlementReference && (
                        <p className="mt-0.5 font-mono text-[10px] text-gray-400">
                          {settlement.settlementReference}
                        </p>
                      )}
                      {settlement.failureReason && (
                        <p className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-red-700">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          {settlement.failureReason}
                        </p>
                      )}
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-right text-[11px] sm:grid-cols-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          Business charge
                        </p>
                        <p className="font-black tabular-nums text-gray-900">
                          {formatCredits(settlement.businessChargeCredits)} MCOM
                        </p>
                        <p className="text-[10px] tabular-nums text-gray-400">
                          £{formatCredits(settlement.businessChargeAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          Affiliate payout
                        </p>
                        <p className="flex items-center justify-end gap-1 font-black tabular-nums text-emerald-700">
                          <ArrowDownRight className="h-3 w-3" />
                          {formatCredits(outgoing)} MCOM
                        </p>
                        <p className="text-[10px] tabular-nums text-gray-400">
                          £{formatCredits(settlement.compensationAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          Platform keeps
                        </p>
                        <p className="flex items-center justify-end gap-1 font-black tabular-nums text-gray-900">
                          <ArrowUpRight className="h-3 w-3" />
                          {formatCredits(
                            num(settlement.platformFeeCredits) + num(settlement.platformMarginCredits),
                          )}{' '}
                          MCOM
                        </p>
                        <p className="text-[10px] tabular-nums text-gray-400">
                          fee {formatCredits(settlement.platformFeeCredits)} · {formatCredits(settlement.platformFeePercent)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          FX rate
                        </p>
                        <p className="font-black tabular-nums text-gray-900">
                          {num(settlement.fxRate).toFixed(4)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {settlement.fxBase}/{settlement.fxQuote}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-50 pt-2 text-[10px] text-gray-500">
                    <span>
                      Held: <span className="font-semibold text-gray-700">{formatDate(settlement.heldAt)}</span>
                    </span>
                    <span>
                      Settled:{' '}
                      <span className="font-semibold text-gray-700">{formatDate(settlement.settledAt)}</span>
                    </span>
                    <span>
                      Released:{' '}
                      <span className="font-semibold text-gray-700">{formatDate(settlement.releasedAt)}</span>
                    </span>
                    <span>
                      Business txn:{' '}
                      <span className="font-mono text-gray-700">
                        {settlement.businessTransactionId ?? '—'}
                      </span>
                    </span>
                    <span>
                      Affiliate txn:{' '}
                      <span className="font-mono text-gray-700">
                        {settlement.affiliateTransactionId ?? '—'}
                      </span>
                    </span>
                    <div className="ml-auto flex gap-2">
                      {['FAILED', 'SETTLING', 'PENDING_HOLD'].includes(settlement.status) && (
                        <button
                          type="button"
                          onClick={() => retrySettlement.mutate(settlement.taskId)}
                          disabled={retrySettlement.isPending}
                          className="rounded-lg bg-brand-blue px-2.5 py-1 text-[10px] font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                        >
                          Retry payout
                        </button>
                      )}
                      {['HELD', 'PENDING_HOLD'].includes(settlement.status) &&
                        !settlement.businessTransactionId && (
                        <button
                          type="button"
                          onClick={() => {
                            const reason = window.prompt('Reason for releasing this escrow?');
                            if (reason === null) return;
                            releaseSettlement.mutate({
                              taskId: settlement.taskId,
                              reason: reason || 'Released by administrator',
                            });
                          }}
                          disabled={releaseSettlement.isPending}
                          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Release escrow
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
