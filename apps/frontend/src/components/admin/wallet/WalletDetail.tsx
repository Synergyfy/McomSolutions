import { useState } from 'react';
import {
  ArrowLeft,
  Snowflake,
  Sun,
  XCircle,
  Plus,
  Minus,
  Settings2,
  Search,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useAdminWallet, useAdminWalletTransactions, useAdminWalletMutation, useReverseTransaction } from './hooks/useWalletAdmin';
import type { WalletTransaction } from './api/wallet-admin.api';

type ModalState =
  | { kind: 'freeze' | 'unfreeze' | 'close' }
  | { kind: 'credit' | 'debit' }
  | { kind: 'limits' }
  | { kind: 'reverse'; txn: WalletTransaction }
  | null;

export function WalletDetail({ walletId, onBack }: { walletId: string; onBack: () => void }) {
  const { data: wallet, isLoading } = useAdminWallet(walletId);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const { data: txns } = useAdminWalletTransactions(walletId, filters);
  const [modal, setModal] = useState<ModalState>(null);

  if (isLoading || !wallet) {
    return <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center text-xs text-gray-400 shadow-sm">Loading wallet...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-black text-gray-900 font-display">{wallet.email || wallet.userId}</h3>
          <p className="text-[10px] font-mono text-gray-400">Wallet {wallet.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={wallet.status} />
          <button onClick={() => setModal({ kind: 'freeze' })} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 text-xs font-bold transition-colors border border-sky-200"><Snowflake className="w-3.5 h-3.5" />Freeze</button>
          <button onClick={() => setModal({ kind: 'unfreeze' })} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold transition-colors border border-emerald-200"><Sun className="w-3.5 h-3.5" />Unfreeze</button>
          <button onClick={() => setModal({ kind: 'close' })} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors border border-red-200"><XCircle className="w-3.5 h-3.5" />Close</button>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceCard label="Balance" value={wallet.balance} sub="Spendable ledger balance" />
        <BalanceCard label="Available" value={wallet.availableBalance} sub={`${wallet.activeHolds?.length ?? 0} active hold(s)`} accent />
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col justify-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Quick Actions</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setModal({ kind: 'credit' })} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"><Plus className="w-3.5 h-3.5" />Credit</button>
            <button onClick={() => setModal({ kind: 'debit' })} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"><Minus className="w-3.5 h-3.5" />Debit</button>
            <button onClick={() => setModal({ kind: 'limits' })} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-800 text-white text-xs font-bold hover:bg-gray-700 transition-colors"><Settings2 className="w-3.5 h-3.5" />Limits</button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-black text-gray-900 font-display text-sm">Transactions</h4>
            <p className="text-[10px] text-gray-400 font-bold">Append-only ledger — never edited or deleted</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value || undefined }))}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600"
            >
              <option value="">All Types</option>
              <option value="CREDIT">Credit</option>
              <option value="DEBIT">Debit</option>
            </select>
            <select
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600"
            >
              <option value="">All Categories</option>
              {['TOP_UP', 'REWARD', 'REFUND', 'SUBSCRIPTION', 'PURCHASE', 'SERVICE_FEE', 'ADMIN_CREDIT', 'ADMIN_DEBIT'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setFilters((f) => ({ ...f, search: search || undefined }))}
                placeholder="Search..."
                className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(txns?.data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-xs text-gray-400">No transactions match.</td></tr>
              ) : (
                (txns?.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs font-bold text-gray-700">{t.platformName || t.platformClientId || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${t.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{t.type}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600 max-w-[280px] truncate">{t.description || t.reference || t.id}</td>
                    <td className={`px-5 py-3 text-right text-sm font-black ${t.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.type === 'CREDIT' ? '+' : '−'}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setModal({ kind: 'reverse', txn: t })}
                        disabled={t.status === 'REVERSED'}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-30"
                      >
                        Reverse <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ActionModal
          modal={modal}
          walletId={walletId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    FROZEN: 'bg-sky-50 text-sky-600 border-sky-200',
    SUSPENDED: 'bg-amber-50 text-amber-600 border-amber-200',
    CLOSED: 'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${map[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      <ShieldCheck className="w-3 h-3" /> {status}
    </span>
  );
}

function BalanceCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border shadow-sm p-5 ${accent ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white border-gray-100'}`}>
      <span className={`text-[10px] font-black uppercase tracking-widest ${accent ? 'text-emerald-100' : 'text-gray-400'}`}>{label}</span>
      <div className={`text-3xl font-black mt-1 font-display ${accent ? 'text-white' : 'text-gray-900'}`}>
        {value.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-bold opacity-60">MCOM</span>
      </div>
      <div className={`text-[10px] mt-1 font-bold ${accent ? 'text-emerald-100' : 'text-gray-400'}`}>{sub}</div>
    </div>
  );
}

function ActionModal({ modal, walletId, onClose }: { modal: Exclude<ModalState, null>; walletId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('ADMIN_CREDIT');
  const [description, setDescription] = useState('');
  const [limits, setLimits] = useState({ dailyDebitLimit: '', monthlyDebitLimit: '', maxBalance: '' });
  const [error, setError] = useState<string | null>(null);

  const mutation = useAdminWalletMutation(
    walletId,
    modal.kind === 'freeze' ? 'freeze' : modal.kind === 'unfreeze' ? 'unfreeze' : modal.kind === 'close' ? 'close' : modal.kind,
  );
  const reverseMutation = useReverseTransaction();

  const submit = async () => {
    setError(null);
    try {
      if (modal.kind === 'freeze' || modal.kind === 'unfreeze' || modal.kind === 'close') {
        if (!reason.trim()) { setError('A reason is mandatory'); return; }
        await mutation.mutateAsync({ reason });
      } else if (modal.kind === 'credit' || modal.kind === 'debit') {
        if (!amount || !reason.trim()) { setError('Amount and reason are required'); return; }
        await mutation.mutateAsync({ amount: Number(amount), category, description: description || `${modal.kind} adjustment`, reason });
      } else if (modal.kind === 'limits') {
        await mutation.mutateAsync({
          dailyDebitLimit: limits.dailyDebitLimit ? Number(limits.dailyDebitLimit) : undefined,
          monthlyDebitLimit: limits.monthlyDebitLimit ? Number(limits.monthlyDebitLimit) : undefined,
          maxBalance: limits.maxBalance ? Number(limits.maxBalance) : undefined,
        });
      } else if (modal.kind === 'reverse') {
        if (!reason.trim()) { setError('A reason is mandatory'); return; }
        await reverseMutation.mutateAsync({ id: modal.txn.id, reason });
      }
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Action failed');
    }
  };

  const title =
    modal.kind === 'freeze' ? 'Freeze Wallet' :
    modal.kind === 'unfreeze' ? 'Unfreeze Wallet' :
    modal.kind === 'close' ? 'Close Wallet (irreversible)' :
    modal.kind === 'credit' ? 'Manual Credit' :
    modal.kind === 'debit' ? 'Manual Debit' :
    modal.kind === 'limits' ? 'Set Wallet Limits' :
    `Reverse Transaction ${modal.txn.type === 'CREDIT' ? '+' : '−'}${modal.txn.amount}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-black text-gray-900 font-display">{title}</h3>

        <div className="mt-4 space-y-3">
          {(modal.kind === 'credit' || modal.kind === 'debit') && (
            <>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" placeholder="Amount (MCOM)" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700">
                {modal.kind === 'credit'
                  ? ['ADMIN_CREDIT', 'REWARD', 'REFUND'].map((c) => <option key={c} value={c}>{c}</option>)
                  : ['ADMIN_DEBIT', 'SERVICE_FEE'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
            </>
          )}

          {modal.kind === 'limits' && (
            <>
              <input value={limits.dailyDebitLimit} onChange={(e) => setLimits({ ...limits, dailyDebitLimit: e.target.value })} type="number" placeholder="Daily debit limit" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
              <input value={limits.monthlyDebitLimit} onChange={(e) => setLimits({ ...limits, monthlyDebitLimit: e.target.value })} type="number" placeholder="Monthly debit limit" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
              <input value={limits.maxBalance} onChange={(e) => setLimits({ ...limits, maxBalance: e.target.value })} type="number" placeholder="Max balance" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
            </>
          )}

          {(modal.kind !== 'limits') && (
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compliance reason (required)" rows={2} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          )}

          {error && <p className="text-xs font-bold text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50">Cancel</button>
          <button
            onClick={submit}
            disabled={mutation.isPending || reverseMutation.isPending}
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition-colors disabled:opacity-40"
          >
            {mutation.isPending || reverseMutation.isPending ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}