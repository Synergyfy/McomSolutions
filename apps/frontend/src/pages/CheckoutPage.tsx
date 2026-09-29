import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
  CreditCard, 
  Lock, 
  ShieldCheck, 
  Check, 
  Loader2, 
  ArrowLeft, 
  Building2, 
  Zap, 
  Star, 
  Trophy, 
  Sparkles,
  HelpCircle,
  Calendar,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePricing } from '../context/PricingContext';
import { useStripeInitiate, useStripeConfirm, usePaypalInitiate } from '../services/payment/hooks';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const ICON_MAP = {
  Bronze: Building2,
  Silver: Zap,
  Gold: Star,
  Platinum: Trophy,
  Elite: Sparkles,
};

const PLAN_DESCRIPTIONS = {
  Bronze: 'Perfect for local brands and new startups.',
  Silver: 'Advanced tools for growing teams.',
  Gold: 'Scale your operations with priority access.',
  Platinum: 'Tailored solutions for market leaders.'
};

const PLAN_PRICES = {
  Bronze: { Normal: 10, Pro: 25, 'Pro+': 50 },
  Silver: { Normal: 75, Pro: 150, 'Pro+': 250 },
  Gold: { Normal: 350, Pro: 600, 'Pro+': 900 },
  Platinum: { Normal: 1200, Pro: 2500, 'Pro+': 4500 }
};

