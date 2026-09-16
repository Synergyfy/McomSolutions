import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Loader2,
  CheckCircle2,
  X,
  CreditCard,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  useMyWallet,
  useWalletTransactions,
  useWalletSummary,
  useWalletHolds,
  useInitiateTopUp,
  useConfirmTopUp,
} from '../services/wallet/hooks';
import { cn } from '../lib/utils';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export default function DashboardWallet() {
  const { data: wallet, isLoading: walletLoading } = useMyWallet();
  const { data: txns, isLoading: txnsLoading } = useWalletTransactions({ limit: 20 });
  const { data: summary } = useWalletSummary('30d');
  const { data: holds } = useWalletHolds();
  const [showTopUp, setShowTopUp] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [urlNotice, setUrlNotice] = useState<'success' | 'cancelled' | null>(null);

  useEffect(() => {
    const topupStatus = searchParams.get('topup');
    if (topupStatus === 'success') {
      setUrlNotice('success');
      searchParams.delete('topup');
      setSearchParams(searchParams, { replace: true });
    } else if (topupStatus === 'cancelled') {
      setUrlNotice('cancelled');
      searchParams.delete('topup');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const maxSpent = Math.max(...(summary?.spentByPlatform ?? []).map((p) => p.totalSpent), 1);

  return (
    <div className="space-y-6">
      {/* Notice for residual or direct query param visits */}
      {urlNotice === 'success' && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-4 rounded-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-bold">Wallet top-up successful! Your credits have been updated.</p>
          </div>
          <button onClick={() => setUrlNotice(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {urlNotice === 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <X className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-bold">Top-up was cancelled. No charges were made.</p>
          </div>
          <button onClick={() => setUrlNotice(null)} className="text-amber-700 hover:text-amber-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

function StripePaymentForm({
  amount,
  topUpRequestId,
  onSuccess,
  onCancel,
}: {
  amount: number;
  topUpRequestId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const confirmTopUp = useConfirmTopUp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed. Please try another card.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        await confirmTopUp.mutateAsync({
          topUpRequestId,
          paymentIntentId: paymentIntent.id,
        });
        onSuccess();
      } catch (confirmErr: any) {
        console.warn('Fallback: in-app confirm notice:', confirmErr);
        // Webhook handles fulfillment even if client call encounters transient issue
        onSuccess();
      }
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative min-h-[220px] flex flex-col justify-center">
        {!isReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 py-6">
            <RefreshCw className="w-6 h-6 text-orange-500 animate-spin mb-2" />
            <p className="text-xs text-gray-400 font-bold">Loading secure payment options...</p>
          </div>
        )}
        <PaymentElement onReady={() => setIsReady(true)} />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      <div className="pt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || !isReady || isProcessing}
          className="flex-1 py-3 px-5 rounded-xl bg-orange-500 text-white text-xs font-black hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            `Pay £${amount.toFixed(2)} Now`
          )}
        </button>
      </div>
    </form>
  );
}

function TopUpModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'amount' | 'payment' | 'success'>('amount');
  const [amount, setAmount] = useState('50');
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [topUpRequestId, setTopUpRequestId] = useState<string | null>(null);
  const initiateTopUp = useInitiateTopUp();

  const handleInitiate = async () => {
    setError(null);
    const val = Number(amount);
    if (!amount || isNaN(val) || val < 5 || val > 500) {
      setError('Amount must be between £5 and £500');
      return;
    }

    try {
      const res = await initiateTopUp.mutateAsync({ amount: val });
      if (res.clientSecret && res.topUpRequestId) {
        setClientSecret(res.clientSecret);
        setTopUpRequestId(res.topUpRequestId);
        setStep('payment');
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        throw new Error('No payment secret returned');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to initiate payment');
    }
  };

  const handleSuccess = () => {
    setStep('success');
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {step === 'amount' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 font-display text-base">Top Up Wallet</h3>
                <p className="text-xs text-gray-400 font-medium">Add spendable credits to your MCOM balance</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount (£)</label>
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">£</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min={5}
                  max={500}
                  placeholder="50"
                  autoFocus
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-2xl font-black focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white text-gray-900"
                />
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {[20, 50, 100, 250].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border',
                      amount === String(v)
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600'
                    )}
                  >
                    £{v}
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2 text-[11px] font-bold text-gray-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>1 GBP = 1.00 MCOM credit. Instant settlement across all apps.</span>
              </div>

              {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitiate}
                disabled={initiateTopUp.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-black hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-md"
              >
                {initiateTopUp.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Continue to Payment
              </button>
            </div>
          </div>
        )}

        {step === 'payment' && clientSecret && topUpRequestId && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setStep('amount')}
                className="p-1.5 -ml-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="font-black text-gray-900 font-display text-base">Payment Details</h3>
                <p className="text-xs text-gray-400 font-medium">Topping up £{Number(amount).toFixed(2)}</p>
              </div>
            </div>

            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripePaymentForm
                amount={Number(amount)}
                topUpRequestId={topUpRequestId}
                onSuccess={handleSuccess}
                onCancel={() => setStep('amount')}
              />
            </Elements>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 animate-in zoom-in-75 duration-200">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-lg font-black text-gray-900 font-display">Top-Up Successful!</h3>
            <p className="text-xs text-gray-500 mt-1.5 max-w-xs">
              £{Number(amount).toFixed(2)} MCOM credits have been added to your wallet and are ready to spend.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}