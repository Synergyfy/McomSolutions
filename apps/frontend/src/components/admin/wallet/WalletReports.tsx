import { useState } from 'react';
import { BarChart3, CalendarRange, ShieldAlert } from 'lucide-react';
import { useWalletReports } from './hooks/useWalletAdmin';

export function WalletReports() {
  const { data, isLoading } = useWalletReports();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = data?.platformSummary?.data ?? [];
  const hasDiscrepancy = data?.reconciliation?.data?.hasDiscrepancy;
  const discrepancies = data?.reconciliation?.data?.discrepancies ?? [];

  return (
    <div className="space-y-5">
      {/* Date range */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-3 flex-wrap">
        <CalendarRange className="w-4 h-4 text-gray-400" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600" />
        <span className="text-xs text-gray-400 font-bold">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600" />
      </div>

      {/* Reconciliation status */}
      <div className={`rounded-3xl border p-5 flex items-center gap-4 shadow-sm ${hasDiscrepancy ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${hasDiscrepancy ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h4 className={`font-black text-sm font-display ${hasDiscrepancy ? 'text-red-700' : 'text-emerald-700'}`}>
            {isLoading ? 'Checking...' : hasDiscrepancy ? `${discrepancies.length} wallet(s) out of balance!` : 'Reconciliation clean'}
          </h4>
          <p className="text-[11px] font-bold text-gray-500">
            {isLoading ? 'Running balance-vs-ledger verification.' : hasDiscrepancy ? 'Ledger drift detected — investigate immediately (drift = bug).' : 'Every wallet balance equals the ledger-derived balance.'}
          </p>
        </div>
      </div>

      {/* Platform summary */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-blue" />
          <h4 className="font-black text-gray-900 font-display text-sm">Platform Volume</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3 text-right">Total Volume</th>
                <th className="px-5 py-3 text-right">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-xs text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-10 text-center text-xs text-gray-400">No data for selected range.</td></tr>
              ) : (
                filtered.map((r: any) => (
                  <tr key={r.platformClientId} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-sm font-bold text-gray-900">{r.platform}</td>
                    <td className="px-5 py-3 text-right text-sm font-black text-gray-900">{r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} MCOM</td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500 font-bold">{r.txnCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily volume */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
        <h4 className="font-black text-gray-900 font-display text-sm mb-4">Daily Volume</h4>
        {isLoading || !data?.dailyVolume?.data?.length ? (
          <div className="text-center text-xs text-gray-400 py-8">No volume data yet.</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.dailyVolume.data.map((d: any) => {
              const max = Math.max(...data.dailyVolume.data.map((x: any) => Math.max(x.credits, x.debits)), 1);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date} · ${d.credits} in / ${d.debits} out`}>
                  <div className="w-full flex flex-col-reverse gap-0.5 h-24">
                    <div className="bg-red-400 rounded-t" style={{ height: `${(d.debits / max) * 100}%` }} />
                    <div className="bg-emerald-400 rounded-t" style={{ height: `${(d.credits / max) * 100}%` }} />
                  </div>
                  <span className="text-[9px] font-bold text-gray-400">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}