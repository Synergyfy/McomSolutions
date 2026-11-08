import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw, Search, Wallet } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAdminWalletActivity } from './hooks/useMcomPayAdmin';
import type {
  WalletActivity,
  WalletActivityCategory,
  WalletActivityFilters,
  WalletActivityType,
} from './api/mcom-pay-admin.api';

const inputCls =
  'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all';
const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

const CATEGORY_OPTIONS: WalletActivityCategory[] = [
  'TOP_UP',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'REWARD',
  'REFUND',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT',
  'SUBSCRIPTION',
  'PURCHASE',
  'SERVICE_FEE',
  'HOLD_CAPTURE',
];

const CATEGORY_LABELS: Record<WalletActivityCategory, string> = {
  TOP_UP: 'Wallet top-up',
  REWARD: 'Reward',
  REFUND: 'Refund',
  ADMIN_CREDIT: 'Admin credit',
  TRANSFER_IN: 'Transfer in',
  SUBSCRIPTION: 'Subscription',
  PURCHASE: 'Purchase',
  SERVICE_FEE: 'Service fee',
  ADMIN_DEBIT: 'Admin debit',
  TRANSFER_OUT: 'Transfer out',
  HOLD_CAPTURE: 'Hold capture',
};

const formatCredits = (amount: number) =>
  Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const userLabel = (user: WalletActivity['user']) =>
  user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : 'System';

const activityLabel = (row: WalletActivity) => {
  if (row.category === 'TRANSFER_IN' && row.reference?.startsWith('affiliate-task:')) {
    return 'Affiliate task payout';
  }
  return row.description || CATEGORY_LABELS[row.category] || row.category.replaceAll('_', ' ');
};

const buildParams = (filters: WalletActivityFilters): WalletActivityFilters => {
  const out: WalletActivityFilters = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
  };
  (['search', 'category', 'type', 'dateFrom', 'dateTo'] as const).forEach((key) => {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      (out as Record<string, string>)[key] = String(value).trim();
    }
  });
  return out;
};

export function WalletActivityPanel() {
  const [filters, setFilters] = useState<WalletActivityFilters>({ page: 1, limit: 20 });
  const params = useMemo(() => buildParams(filters), [filters]);
  const { data, isLoading, isFetching, isError, refetch } = useAdminWalletActivity(params);

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const page = filters.page ?? 1;

  const setFilter = (patch: Partial<WalletActivityFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] font-medium text-blue-900">
        Wallet ledger — wallet top-ups, affiliate task payouts, transfers and other MCOM wallet
        movements. Affiliate payouts are marked with the task settlement reference.
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className={labelCls}>Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={filters.search ?? ''}
                onChange={(event) => setFilter({ search: event.target.value })}
                placeholder="Reference, description, user email or name"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Activity</label>
            <select
              value={filters.category ?? ''}
              onChange={(event) =>
                setFilter({ category: event.target.value as WalletActivityCategory | '' })
              }
              className={inputCls}
            >
              <option value="">All activity</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Direction</label>
            <select
              value={filters.type ?? ''}
              onChange={(event) => setFilter({ type: event.target.value as WalletActivityType | '' })}
              className={inputCls}
            >
              <option value="">Credit &amp; debit</option>
              <option value="CREDIT">Credit</option>
              <option value="DEBIT">Debit</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>From</label>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(event) => setFilter({ dateFrom: event.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>To</label>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(event) => setFilter({ dateTo: event.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] text-gray-400">
            {total.toLocaleString()} wallet {total === 1 ? 'movement' : 'movements'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilters({ page: 1, limit: 20 })}
              className="text-[11px] font-bold text-brand-blue hover:underline"
            >
              Reset filters
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm font-bold text-red-600">Failed to load wallet activity.</p>
            <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-brand-blue hover:underline">
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-500">No wallet activity matches these filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Balance after</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <WalletRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100">
              {rows.map((row) => (
                <div key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900">{userLabel(row.user)}</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">{activityLabel(row)}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-bold tabular-nums',
                        row.type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700',
                      )}
                    >
                      {row.type === 'CREDIT' ? '+' : '−'}
                      {formatCredits(row.amount)} MCOM
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                    <span>{formatDate(row.createdAt)}</span>
                    <ActivityBadge row={row} />
                    {row.reference && <span className="truncate font-mono">{row.reference}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages} · {total.toLocaleString()} records
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setFilter({ page: page - 1 })}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setFilter({ page: page + 1 })}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityBadge({ row }: { row: WalletActivity }) {
  const isAffiliatePayout =
    row.category === 'TRANSFER_IN' && Boolean(row.reference?.startsWith('affiliate-task:'));
  const isTopUp = row.category === 'TOP_UP';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        isAffiliatePayout
          ? 'border-violet-200 bg-violet-50 text-violet-700'
          : isTopUp
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : row.type === 'CREDIT'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
      )}
    >
      {row.type === 'CREDIT' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
      {isAffiliatePayout ? 'Affiliate payout' : isTopUp ? 'Top-up' : CATEGORY_LABELS[row.category]}
    </span>
  );
}

function WalletRow({ row }: { row: WalletActivity; key?: string }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(row.createdAt)}</td>
      <td className="px-4 py-3 text-xs text-gray-700 max-w-[190px] truncate" title={row.user?.email}>
        <p className="font-semibold text-gray-900">{userLabel(row.user)}</p>
        <p className="text-[10px] text-gray-400 truncate">{row.user?.email || '—'}</p>
      </td>
      <td className="px-4 py-3 text-xs text-gray-700 max-w-[220px] truncate" title={row.description ?? undefined}>
        {activityLabel(row)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate font-mono" title={row.reference ?? undefined}>
        {row.reference || '—'}
      </td>
      <td
        className={cn(
          'px-4 py-3 text-xs font-bold text-right whitespace-nowrap tabular-nums',
          row.type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700',
        )}
      >
        {row.type === 'CREDIT' ? '+' : '−'}
        {formatCredits(row.amount)} MCOM
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 text-right whitespace-nowrap tabular-nums">
        {formatCredits(row.balanceAfter)} MCOM
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase',
            row.status === 'COMPLETED'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : row.status === 'FAILED'
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-amber-200 bg-amber-50 text-amber-700',
          )}
        >
          {row.status.toLowerCase()}
        </span>
      </td>
    </tr>
  );
}
