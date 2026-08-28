import { useState } from 'react';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus, Loader2 } from 'lucide-react';
import { useMyWallet, useWalletTransactions, useWalletSummary, useWalletHolds, useInitiateTopUp } from '../services/wallet/hooks';
import { cn } from '../lib/utils';

export default function DashboardWallet() {
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: txns, isLoading: txnsLoading } = useWalletTransactions({ limit: 20 });
  const { data: summary } = useWalletSummary('30d');
  const { data: holds } = useWalletHolds();
  const [showTopUp, setShowTopUp] = useState(false);

  const maxSpent = Math.max(...(summary?.spentByPlatform ?? []).map((p) => p.totalSpent), 1);

  return (
    <div className="space-y-6">
      {/* Balance hero */}
      <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-glow relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-orange-100 text-xs font-bold uppercase tracking-widest">
              <WalletIcon className="w-4 h-4" /> MCOM Wallet Balance
            </div>
            {walletLoading ? (
              <div className="text-4xl font-black mt-2 font-display animate-pulse">...</div>
            ) : (
              <>
                <div className="text-4xl md:text-5xl font-black mt-2 font-display">
                  {(wallet?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  <span className="text-lg font-bold ml-2 opacity-80">MCOM</span>
                </div>
                <div className="mt-2 text-xs font-bold text-orange-100">
                  Available: {(wallet?.availableBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} MCOM
                  {holds?.data?.length > 0 && <span className="ml-2 opacity-80">· {holds.data.length} hold(s) active</span>}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowTopUp(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-orange-600 rounded-2xl font-black text-sm hover:bg-orange-50 transition-colors shadow-md self-start"
          >
            <Plus className="w-4 h-4" /> Top Up Wallet
          </button>
        </div>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Spent (30d)" value={summary?.totalSpent ?? 0} color="text-red-500" icon={ArrowDownLeft} />
        <StatCard label="Received (30d)" value={summary?.totalCredited ?? 0} color="text-emerald-500" icon={ArrowUpRight} />
        <StatCard label="Net Flow" value={summary?.netFlow ?? 0} color={(summary?.netFlow ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'} icon={WalletIcon} />
      </div>

      {/* Spending by platform */}
      {(summary?.spentByPlatform?.length ?? 0) > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-black text-gray-900 font-display text-sm mb-4">Spending by Platform</h3>
          <div className="space-y-3">
            {summary.spentByPlatform.map((p) => (
              <div key={p.platformSlug || p.platformName}>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-gray-700">{p.platformName || p.platformSlug}</span>
                  <span className="text-gray-500">{p.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })} MCOM</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(p.totalSpent / maxSpent) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-black text-gray-900 font-display text-sm">Transactions</h3>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Across all platforms</span>
        </div>
        {txnsLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (txns?.data ?? []).length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400 font-bold">
            No transactions yet. Top up your wallet to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {txns.data.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
                <div className={cn(
                  'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0',
                  t.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                )}>
                  {t.type === 'CREDIT' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">{t.description || t.reference || t.id}</div>
                  <div className="text-[11px] text-gray-400 font-bold mt-0.5">
                    {t.platformName || t.platformClientId || 'MCOM Central'} · {new Date(t.createdAt).toLocaleDateString()} · {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={cn('text-sm font-black', t.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500')}>
                  {t.type === 'CREDIT' ? '+' : '−'}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <Icon className={`w-3.5 h-3.5 ${color}`} /> {label}
      </div>
      <div className={cn('text-2xl font-black mt-1 font-display', color)}>
        {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

function TopUpModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const topUp = useInitiateTopUp();

  const submit = async () => {
    setError(null);
    const val = Number(amount);
    if (!amount || isNaN(val) || val < 5 || val > 500) {
      setError('Amount must be between £5 and £500');
      return;
    }
    try {
      const res = await topUp.mutateAsync({ amount: val });
      window.location.href = res.checkoutUrl;
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to start top-up');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-black text-gray-900 font-display">Top Up Wallet</h3>
        <p className="text-xs text-gray-400 font-bold mt-1">Pay with card via Stripe. Credits land instantly on success.</p>

        <div className="mt-5">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount (£)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min={5}
            max={500}
            placeholder="50"
            autoFocus
            className="mt-1.5 w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white"
          />
          <div className="mt-2 flex items-center gap-1.5">
            {[20, 50, 100].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-bold text-gray-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-colors">
                £{v}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50">Cancel</button>
          <button
            onClick={submit}
            disabled={topUp.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-black hover:bg-orange-600 transition-colors disabled:opacity-40"
          >
            {topUp.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Continue to Stripe
          </button>
        </div>
      </div>
    </div>
  );
}