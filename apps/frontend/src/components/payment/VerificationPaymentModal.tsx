import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, RefreshCw, CreditCard, ShieldCheck, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { paymentApi } from '../../services/payment';
import { cn } from '../../lib/utils';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function StripeVerificationForm({
  amount,
  trialDays,
  onSuccess,
}: {
  amount: number;
  trialDays: number;
  onSuccess: () => void;
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
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
      <div className="min-h-[160px] rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <PaymentElement
          onReady={() => setIsStripeReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
        {!isStripeReady && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            Loading secure payment form...
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing || !isStripeReady}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-md transition-all",
          isProcessing || !stripe || !isStripeReady
            ? "cursor-not-allowed bg-slate-300 shadow-none"
            : "cursor-pointer bg-orange-600 hover:bg-orange-700 active:scale-[0.99]"
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
            Pay £{amount.toFixed(2)} &amp; Start {trialDays}-Day Trial
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
      setLoading(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
        className="my-auto flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_32px_100px_rgba(2,6,23,0.38)]"
      >
        <div className="relative overflow-hidden bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-7">
          <div className="absolute -right-12 -top-20 h-52 w-52 rounded-full border-[28px] border-blue-500/10" />
          <div className="absolute -right-3 -top-12 h-40 w-40 rounded-full border-[18px] border-orange-500/15" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification"
            className="absolute right-4 top-4 z-10 rounded-xl border border-white/10 bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative z-[1] flex items-start gap-3 pr-10 sm:gap-4">
            <img src="/chs-icon.png" alt="" className="h-11 w-11 shrink-0 object-contain" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">Business onboarding · Verification</p>
              <h2 id="verification-modal-title" className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">Verify your business</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Confirm your business before setting up your trial access and choosing a plan.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(270px,0.78fr)_minmax(0,1.22fr)] lg:overflow-hidden">
          <section className="flex flex-col justify-center border-b border-slate-100 bg-slate-50/70 p-5 sm:p-7 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Business profile</p>
            <div className="mt-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-950">Your details are ready</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">Complete the one-time verification to continue to membership options.</p>
              </div>
            </div>
            <div className="mt-7 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-blue-700" />
                One-time verification
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                A single £{amount.toFixed(2)} fee is required to complete this step. It is not a subscription and will not recur.
              </p>
            </div>
          </section>

          <section className="min-h-0 p-5 sm:p-7 lg:overflow-y-auto lg:p-7">
                <div className="mb-4">
                  <h3 className="text-lg font-extrabold tracking-tight text-slate-950">Choose a payment method</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Your payment is handled securely by our checkout provider.</p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setProvider('stripe'); setInitError(null); }}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-colors sm:text-sm',
                      provider === 'stripe' ? 'border-orange-500 bg-orange-50 text-orange-950 ring-1 ring-orange-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                  >
                    <CreditCard className="h-4 w-4 text-blue-700" />
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProvider('paypal'); setInitError(null); }}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-colors sm:text-sm',
                      provider === 'paypal' ? 'border-blue-600 bg-blue-50 text-blue-950 ring-1 ring-blue-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                  >
                    <span className="font-extrabold text-blue-700">P</span>
                    PayPal
                  </button>
                </div>

                {initError && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700" role="alert">
                    <span className="shrink-0">⚠️</span>
                    <span>{initError}</span>
                  </div>
                )}

                {provider === 'stripe' && (
                  <div className="mt-4">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                        Preparing secure card checkout…
                      </div>
                    ) : clientSecret ? (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: 'stripe',
                            variables: {
                              colorPrimary: '#ea580c',
                              borderRadius: '12px',
                              fontFamily: 'Outfit, system-ui, sans-serif',
                            },
                          },
                        }}
                      >
                        <StripeVerificationForm amount={amount} trialDays={trialDays} onSuccess={onSuccess} />
                      </Elements>
                    ) : !initError ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                        Card checkout could not be loaded. Try PayPal or close this window and try again.
                      </div>
                    ) : null}
                  </div>
                )}

                {provider === 'paypal' && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                      <h4 className="text-sm font-bold text-slate-900">PayPal checkout</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-600">You’ll be redirected to PayPal to approve the one-time £{amount.toFixed(2)} verification fee.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePaypalSubmit}
                      disabled={paypalLoading}
                      className={cn(
                        'flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white shadow-md transition-colors',
                        paypalLoading ? 'cursor-not-allowed bg-slate-300 shadow-none' : 'cursor-pointer bg-blue-700 hover:bg-blue-800',
                      )}
                    >
                      {paypalLoading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Connecting to PayPal…</> : <>Pay £{amount.toFixed(2)} with PayPal <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>
                )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-medium text-slate-500 sm:text-[11px]">
          <span className="flex items-center gap-1.5"><Lock className="h-3 w-3 text-blue-700" />Secure checkout</span>
          <span className="text-slate-300">•</span><span>No recurring verification charge</span>
          <span className="text-slate-300">•</span>
          <button type="button" onClick={onClose} className="cursor-pointer font-semibold text-slate-600 hover:text-orange-700">Back to programme</button>
        </div>
      </motion.div>
    </div>
  );
}
