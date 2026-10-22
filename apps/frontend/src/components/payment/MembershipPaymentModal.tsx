import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, RefreshCw, CreditCard, ShieldCheck, CheckCircle2, Crown, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { paymentApi } from '../../services/payment';
import { usePricing } from '../../context/PricingContext';
import PaymentPlanSelector from './PaymentPlanSelector';
import CouponCodeField from './CouponCodeField';
import type { CouponQuote } from '../../services/admin/types';
import { priceOptionWithCoupon } from '../../lib/couponPricing';
import { cn } from '../../lib/utils';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export interface MembershipPaymentPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  totalPerCycle: number;
  description?: string;
  includedApps?: Array<{ platform: string; planName: string; standalonePrice?: number }>;
  selectedTier?: 'Standard' | 'Pro' | 'Pro+';
}

function StripeMembershipForm({
  plan,
  paymentPlan,
  couponCode,
  source = 'onboarding',
  onSuccess,
  onCancel,
}: {
  plan: MembershipPaymentPlan;
  paymentPlan: string;
  couponCode?: string;
  source?: 'dashboard' | 'onboarding';
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
      const returnUrl =
        source === 'dashboard'
          ? `${window.location.origin}/dashboard/memberships?payment_success=true`
          : `${window.location.origin}/payment/success?plan=${encodeURIComponent(plan.id)}&billing=${encodeURIComponent(plan.billingCycle)}&onboarding=true`;

      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment confirmation failed. Please check your card details and try again.');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Activate subscription in database
        await paymentApi.stripeConfirm(
          plan.id,
          plan.selectedTier || 'Standard',
          plan.billingCycle,
          paymentIntent.id,
          false,
          paymentPlan,
          couponCode
        );

        // Update local session
        const userRaw = localStorage.getItem('business_user');
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw);
            if (u?.businessProfile) {
              u.businessProfile.membershipLevel = plan.name || plan.id;
              u.businessProfile.membershipTier = plan.selectedTier || 'Standard';
              u.businessProfile.membershipStatus = 'active';
              localStorage.setItem('business_user', JSON.stringify(u));
            }
          } catch (e) {
            console.warn('Failed to update local business_user:', e);
          }
        }

        onSuccess();
      } else {
        setError('Payment status: ' + (paymentIntent?.status || 'pending') + '. Please try again or contact support.');
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Stripe membership submission error:', err);
      setError(err?.response?.data?.message || err?.message || 'Payment processing failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="relative min-h-[220px] flex flex-col justify-center">
        {!isStripeReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 py-6">
            <RefreshCw className="w-7 h-7 text-orange-500 animate-spin mb-3" />
            <p className="text-gray-500 font-medium text-xs sm:text-sm">Loading secure card form...</p>
          </div>
        )}
        <PaymentElement onReady={() => setIsStripeReady(true)} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs sm:text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2 sm:gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-orange-500 hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            `Pay £${plan.totalPerCycle} Now`
          )}
        </button>
      </div>
    </form>
  );
}

