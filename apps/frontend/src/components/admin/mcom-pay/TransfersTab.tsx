import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLedgerEvents, useLedgerPlatforms } from './hooks/useMcomPayAdmin';
import { DEFAULT_INTENTS, formatDate, formatMinor, intentLabel, intentStyle } from './format';
import { EventDrawer } from './EventDrawer';
import type { LedgerIntent } from './api/mcom-pay-admin.api';

const inputCls =
  'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all';
const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1';

interface Filters {
  search?: string;
  intent?: LedgerIntent | '';
  platformId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function TransfersTab() {
  const [filters, setFilters] = useState<Filters>({ page: 1, limit: 20 });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const params = useMemo(() => {
    const out: Record<string, unknown> = { page: filters.page ?? 1, limit: filters.limit ?? 20 };
    (['search', 'intent', 'platformId', 'dateFrom', 'dateTo'] as const).forEach((key) => {
      const value = filters[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') out[key] = String(value).trim();
    });
    return out;
  }, [filters]);

  const { data: platforms } = useLedgerPlatforms();
  const { data, isLoading, isError, refetch } = useLedgerEvents(params);
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const totalPages = data?.totalPages ?? 1;

  const setFilter = (patch: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className={labelCls}>Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={filters.search ?? ''}
                onChange={(e) => setFilter({ search: e.target.value })}
                placeholder="Order reference, description…"
                className={cn(inputCls, 'pl-9')}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Intent</label>
            <select
              value={filters.intent ?? ''}
              onChange={(e) => setFilter({ intent: e.target.value as LedgerIntent | '' })}
              className={inputCls}
            >
              <option value="">All intents</option>
              {DEFAULT_INTENTS.map((intent) => (
                <option key={intent} value={intent}>
                  {intentLabel(intent)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Platform</label>
            <select
              value={filters.platformId ?? ''}
              onChange={(e) => setFilter({ platformId: e.target.value })}
              className={inputCls}
            >
              <option value="">All platforms</option>
              {(platforms ?? []).map((platform) => (
                <option key={platform.platformId} value={platform.platformId}>
                  {platform.name} ({platform.platformId})
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
            One row per money event — who was debited and who was credited. Click for the full record.
          </p>
          <button
            onClick={() => setFilters({ page: 1, limit: 20 })}
            className="text-[11px] font-bold text-brand-blue hover:underline"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm font-bold text-red-600">Failed to load the ledger.</p>
            <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-brand-blue hover:underline">
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm font-bold text-gray-500">
            No entries match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-4 py-3 w-[13%]">Date</th>
                  <th className="px-4 py-3 w-[11%]">Intent</th>
                  <th className="px-4 py-3 w-[26%]">Debited</th>
                  <th className="px-4 py-3 w-[26%]">Credited</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    onClick={() => setSelectedKey(row.key)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer align-top"
                  >
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border', intentStyle(row.primaryIntent))}
                        title={row.intents.join(', ')}
                      >
                        {intentLabel(row.primaryIntent)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.debits.map((party) => (
                        <div key={party.account} className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] font-semibold text-gray-800 truncate" title={party.account}>
                            {party.label}
                          </span>
                          <span className="text-[11px] font-bold text-rose-600 whitespace-nowrap">
                            {formatMinor(party.amountMinor)}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      {row.credits.map((party) => (
                        <div key={party.account} className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] font-semibold text-gray-800 truncate" title={party.account}>
                            {party.label}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600 whitespace-nowrap">
                            {formatMinor(party.amountMinor)}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[10px] font-mono text-gray-500 truncate max-w-[220px]" title={row.reference ?? row.key}>
                        {row.reference || row.key}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.platformIds.length > 0 && (
                          <span className="text-[10px] text-gray-400 truncate">{row.platformIds.join(', ')}</span>
                        )}
                        {row.noPayee === true && (
                          <span
                            className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700"
                            title="No payee was specified, so the net accrued to the app payable rather than a seller"
                          >
                            no payee
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages} · {total.toLocaleString()} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setFilter({ page: page - 1 })}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setFilter({ page: page + 1 })}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedKey && <EventDrawer eventKey={selectedKey} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