function StripeCardForm({
  planId,
  tier,
  billing,
  isTrial,
  subtotal,
  user,
  onSuccess,
  onError,
}: {
  planId: string;
  tier: string;
  billing: string;
  isTrial: boolean;
  subtotal: number;
  user: any;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { mutateAsync: stripeConfirm } = useStripeConfirm();

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    onError('');

    try {
      const returnUrl = `${window.location.origin}/payment/success?plan=${encodeURIComponent(planId)}&billing=${encodeURIComponent(billing)}`;
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });

      if (submitError) {
        onError(submitError.message || 'Payment confirmation failed. Please check your card and try again.');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        await stripeConfirm({
          level: planId,
          tier,
          billing,
          paymentIntentId: paymentIntent.id,
          isTrial,
        });

        if (user) {
          const updatedUser = {
            ...user,
            businessProfile: {
              ...user.businessProfile,
              membershipLevel: planId,
              membershipTier: tier,
              membershipStatus: isTrial ? 'trial' : 'active',
            },
          };
          localStorage.setItem('business_user', JSON.stringify(updatedUser));
          document.cookie = `packageInfo=${encodeURIComponent(JSON.stringify({ planType: planId }))}; path=/; max-age=604800`;
        }

        onSuccess();
      } else {
        onError('Payment status: ' + (paymentIntent?.status || 'pending') + '. Please try again or contact support.');
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Stripe payment confirmation error:', err);
      onError(err?.response?.data?.message || err?.message || 'Payment processing failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-4 sm:space-y-5">
      <PaymentElement />
      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full py-3.5 sm:py-4 bg-brand-blue text-white rounded-xl sm:rounded-2xl text-base sm:text-lg font-black hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Processing Payment...
            </>
          ) : isTrial ? (
            'Start 14-Day Free Trial'
          ) : (
            `Pay £${subtotal.toLocaleString()} Now`
          )}
        </button>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { mutateAsync: stripeInitiate } = useStripeInitiate();
  const { mutateAsync: paypalInitiate } = usePaypalInitiate();

  const planId = (searchParams.get('plan') || 'Bronze') as 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  const initialTierParam = searchParams.get('tier') || 'Standard';
  const [selectedTier, setSelectedTier] = useState<'Standard' | 'Pro' | 'Pro+'>(() => {
    if (initialTierParam.toLowerCase() === 'pro+') return 'Pro+';
    if (initialTierParam.toLowerCase() === 'pro') return 'Pro';
    return 'Standard';
  });
  const tier = selectedTier;
  const billing = searchParams.get('billing') || (selectedTier === 'Pro+' ? 'yearly' : 'monthly');
  const isTrial = searchParams.get('isTrial') === 'true';

  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stripe client secret
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);

  // Auth check
  const token = localStorage.getItem('auth_token');
  const userRaw = localStorage.getItem('business_user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  const { plans } = usePricing();
  const currentPlan = plans.find(
    (p) => p.name.toLowerCase() === planId.toLowerCase() || p.id.toLowerCase() === planId.toLowerCase()
  );

  // Calculate pricing details dynamically
  const basePrice = useMemo(() => {
    if (currentPlan?.tierPrices) {
      const tp = currentPlan.tierPrices as any;
      const direct = tp[selectedTier] ?? (selectedTier === 'Standard' ? tp.Normal : undefined);
      if (direct != null && typeof direct === 'number') return direct;
    }
    const prices = PLAN_PRICES[planId as keyof typeof PLAN_PRICES] || PLAN_PRICES.Bronze;
    const legacyKey = selectedTier === 'Standard' ? 'Normal' : selectedTier;
    return prices[legacyKey as keyof typeof prices] || prices.Normal;
  }, [currentPlan, selectedTier, planId]);

  const discount = (billing === 'yearly' || selectedTier === 'Pro+') ? 0.2 : 0;
  const finalMonthlyPrice = Math.floor(basePrice * (1 - discount));
  const subtotal = (billing === 'yearly' || selectedTier === 'Pro+') ? (basePrice > 300 ? basePrice : finalMonthlyPrice * 12) : basePrice;
  const total = isTrial ? 0 : subtotal;

  useEffect(() => {
    if (!token || paymentProvider !== 'stripe') return;

    let isMounted = true;
    setLoadingSecret(true);
    setErrorMessage(null);

    stripeInitiate({ level: planId, tier, billing, isTrial })
      .then((data) => {
        if (isMounted && data?.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to initialize Stripe:', err);
          setErrorMessage(err?.response?.data?.message || 'Could not connect to payment gateway.');
        }
      })
      .finally(() => {
        if (isMounted) setLoadingSecret(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, paymentProvider, planId, tier, billing, isTrial]);

  const handlePaypalPayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const origin = window.location.origin;
      const returnUrl = `${origin}/checkout/paypal-return?plan=${encodeURIComponent(planId)}&tier=${encodeURIComponent(tier)}&billing=${encodeURIComponent(billing)}&isTrial=${isTrial}`;
      const cancelUrl = `${origin}/checkout?plan=${encodeURIComponent(planId)}&tier=${encodeURIComponent(tier)}&billing=${encodeURIComponent(billing)}&isTrial=${isTrial}`;

      const initiated = await paypalInitiate({ level: planId, tier, billing, returnUrl, cancelUrl, isTrial });

      if (initiated?.approvalUrl) {
        window.location.href = initiated.approvalUrl;
      } else {
        throw new Error('PayPal did not return an approval URL.');
      }
    } catch (err: any) {
      console.error('PayPal initiation error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'PayPal transaction failed. Please try again.');
      setIsProcessing(false);
    }
  };

  if (!token) {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  const PlanIcon = ICON_MAP[planId] || Building2;

  return (
    <div className="pt-32 pb-24 bg-gray-50 min-h-screen font-sans">
      {isSuccess && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-scale-up shadow-lg">
            <Check className="w-12 h-12 text-green-600 stroke-[3]" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Subscription Confirmed!</h2>
          <p className="text-gray-500 font-semibold text-lg">Your master business profile has been updated to {planId} {tier}.</p>
          <div className="mt-8 flex items-center gap-3 text-brand-blue font-bold text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Redirecting to Dashboard...
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Link to="/pricing" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-blue transition-colors font-bold text-sm mb-6 sm:mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to plans
        </Link>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-6 sm:mb-8 tracking-tight">Complete Checkout</h1>

        {errorMessage && (
          <div className="mb-6 sm:mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Order Summary */}
          <div className="w-full order-1 lg:order-2 lg:col-span-5 bg-white border border-gray-100 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Order Summary</h2>

            <div className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50 mb-6 sm:mb-8">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue shrink-0">
                <PlanIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-gray-900 text-base sm:text-lg">{planId} Plan</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-blue text-white">
                    {tier}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-medium truncate">
                  {PLAN_DESCRIPTIONS[planId] || 'Ecosystem access'}
                </p>
              </div>
            </div>

            {/* Pricing details */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-gray-500 font-medium">
                <span>Billing Frequency</span>
                <span className="font-bold text-gray-900 capitalize">{billing}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500 font-medium">
                <span>Base Price</span>
                <span className="font-bold text-gray-900">£{basePrice}/mo</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-green-600 font-bold">
                  <span>Yearly Discount (20%)</span>
                  <span>-£{(basePrice - finalMonthlyPrice) * 12}/yr</span>
                </div>
              )}
              {isTrial && (
                <div className="flex justify-between items-center text-brand-blue font-bold">
                  <span>14-Day Free Trial</span>
                  <span>100% OFF</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 sm:pt-4 flex justify-between items-baseline">
                <span className="font-bold text-gray-900 text-sm sm:text-base">Total Due Today</span>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-gray-900">£{total.toLocaleString()}</span>
                  {billing === 'yearly' && !isTrial && (
                    <span className="block text-[10px] sm:text-xs text-gray-400 font-semibold">billed annually</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center gap-2 sm:gap-3 text-xs text-gray-500 font-medium">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 shrink-0" />
              <span>SSL Encrypted &amp; Securing transactions via Stripe &amp; PayPal</span>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="w-full order-2 lg:order-1 lg:col-span-7 bg-white border border-gray-100 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">1. Select Payment Method</h2>
            
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                type="button"
                onClick={() => setPaymentProvider('stripe')}
                className={`p-3.5 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 sm:gap-3 font-semibold transition-all cursor-pointer ${
                  paymentProvider === 'stripe' 
                    ? 'border-brand-blue bg-blue-50/50 text-brand-blue shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs sm:text-sm">Credit Card (Stripe)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentProvider('paypal')}
                className={`p-3.5 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 sm:gap-3 font-semibold transition-all cursor-pointer ${
                  paymentProvider === 'paypal' 
                    ? 'border-brand-blue bg-blue-50/50 text-brand-blue shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                <span className="text-base sm:text-lg font-black italic text-blue-900">Pay<span className="text-blue-500">Pal</span></span>
                <span className="text-xs sm:text-sm">PayPal Account</span>
              </button>
            </div>

            {paymentProvider === 'stripe' ? (
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3">2. Card Information</h3>
                {loadingSecret ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <RefreshCw className="w-7 h-7 text-brand-blue animate-spin mb-3" />
                    <p className="text-sm text-gray-500 font-medium">Connecting to secure Stripe gateway...</p>
                  </div>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeCardForm
                      planId={planId}
                      tier={tier}
                      billing={billing}
                      isTrial={isTrial}
                      subtotal={subtotal}
                      user={user}
                      onSuccess={() => {
                        setIsSuccess(true);
                        setTimeout(() => navigate('/dashboard'), 2500);
                      }}
                      onError={(msg) => setErrorMessage(msg)}
                    />
                  </Elements>
                ) : null}
              </div>
            ) : (
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3">2. PayPal Authorization</h3>
                <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-blue-100 bg-blue-50/30 text-center mb-6">
                  <span className="inline-block text-2xl sm:text-3xl font-black italic text-blue-900 mb-2 sm:mb-3">Pay<span className="text-blue-500">Pal</span></span>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium mb-6">
                    Clicking below will securely redirect you to PayPal to authorize the subscription of <strong>£{subtotal.toLocaleString()}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handlePaypalPayment}
                    disabled={isProcessing}
                    className="w-full py-4 bg-[#0070BA] hover:bg-[#003087] text-white rounded-xl sm:rounded-2xl font-black text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Redirecting to PayPal...
                      </>
                    ) : (
                      `Continue to PayPal (£${subtotal.toLocaleString()})`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
