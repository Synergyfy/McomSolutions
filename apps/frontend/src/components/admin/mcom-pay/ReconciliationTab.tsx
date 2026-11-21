import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLedgerReconciliation, useLedgerShadow } from './hooks/useMcomPayAdmin';
import { formatMinor } from './format';

interface ReconciliationData {
  accountsChecked: number;
  assetTotalMinor: string;
  liabilityTotalMinor: string;
  equityTotalMinor: string;
  identityHolds: boolean;
  identityDifferenceMinor: string;
  accountDrift: Array<{ code: string; storedMinor: string; expectedMinor: string; differenceMinor: string }>;
  walletDrift: Array<{ walletId: string; walletBalanceMinor: string; ledgerBalanceMinor: string; differenceMinor: string }>;
  walletsWithoutAccount: number;
  healthy: boolean;
}

interface ShadowData {
  charges: { paid: number; withJournal: number; missing: Array<{ id: string; appClientId: string }> };
  appPayables: Array<{ appClientId: string; expectedMinor: string; ledgerMinor: string; differenceMinor: string }>;
  walletDrift: number;
  identityHolds: boolean;
  healthy: boolean;
}

export function ReconciliationTab() {
  const recon = useLedgerReconciliation();
  const shadow = useLedgerShadow();

  const data = recon.data as ReconciliationData | undefined;
  const shadowData = shadow.data as ShadowData | undefined;

  if (recon.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Proves the materialised balances still describe the journal, and that every paid charge is booked.
        </p>
        <button
          onClick={() => {
            recon.refetch();
            shadow.refetch();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', (recon.isFetching || shadow.isFetching) && 'animate-spin text-brand-blue')} />
          Re-run
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cn('rounded-3xl border p-5 shadow-sm', data?.healthy ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100')}>
          <div className="flex items-center gap-2">
            {data?.healthy ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-rose-600" />}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Journal</p>
          </div>
          <p className={cn('text-xl font-black mt-2', data?.healthy ? 'text-emerald-700' : 'text-rose-700')}>
            {data?.healthy ? 'Healthy' : 'Drift detected'}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">{data?.accountsChecked ?? 0} accounts checked</p>
        </div>

        <div className={cn('rounded-3xl border p-5 shadow-sm', shadowData?.healthy ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100')}>
          <div className="flex items-center gap-2">
            {shadowData?.healthy ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-amber-600" />}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Charges</p>
          </div>
          <p className={cn('text-xl font-black mt-2', shadowData?.healthy ? 'text-emerald-700' : 'text-amber-700')}>
            {shadowData?.charges.withJournal ?? 0}/{shadowData?.charges.paid ?? 0} booked
          </p>
          <p className="text-[11px] text-gray-500 mt-1">every paid charge has a journal trail</p>
        </div>

        <div className={cn('rounded-3xl border p-5 shadow-sm', data?.identityHolds ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100')}>
          <div className="flex items-center gap-2">
            {data?.identityHolds ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-rose-600" />}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Identity</p>
          </div>
          <p className={cn('text-xl font-black mt-2', data?.identityHolds ? 'text-emerald-700' : 'text-rose-700')}>
            {data?.identityHolds ? 'Balanced' : formatMinor(data?.identityDifferenceMinor)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">assets = liabilities + equity</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-3">Balance sheet</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assets</p>
            <p className="font-bold text-gray-900">{formatMinor(data?.assetTotalMinor)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Liabilities</p>
            <p className="font-bold text-gray-900">{formatMinor(data?.liabilityTotalMinor)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Equity</p>
            <p className="font-bold text-gray-900">{formatMinor(data?.equityTotalMinor)}</p>
          </div>
        </div>
      </div>

      {(data?.accountDrift.length ?? 0) > 0 && (
        <div className="bg-white rounded-3xl border border-rose-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-rose-700 uppercase tracking-widest mb-2">Account drift</h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="py-2">Account</th>
                <th className="py-2 text-right">Stored</th>
                <th className="py-2 text-right">Expected</th>
                <th className="py-2 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {data?.accountDrift.map((row) => (
                <tr key={row.code} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-mono text-[11px]">{row.code}</td>
                  <td className="py-2 text-right">{formatMinor(row.storedMinor)}</td>
                  <td className="py-2 text-right">{formatMinor(row.expectedMinor)}</td>
                  <td className="py-2 text-right text-rose-600">{formatMinor(row.differenceMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(data?.walletDrift.length ?? 0) > 0 && (
        <div className="bg-white rounded-3xl border border-rose-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-rose-700 uppercase tracking-widest mb-2">Wallet drift</h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="py-2">Wallet</th>
                <th className="py-2 text-right">Wallet balance</th>
                <th className="py-2 text-right">Ledger</th>
                <th className="py-2 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {data?.walletDrift.map((row) => (
                <tr key={row.walletId} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-mono text-[11px]">{row.walletId}</td>
                  <td className="py-2 text-right">{formatMinor(row.walletBalanceMinor)}</td>
                  <td className="py-2 text-right">{formatMinor(row.ledgerBalanceMinor)}</td>
                  <td className="py-2 text-right text-rose-600">{formatMinor(row.differenceMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(shadowData?.appPayables.length ?? 0) > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-1">
            App payable vs charges
          </h3>
          <p className="text-[11px] text-gray-400 mb-3">
            Informational: an app payable also receives partner wallet-API movements, so a charge-only
            expectation can legitimately differ from the account balance.
          </p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="py-2">App</th>
                <th className="py-2 text-right">From charges</th>
                <th className="py-2 text-right">Ledger</th>
                <th className="py-2 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {shadowData?.appPayables.map((row) => (
                <tr key={row.appClientId} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-mono text-[11px]">{row.appClientId}</td>
                  <td className="py-2 text-right">{formatMinor(row.expectedMinor)}</td>
                  <td className="py-2 text-right">{formatMinor(row.ledgerMinor)}</td>
                  <td className="py-2 text-right text-amber-600">{formatMinor(row.differenceMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
