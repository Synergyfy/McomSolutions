import { useState } from 'react';
import { Search, ChevronRight, Snowflake, CheckCircle2, XCircle } from 'lucide-react';
import { useAdminWallets } from './hooks/useWalletAdmin';
import type { AdminWalletListItem } from './api/wallet-admin.api';

const STATUS_STYLES: Record<string, { label: string; cls: string; icon?: any }> = {
  ACTIVE: { label: 'Active', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  FROZEN: { label: 'Frozen', cls: 'bg-sky-50 text-sky-600 border-sky-200', icon: Snowflake },
  SUSPENDED: { label: 'Suspended', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  CLOSED: { label: 'Closed', cls: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
};

export function WalletList({ onManage }: { onManage: (walletId: string) => void }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminWallets({ search: search || undefined, status: status || undefined, page, limit: 20 });

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px] md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by email or user ID..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_STYLES).map((s) => (
              <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Balance</th>
              <th className="px-5 py-3">Available</th>
              <th className="px-5 py-3">Currency</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-gray-400">Loading wallets...</td></tr>
            ) : (data?.data ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-gray-400">No wallets found.</td></tr>
            ) : (
              (data?.data ?? []).map((w: AdminWalletListItem) => {
                const st = STATUS_STYLES[w.status] || { label: w.status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
                const Icon = st.icon;
                return (
                  <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs">
                          {(w.email || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{w.email || 'Unknown'}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{w.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-black text-gray-900">{w.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{w.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-3.5 text-xs font-bold text-gray-500">{w.currency}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.cls}`}>
                        {Icon && <Icon className="w-3 h-3" />}
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => onManage(w.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-400 font-bold">{data.total} wallets</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 font-bold text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              Prev
            </button>
            <span className="text-gray-500 font-bold">Page {data.page} of {data.totalPages}</span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 font-bold text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}