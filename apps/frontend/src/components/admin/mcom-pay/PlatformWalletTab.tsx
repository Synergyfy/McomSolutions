import { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { usePlatformActivity } from './hooks/useMcomPayAdmin';
import { formatDate, formatMinor, intentLabel, intentStyle } from './format';
import { EventDrawer } from './EventDrawer';
import type { LedgerParty } from './api/mcom-pay-admin.api';

function PartyList({ parties, tone }: { parties: LedgerParty[]; tone: 'debit' | 'credit' }) {
  if (parties.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <div className="space-y-0.5">
      {parties.map((party) => (
        <div key={party.account} className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold text-gray-800 truncate" title={party.account}>
            {party.label}
          </span>
          <span className={cn('text-[11px] font-bold whitespace-nowrap', tone === 'debit' ? 'text-rose-600' : 'text-emerald-600')}>
            {formatMinor(party.amountMinor)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PlatformWalletTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = usePlatformActivity(page);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const account = data?.account;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white rounded-3xl p-6 shadow-sm border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform wallet</p>
            <p className="text-3xl font-black tracking-tight">
              {formatMinor(account?.balanceMinor ?? '0', account?.currency)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">{account?.code ?? 'platform:wallet:GBP'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">Movements</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Who paid, and who was paid. The platform only appears when it ended up with part of the money.
            </p>
          </div>
          {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue" />}
        </div>

        {rows.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500">No movements yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-4 py-3 w-[14%]">Date</th>
                  <th className="px-4 py-3 w-[12%]">Intent</th>
                  <th className="px-4 py-3 w-[30%]">Debited</th>
                  <th className="px-4 py-3 w-[30%]">Credited</th>
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
                    <td className="px-4 py-3 align-top">
                      <PartyList parties={row.debits} tone="debit" />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <PartyList parties={row.credits} tone="credit" />
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400 truncate max-w-[220px]" title={row.key}>
                      {row.reference || row.key}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {selectedKey && <EventDrawer eventKey={selectedKey} onClose={() => setSelectedKey(null)} />}
    </div>
  );
}
