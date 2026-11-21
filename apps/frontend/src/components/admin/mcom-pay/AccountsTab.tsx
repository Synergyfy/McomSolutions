import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAccountEntries, useLedgerAccounts } from './hooks/useMcomPayAdmin';
import { formatDate, formatMinor, intentLabel, intentStyle } from './format';
import { EventDrawer } from './EventDrawer';

const TYPE_LABEL: Record<string, string> = {
  PLATFORM_WALLET: 'Platform wallet',
  LIABILITY_USER_WALLET: 'User wallet',
  LIABILITY_APP_PAYABLE: 'App payable',
  LIABILITY_PAYABLE: 'Payee payable',
  ASSET_GATEWAY_CLEARING: 'Gateway clearing',
  ASSET_BANK: 'Bank',
  SUSPENSE: 'Suspense',
  EQUITY_OPENING: 'Opening equity',
};

const TYPE_TONE: Record<string, string> = {
  PLATFORM_WALLET: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  LIABILITY_USER_WALLET: 'bg-blue-50 text-brand-blue border-blue-100',
  LIABILITY_APP_PAYABLE: 'bg-amber-50 text-amber-700 border-amber-100',
  LIABILITY_PAYABLE: 'bg-orange-50 text-orange-700 border-orange-100',
  ASSET_GATEWAY_CLEARING: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  ASSET_BANK: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  SUSPENSE: 'bg-rose-50 text-rose-700 border-rose-100',
  EQUITY_OPENING: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function AccountsTab() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({ ...(type ? { type } : {}), ...(search ? { search } : {}) }), [type, search]);
  const { data, isLoading } = useLedgerAccounts(params);
  const { data: entries, isFetching } = useAccountEntries(selected ?? '', page);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);

  const accounts = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Search code</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="wallet:, payable:app:, platform:…"
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            <option value="">All types</option>
            {Object.keys(TYPE_LABEL).map((key) => (
              <option key={key} value={key}>
                {TYPE_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">Chart of accounts</h3>
            <span className="text-[11px] text-gray-400">{accounts.length} accounts</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto divide-y divide-gray-50">
              {accounts.map((account) => (
                <button
                  key={account.code}
                  onClick={() => {
                    setSelected(account.code);
                    setPage(1);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                    selected === account.code && 'bg-blue-50/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-gray-800 truncate">{account.code}</span>
                    <span className="text-xs font-bold text-gray-900 whitespace-nowrap">
                      {formatMinor(account.balanceMinor, account.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-lg text-[10px] font-bold border',
                        TYPE_TONE[account.type] ?? 'bg-gray-100 text-gray-600 border-gray-200',
                      )}
                    >
                      {TYPE_LABEL[account.type] ?? account.type}
                    </span>
                    {account.ownerRef && (
                      <span className="text-[10px] font-mono text-gray-400 truncate">{account.ownerRef}</span>
                    )}
                  </div>
                </button>
              ))}
              {accounts.length === 0 && (
                <div className="py-14 text-center text-sm text-gray-500">No accounts match.</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">
              {selected ? 'Entries' : 'Select an account'}
            </h3>
            {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue" />}
          </div>

          {!selected ? (
            <div className="py-20 text-center text-sm text-gray-500">
              Pick an account on the left to see its journal entries.
            </div>
          ) : (
            <>
              <div className="max-h-[500px] overflow-y-auto">
                {(entries?.data ?? []).map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setDrawerKey(entry.transfer.reference ?? entry.transfer.id)}
                    className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border', intentStyle(entry.transfer.intent))}>
                        {intentLabel(entry.transfer.intent)}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-bold',
                          entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600',
                        )}
                      >
                        {entry.direction === 'credit' ? '+' : '−'}
                        {formatMinor(entry.amountMinor, entry.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-[10px] text-gray-500 truncate">
                        {entry.transfer.reference || entry.transfer.description || entry.transfer.id}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDate(entry.createdAt)}</span>
                    </div>
                  </button>
                ))}
                {(entries?.data ?? []).length === 0 && (
                  <div className="py-14 text-center text-sm text-gray-500">No entries on this account yet.</div>
                )}
              </div>

              {(entries?.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-100">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-[11px] text-gray-500">
                    {page} / {entries?.totalPages}
                  </span>
                  <button
                    disabled={page >= (entries?.totalPages ?? 1)}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {drawerKey && <EventDrawer eventKey={drawerKey} onClose={() => setDrawerKey(null)} />}
    </div>
  );
}
