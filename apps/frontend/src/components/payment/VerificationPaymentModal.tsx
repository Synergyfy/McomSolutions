import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, RefreshCw, CreditCard, ShieldCheck, CheckCircle2, Sparkles, Lock, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { paymentApi } from '../../services/payment';
import { cn } from '../../lib/utils';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function StripeVerificationForm({
  amount,
  trialDays,
  onSuccess,
  onCancel,
}: {
  amount: number;
  trialDays: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStripeReady, setIsStripeReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/payment/success?verification=true&onboarding=true`;

      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Verification confirmation failed. Please check your card details.');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        const confirmRes = await paymentApi.verificationStripeConfirm(paymentIntent.id);
        
        // Update local session storage
        const userRaw = localStorage.getItem('business_user');
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw);
            if (u?.businessProfile) {
              u.businessProfile.hasPaidVerificationFee = true;
              u.businessProfile.trialAccessDays = confirmRes.trialAccessDays || trialDays;
              u.businessProfile.trialAccessExpiresAt = confirmRes.trialAccessExpiresAt;
              localStorage.setItem('business_user', JSON.stringify(u));
            }
          } catch (e) {
            console.warn('Failed to update local user profile:', e);
          }
        }

        onSuccess();
      } else {
        setError('Verification payment status: ' + (paymentIntent?.status || 'pending') + '. Please try again.');
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Stripe verification submission error:', err);
      setError(err?.response?.data?.message || err?.message || 'Verification failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 min-h-[160px]">
        <PaymentElement
          onReady={() => setIsStripeReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
        {!isStripeReady && (
          <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-blue" />
            Loading secure payment form...
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2 font-medium">
          <span className="shrink-0 mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing || !isStripeReady}
        className={cn(
          "w-full h-12 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2",
          isProcessing || !stripe || !isStripeReady
            ? "bg-gray-300 cursor-not-allowed shadow-none"
            : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 active:scale-[0.99] cursor-pointer"
        )}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Verifying Card & Unlocking Access...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay £{amount.toFixed(2)} & Start {trialDays}-Day Free Access
          </>
        )}
      </button>
    </form>
  );
}

export default function VerificationPaymentModal({
  open,
  trialDays = 14,
  amount = 1.00,
  onClose,
  onSuccess,
}: {
  open: boolean;
  trialDays?: number;
  amount?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setInitError(null);
      return;
    }

    let isMounted = true;
    const initStripe = async () => {
      setLoading(true);
      setInitError(null);
      try {
        const res = await paymentApi.verificationStripeInitiate();
        if (isMounted) {
          setClientSecret(res.clientSecret);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to initiate verification payment:', err);
          setInitError(err?.response?.data?.message || 'Failed to initialize verification checkout.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initStripe();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handlePaypalSubmit = async () => {
    setPaypalLoading(true);
    setInitError(null);
    try {
      const returnUrl = `${window.location.origin}/payment/paypal/return?type=verification&onboarding=true`;
      const cancelUrl = `${window.location.origin}/getstarted/business`;
      const res = await paymentApi.verificationPaypalInitiate(returnUrl, cancelUrl);
      if (res?.approvalUrl) {
        window.location.href = res.approvalUrl;
      } else {
        setInitError('Failed to get PayPal approval URL.');
      }
    } catch (err: any) {
      console.error('PayPal initiation failed:', err);
      setInitError(err?.response?.data?.message || 'PayPal payment initialization failed.');
    } finally {
      setPaypalLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">Step 1: Security & Identity</span>
              <h2 className="text-xl font-bold text-white leading-tight">Account Verification Fee</h2>
            </div>
          </div>

          <p className="text-sm text-gray-300 mt-2 leading-relaxed">
            Pay a nominal <strong className="text-white">£{amount.toFixed(2)}</strong> verification fee to validate your business profile and unlock <strong className="text-emerald-400">{trialDays} days of full platform access</strong>.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Why £1 Badge */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 space-y-1">
              <p className="font-bold">What is this fee for?</p>
              <p className="text-emerald-800 leading-normal">
                This £1.00 charge protects our merchant network from fraudulent listings and bots. Once verified, you immediately get <strong>{trialDays} days free access</strong> to explore and customize your storefront.
              </p>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProvider('stripe')}
              className={cn(
                "p-3.5 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer",
                provider === 'stripe'
                  ? "border-emerald-600 bg-emerald-50/40 text-emerald-900 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
              )}
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Debit / Credit Card
            </button>
            <button
              type="button"
              onClick={() => setProvider('paypal')}
              className={cn(
                "p-3.5 rounded-2xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer",
                provider === 'paypal'
                  ? "border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 text-gray-600 bg-white"
              )}
            >
              <span className="font-extrabold text-blue-600">P</span>
              PayPal
            </button>
          </div>

          {initError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <span>⚠️</span>
              <span>{initError}</span>
            </div>
          )}

          {/* Provider Form */}
          {provider === 'stripe' && (
            <div>
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-xs font-semibold">Initializing secure card session...</span>
                </div>
              ) : clientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#059669',
                        borderRadius: '12px',
                        fontFamily: 'Outfit, system-ui, sans-serif',
                      },
                    },
                  }}
                >
                  <StripeVerificationForm
                    amount={amount}
                    trialDays={trialDays}
                    onSuccess={onSuccess}
                    onCancel={onClose}
                  />
                </Elements>
              ) : (
                <div className="py-8 text-center text-xs text-gray-500">
                  Could not load Stripe payment elements. Please try PayPal or reload.
                </div>
              )}
            </div>
          )}

          {provider === 'paypal' && (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center space-y-2">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto font-black text-xl">
                  P
                </div>
                <h4 className="font-bold text-gray-900 text-sm">PayPal Checkout</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  You will be redirected to PayPal to securely approve the £{amount.toFixed(2)} verification charge.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePaypalSubmit}
                disabled={paypalLoading}
                className={cn(
                  "w-full h-12 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2",
                  paypalLoading
                    ? "bg-gray-300 cursor-not-allowed shadow-none"
                    : "bg-[#0070ba] hover:bg-[#005ea6] shadow-blue-500/20 active:scale-[0.99] cursor-pointer"
                )}
              >
                {paypalLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting to PayPal...
                  </>
                ) : (
                  <>
                    <span>Pay £{amount.toFixed(2)} with PayPal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Security Footer */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-4 text-[11px] text-gray-400 font-medium">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600" />
              256-Bit SSL Encrypted
            </span>
            <span>•</span>
            <span>PCI-DSS Level 1</span>
            <span>•</span>
            <span>No recurring charge</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
