import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CreditCard,
  Landmark,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { useConsoleApps } from '../console/hooks/useConsoleApps';
import { useAdminAppCharges, useAdminAppCharge, useAdminAppChargeLedger } from './hooks/useMcomPayAdmin';
import type { AppCharge, AppChargeFilters, AppChargeMethod, AppChargeStatus } from './api/mcom-pay-admin.api';

const inputCls =
  'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all';
const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  NGN: '₦',
};

const formatMinor = (minor: string | null | undefined, currency = 'GBP') => {
  if (minor == null || minor === '') return '—';
  const n = Number(minor) / 100;
  if (!Number.isFinite(n)) return '—';
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const STATUS_STYLES: Record<AppChargeStatus, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
  refunded: 'bg-blue-50 text-brand-blue border-blue-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const METHOD_META: Record<AppChargeMethod, { label: string; icon: any; cls: string }> = {
  stripe: { label: 'Stripe', icon: CreditCard, cls: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  paypal: { label: 'PayPal', icon: Landmark, cls: 'text-sky-600 bg-sky-50 border-sky-100' },
  wallet: { label: 'Wallet', icon: Wallet, cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
};

const STATUS_OPTIONS: AppChargeStatus[] = ['paid', 'pending', 'failed', 'refunded', 'cancelled'];

/** MCOM Central direct sales are surfaced under this pseudo-app id. */
const MCOM_CENTRAL_APP_ID = 'mcom-central';

const appLabel = (clientId: string) =>
  clientId === MCOM_CENTRAL_APP_ID ? 'MCOM Central' : clientId;

const buildParams = (filters: AppChargeFilters): AppChargeFilters => {
  const out: AppChargeFilters = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
  };
  (['search', 'appClientId', 'status', 'dateFrom', 'dateTo'] as const).forEach((k) => {
    const v = filters[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') (out as any)[k] = String(v).trim();
  });
  return out;
};

export function McomPayPanel() {
  const { admin } = useAdminAuth();
  const [filters, setFilters] = useState<AppChargeFilters>({ page: 1, limit: 20 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = useMemo(() => buildParams(filters), [filters]);
  const { data, isLoading, isFetching, isError, refetch } = useAdminAppCharges(params);
  const { data: apps } = useConsoleApps();

  const charges = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const page = filters.page ?? 1;

  const setFilter = (patch: Partial<AppChargeFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));

  if (admin?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 bg-white rounded-3xl border border-gray-100 text-center shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-gray-900 text-lg font-display">ADMIN Access Required</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
          The MCOM Pay ledger is restricted to authorized administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white rounded-3xl p-6 shadow-sm border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue shadow-inner flex-shrink-0">
            <BookOpen className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white font-display">MCOM Pay Ledger</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Immutable, read-only view of every charge processed through MCOM Pay — partner apps and
              MCOM Central direct sales (memberships, access passes, platform plans).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-gray-800/90 border border-gray-700 rounded-xl text-xs font-bold text-gray-200">
            {total.toLocaleString()} charges
          </span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
            className="p-2 bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs transition-colors border border-gray-700"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin text-brand-blue')} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className={labelCls}>Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={filters.search ?? ''}
                onChange={(e) => setFilter({ search: e.target.value })}
                placeholder="Charge id, reference, user, provider ref…"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>App</label>
            <select
              value={filters.appClientId ?? ''}
              onChange={(e) => setFilter({ appClientId: e.target.value })}
              className={inputCls}
            >
              <option value="">All apps</option>
              <option value={MCOM_CENTRAL_APP_ID}>MCOM Central (direct sales)</option>
              {(apps ?? []).map((app) => (
                <option key={app.clientId} value={app.clientId}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <select
              value={filters.status ?? ''}
              onChange={(e) => setFilter({ status: e.target.value as AppChargeStatus | '' })}
              className={inputCls}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>From</label>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => setFilter({ dateFrom: e.target.value })}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>To</label>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => setFilter({ dateTo: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] text-gray-400">
            The ledger is append-only — entries cannot be edited or deleted.
          </p>
          <button
            onClick={() => setFilters({ page: 1, limit: 20 })}
            className="text-[11px] font-bold text-brand-blue hover:underline"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm font-bold text-red-600">Failed to load charges.</p>
            <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-brand-blue hover:underline">
              Try again
            </button>
          </div>
        ) : charges.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-500">No charges match these filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">App</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Fee</th>
                    <th className="px-4 py-3 text-right">Net</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <ChargeRow key={c.id} charge={c} onClick={() => setSelectedId(c.id)} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-gray-100">
              {charges.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-gray-900 truncate">
                      {appLabel(c.appClientId)}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {c.reference || c.description || c.id}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <MethodBadge method={c.method} />
                    <span className="font-bold text-sm text-gray-900">{formatMinor(c.amountMinor, c.currency)}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">{formatDate(c.createdAt)}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
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

      {selectedId && <ChargeDetailModal chargeId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function ChargeRow({ charge, onClick }: { charge: AppCharge; onClick: () => void; key?: string }) {
  return (
    <tr onClick={onClick} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(charge.createdAt)}</td>
      <td className="px-4 py-3 text-xs font-mono font-bold text-gray-900">
        <span>{appLabel(charge.appClientId)}</span>
        {charge.source === 'central' && (
          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-brand-blue/10 text-brand-blue text-[9px] font-bold uppercase tracking-wide">
            direct
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <MethodBadge method={charge.method} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px] truncate" title={charge.reference ?? undefined}>
        {charge.reference || charge.description || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate" title={charge.mcomUserId ?? undefined}>
        {charge.mcomUserId || charge.externalCustomerId || '—'}
      </td>
      <td className="px-4 py-3 text-xs font-bold text-gray-900 text-right whitespace-nowrap">
        {formatMinor(charge.amountMinor, charge.currency)}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 text-right whitespace-nowrap">
        {formatMinor(charge.feeMinor, charge.currency)}
      </td>
      <td className="px-4 py-3 text-xs font-bold text-emerald-700 text-right whitespace-nowrap">
        {formatMinor(charge.netMinor, charge.currency)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={charge.status} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: AppChargeStatus }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase', STATUS_STYLES[status])}>
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: AppChargeMethod }) {
  const meta = METHOD_META[method] ?? METHOD_META.stripe;
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold', meta.cls)}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function ChargeDetailModal({ chargeId, onClose }: { chargeId: string; onClose: () => void }) {
  const { data: charge, isLoading } = useAdminAppCharge(chargeId);
  const { data: ledger } = useAdminAppChargeLedger(chargeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue flex-shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-base font-display truncate">Charge Detail</h3>
              <p className="text-[11px] font-mono text-gray-400 truncate">{chargeId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading || !charge ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={charge.status} />
                <MethodBadge method={charge.method} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Gross" value={formatMinor(charge.amountMinor, charge.currency)} accent="text-gray-900" />
                <Stat label="Fee" value={formatMinor(charge.feeMinor, charge.currency)} accent="text-gray-500" />
                <Stat
                  label={charge.source === 'central' ? 'Net to MCOM' : 'Net to app'}
                  value={formatMinor(charge.netMinor, charge.currency)}
                  accent="text-emerald-700"
                />
                <Stat label="Currency" value={charge.currency} accent="text-gray-900" />
              </div>

              <div className="bg-gray-50/80 rounded-2xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Field label="App" value={appLabel(charge.appClientId)} mono />
                <Field label="Reference" value={charge.reference || '—'} mono />
                <Field label="MCOM User" value={charge.mcomUserId || '—'} mono />
                <Field label="External Customer" value={charge.externalCustomerId || '—'} mono />
                <Field label="Provider" value={charge.provider || '—'} />
                <Field label="Provider Ref" value={charge.providerRef || '—'} mono />
                <Field label="Description" value={charge.description || '—'} />
                <Field label="Wallet Debit" value={charge.walletDebitAmount ? `${charge.walletDebitAmount} MCOM` : '—'} />
                <Field label="Created" value={formatDate(charge.createdAt)} />
                <Field label="Paid" value={charge.paidAt ? formatDate(charge.paidAt) : '—'} />
              </div>

              {/* Ledger entries */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Double-entry ledger ({ledger?.length ?? 0})
                </h4>
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <th className="px-3 py-2">Account</th>
                        <th className="px-3 py-2">Direction</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ledger ?? []).map((e) => (
                        <tr key={e.id} className="border-t border-gray-50">
                          <td className="px-3 py-2 text-xs font-mono text-gray-700">{e.account}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase',
                                e.direction === 'debit'
                                  ? 'bg-rose-50 text-rose-600'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {e.direction}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-bold text-right text-gray-900">
                            {formatMinor(e.amountMinor, e.currency)}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-gray-500">{formatDate(e.createdAt)}</td>
                        </tr>
                      ))}
                      {(ledger ?? []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-400">
                            No ledger entries yet (charge not settled).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <p className="text-[11px] text-gray-400">Read-only — this record cannot be edited or deleted.</p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{label}</span>
      <span className={cn('font-bold text-sm', accent)}>{value}</span>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{label}</span>
      <span className={cn('text-gray-900 break-words', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  );
}