export default function MembershipPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
  source = 'dashboard',
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: MembershipPaymentPlan | null;
  source?: 'dashboard' | 'onboarding';
}) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingSecret, setIsLoadingSecret] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isProcessingPaypal, setIsProcessingPaypal] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<string>('full');
  const [autoRenew, setAutoRenew] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponQuote | null>(null);

  const { plans } = usePricing();
  const modalPlan = plan ? plans.find((p) => p.id === plan.id || p.name === plan.id || p.name === plan.name) : undefined;
  const currentSelectedTier = plan?.selectedTier || 'Standard';
  const modalTier =
    modalPlan?.tiers?.find((t) => t.tier === currentSelectedTier) ||
    modalPlan?.tiers?.find((t) => t.tier === 'Standard');
  const modalOptions =
    modalTier && modalTier.paymentOptions.length > 0
      ? modalTier.paymentOptions
      : [{
          paymentPlan: 'full' as const,
          installments: 1,
          mode: 'manual' as const,
          perChargePrice: plan?.totalPerCycle ?? plan?.price ?? 0,
          totalPrice: plan?.totalPerCycle ?? plan?.price ?? 0,
          sliceDays: modalTier?.durationDays ?? (currentSelectedTier === 'Pro+' ? 365 : currentSelectedTier === 'Pro' ? 180 : 90),
        }];
  const modalSelected = modalOptions.find((o) => o.paymentPlan === paymentPlan) ?? modalOptions[0];
  const displayModalOptions = appliedCoupon?.coupon
    ? modalOptions.map((option) => priceOptionWithCoupon(option, appliedCoupon.coupon!))
    : modalOptions;
  const displaySelected =
    displayModalOptions.find((o) => o.paymentPlan === paymentPlan) ?? displayModalOptions[0];
  const baseDueToday = Number(modalSelected.perChargePrice);
  const modalDueToday = appliedCoupon?.coupon
    ? Number(displaySelected.perChargePrice)
    : baseDueToday;
  const modalTotal = appliedCoupon?.coupon
    ? Number(displaySelected.totalPrice)
    : Number(modalSelected.totalPrice);
  const couponCode = appliedCoupon?.coupon?.code;

  useEffect(() => {
    if (!isOpen || !plan) {
      setClientSecret(null);
      setInitError(null);
      setIsPaymentSuccess(false);
      setPaymentPlan('full');
      setAutoRenew(false);
      setAppliedCoupon(null);
      return;
    }

    if (provider === 'stripe') {
      let isMounted = true;
      setIsLoadingSecret(true);
      setClientSecret(null);
      setInitError(null);

      paymentApi
        .stripeInitiate(plan.id, plan.selectedTier || 'Standard', plan.billingCycle, false, paymentPlan, couponCode, autoRenew)
        .then((data) => {
          if (isMounted) {
            if (data?.clientSecret) {
              setClientSecret(data.clientSecret);
            } else {
              setInitError('Could not initialize payment with Stripe.');
            }
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Failed to initiate Stripe membership payment:', err);
            setInitError(err?.response?.data?.message || 'Could not connect to payment gateway.');
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingSecret(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, plan, provider, paymentPlan, couponCode, autoRenew]);

  const handlePaypalSubmit = async () => {
    if (!plan || isProcessingPaypal) return;

    setIsProcessingPaypal(true);
    setInitError(null);

    try {
      const returnUrl =
        source === 'dashboard'
          ? `${window.location.origin}/checkout/paypal-return?plan=${encodeURIComponent(plan.id)}&billing=${encodeURIComponent(plan.billingCycle)}&source=dashboard`
          : `${window.location.origin}/checkout/paypal-return?plan=${encodeURIComponent(plan.id)}&billing=${encodeURIComponent(plan.billingCycle)}&onboarding=true`;
      const cancelUrl =
        source === 'dashboard'
          ? `${window.location.origin}/dashboard/memberships`
          : `${window.location.origin}/getstarted/business`;

      const data = await paymentApi.paypalInitiate(
        plan.id,
        plan.selectedTier || 'Standard',
        plan.billingCycle,
        returnUrl,
        cancelUrl,
        false,
        paymentPlan,
        couponCode,
        autoRenew
      );

      if (data?.approvalUrl) {
        // Save pending intent in localStorage
        localStorage.setItem(
          'selectedMembership',
          JSON.stringify({
            tier: plan.id,
            name: plan.name,
            selectedTier: plan.selectedTier || 'Standard',
            billing: plan.billingCycle,
            paymentPlan,
            couponCode,
            price: modalDueToday,
            includedApps: plan.includedApps,
          })
        );
        window.location.href = data.approvalUrl;
      } else {
        throw new Error('PayPal did not return an authorization link.');
      }
    } catch (err: any) {
      console.error('PayPal initiation error:', err);
      setInitError(err?.response?.data?.message || err?.message || 'Could not start PayPal payment.');
      setIsProcessingPaypal(false);
    }
  };

  const handleSuccess = () => {
    setIsPaymentSuccess(true);
    setAppliedCoupon(null);
    queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
    if (source === 'onboarding') {
      localStorage.setItem('onboardingPaymentSuccess', 'true');
    }
    setTimeout(() => {
      onSuccess();
    }, 1200);
  };

  if (!isOpen || !plan) return null;

  const cycleLabel =
    plan.billingCycle === 'yearly' ? 'billed annually' : plan.billingCycle === 'quarterly' ? 'billed quarterly' : 'billed monthly';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full p-4 sm:p-6 relative max-h-[92vh] flex flex-col overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-colors z-10 cursor-pointer text-gray-500"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {isPaymentSuccess ? (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-xs sm:text-sm text-gray-600 max-w-sm">
                Your <span className="font-bold text-gray-900">{plan.name} Membership ({plan.selectedTier || 'Standard'})</span> is now active.
                {source === 'onboarding' ? ' Taking you to your dashboard...' : ' Your subscription has been successfully updated.'}
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs font-bold text-orange-600">
                <RefreshCw className="w-4 h-4 animate-spin" /> {source === 'onboarding' ? 'Setting up your workspace...' : 'Updating dashboard...'}
              </div>
            </div>
          ) : (
            <>
              {/* Header & Plan Summary */}
              <div className="text-center mb-4 sm:mb-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] sm:text-xs font-bold mb-2">
                  <Crown className="w-3.5 h-3.5 text-orange-600" />
                  <span>MCOM Solutions Membership</span>
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight">Complete Membership Payment</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Activate your tier, 90-day success roadmap, and bundled apps
                </p>
              </div>

              {/* Selected Plan Details Card */}
              <div className="bg-orange-50/80 border border-orange-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-orange-600">Selected Tier</span>
                    <h3 className="text-base sm:text-lg font-black text-gray-900">{plan.name} Membership</h3>
                    <p className="text-[11px] sm:text-xs text-gray-600 capitalize">{cycleLabel}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-orange-600 tracking-tight">£{modalDueToday}</span>
                    <span className="block text-[10px] font-semibold text-gray-500">
                      {appliedCoupon?.coupon
                        ? `Coupon saved £${Number(appliedCoupon.discountAmount).toFixed(2)}`
                        : modalSelected.installments > 1
                        ? `${modalSelected.installments} payments · £${modalTotal} total`
                        : plan.billingCycle === 'yearly' ? 'Save 20%' : plan.billingCycle === 'quarterly' ? 'Save 10%' : 'Standard Rate'}
                    </span>
                  </div>
                </div>

                {appliedCoupon?.coupon && (
                  <div className="mt-2.5 pt-2.5 border-t border-orange-200/60 flex items-center justify-between text-[11px] text-orange-950 font-semibold">
                    <span>Subtotal</span>
                    <span className="line-through text-gray-500">
                      £{Number(appliedCoupon.originalAmount).toFixed(2)}
                    </span>
                  </div>
                )}

                {plan.includedApps && plan.includedApps.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-orange-200/60 flex items-center justify-between text-[11px] text-orange-950 font-semibold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-orange-600" /> Bundled Platform Apps:
                    </span>
                    <span className="font-bold text-orange-700">{plan.includedApps.length} Apps Included</span>
                  </div>
                )}
              </div>

              {/* Coupon code */}
              <div className="mb-4 sm:mb-5">
                <div className="text-[11px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Have a coupon?
                </div>
                <CouponCodeField
                  level={plan.id}
                  tier={plan.selectedTier || 'Standard'}
                  billing={plan.billingCycle}
                  paymentPlan={paymentPlan}
                  applied={appliedCoupon}
                  onApplied={setAppliedCoupon}
                  disabled={isPaymentSuccess || autoRenew}
                />
              </div>

              {/* How to pay — partitioned options appear here at payment time only */}
              <div className="mb-4 sm:mb-5">
                <div className="text-[11px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Choose how to pay:
                </div>
                <PaymentPlanSelector
                  tier="Standard"
                  durationDays={modalTier?.durationDays ?? 90}
                  options={displayModalOptions}
                  value={paymentPlan}
                  onChange={setPaymentPlan}
                  disabled={autoRenew}
                />
              </div>

              {/* Auto-renew opt-in (v1: full-term plans only) */}
              <label className="mb-4 sm:mb-5 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-orange-600"
                  checked={autoRenew}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAutoRenew(next);
                    if (next) {
                      setPaymentPlan('full');
                      setAppliedCoupon(null);
                    }
                  }}
                  disabled={isPaymentSuccess}
                />
                <span className="text-xs sm:text-sm text-orange-950">
                  <span className="font-bold">Auto-renew this membership</span>
                  <span className="block text-[11px] sm:text-xs text-orange-800/80 mt-0.5">
                    We will charge the same amount at the end of each term so access never lapses.
                    Cancel anytime from Billing. Coupons and instalments are not available with auto-renew.
                  </span>
                </span>
              </label>

              {/* Payment Method Selector Tabs */}
              <div className="mb-4 sm:mb-5">
                <div className="text-[11px] sm:text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Select Payment Method:
                </div>
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setProvider('stripe')}
                    className={cn(
                      "py-2 sm:py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      provider === 'stripe'
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <CreditCard className="w-4 h-4 text-orange-500" />
                    <span>Card (Stripe)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('paypal')}
                    className={cn(
                      "py-2 sm:py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      provider === 'paypal'
                        ? "bg-white text-[#003087] shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <span className="font-extrabold italic text-sm">P</span>
                    <span>PayPal</span>
                  </button>
                </div>
              </div>

              {/* Provider Content */}
              {initError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs sm:text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{initError}</span>
                </div>
              )}

              {provider === 'stripe' ? (
                <div>
                  {isLoadingSecret ? (
                    <div className="py-12 flex flex-col items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-orange-500 animate-spin mb-2" />
                      <p className="text-xs text-gray-500 font-medium">Connecting to secure Stripe gateway...</p>
                    </div>
                  ) : clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <StripeMembershipForm
                        plan={{ ...plan, totalPerCycle: modalDueToday }}
                        paymentPlan={paymentPlan}
                        couponCode={couponCode}
                        onSuccess={handleSuccess}
                        onCancel={onClose}
                      />
                    </Elements>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-blue-900">
                    <p className="font-semibold mb-1">Pay with PayPal</p>
                    <p className="text-blue-700 text-[11px] sm:text-xs leading-relaxed">
                      You will be redirected to PayPal to complete your payment of <strong>£{modalDueToday}</strong>. After authorization, you will return here automatically to continue with your setup.
                    </p>
                  </div>

                  <div className="flex gap-2 sm:gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isProcessingPaypal}
                      className="flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePaypalSubmit}
                      disabled={isProcessingPaypal}
                      className="flex-1 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#0070BA] hover:bg-[#003087] transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isProcessingPaypal ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Redirecting...
                        </>
                      ) : (
                        `Continue to PayPal (£${modalDueToday})`
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Security Badge */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-gray-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                <span>256-bit SSL encrypted · Powered by Stripe &amp; PayPal</span>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
