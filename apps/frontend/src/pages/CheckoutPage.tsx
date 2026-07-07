import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Navigate, Link } from 'react-router-dom';
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
  HelpCircle
} from 'lucide-react';
import { businessApi } from '../lib/api';

const ICON_MAP = {
  Bronze: Building2,
  Silver: Zap,
  Gold: Star,
  Platinum: Trophy
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

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const planId = (searchParams.get('plan') || 'Bronze') as 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  const tier = (searchParams.get('tier') || 'Normal') as 'Normal' | 'Pro' | 'Pro+';
  const billing = searchParams.get('billing') || 'monthly';
  const isTrial = searchParams.get('isTrial') === 'true';

  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Form fields
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth check
  const token = localStorage.getItem('auth_token');
  const userRaw = localStorage.getItem('business_user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  // Calculate pricing details
  const basePrice = useMemo(() => {
    const prices = PLAN_PRICES[planId] || PLAN_PRICES.Bronze;
    return prices[tier] || prices.Normal;
  }, [planId, tier]);

  const discount = billing === 'yearly' ? 0.2 : 0;
  const finalMonthlyPrice = Math.floor(basePrice * (1 - discount));
  const subtotal = billing === 'yearly' ? finalMonthlyPrice * 12 : basePrice;
  const total = isTrial ? 0 : subtotal;

  // Formatting card number inputs
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    setCardNumber(formatted.substring(0, 19));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\//g, '').replace(/[^0-9]/gi, '');
    let formatted = value;
    if (value.length > 2) {
      formatted = `${value.substring(0, 2)}/${value.substring(2, 4)}`;
    }
    setCardExpiry(formatted.substring(0, 5));
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/gi, '');
    setCardCvc(value.substring(0, 4));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (paymentProvider === 'stripe') {
      if (!cardName.trim()) errors.cardName = 'Name on card is required';
      if (cardNumber.replace(/\s/g, '').length < 16) errors.cardNumber = 'Card number must be 16 digits';
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) errors.cardExpiry = 'Expiry date must be MM/YY';
      if (cardCvc.length < 3) errors.cardCvc = 'CVC must be 3 or 4 digits';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (paymentProvider === 'stripe') {
        // Step 1: Ask backend to create a Stripe PaymentIntent or SetupIntent
        const initiated = await businessApi.stripeInitiate(planId, tier, billing, isTrial);

        // Step 2: Confirm with the backend (for now without Stripe.js — direct confirm)
        // In production, you'd call stripe.confirmPayment() here with the clientSecret
        // For now we use the backend confirm endpoint which verifies intent status
        const confirmed = await businessApi.stripeConfirm(
          planId,
          tier,
          billing,
          initiated.clientSecret, // pass as paymentIntentId reference
          isTrial,
        );

        if (user) {
          const updatedUser = { ...user, businessProfile: { ...user.businessProfile, membershipLevel: planId, membershipTier: tier, membershipStatus: isTrial ? 'trial' : 'active' } };
          localStorage.setItem('business_user', JSON.stringify(updatedUser));
          document.cookie = `packageInfo=${encodeURIComponent(JSON.stringify({ planType: planId }))}; path=/; max-age=604800`;
        }

        setIsSuccess(true);
        setTimeout(() => navigate('/dashboard'), 2500);

      } else {
        // PayPal flow: initiate order and redirect to PayPal for approval
        const origin = window.location.origin;
        const returnUrl = `${origin}/checkout/paypal-return?plan=${encodeURIComponent(planId)}&tier=${encodeURIComponent(tier)}&billing=${billing}&isTrial=${isTrial}`;
        const cancelUrl = `${origin}/checkout?plan=${encodeURIComponent(planId)}&tier=${encodeURIComponent(tier)}&billing=${billing}&isTrial=${isTrial}`;

        const initiated = await businessApi.paypalInitiate(planId, tier, billing, returnUrl, cancelUrl, isTrial);

        if (initiated.approvalUrl) {
          window.location.href = initiated.approvalUrl;
        } else {
          throw new Error('PayPal did not return an approval URL.');
        }
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Transaction failed. Please try again.');
    } finally {
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

      <div className="max-w-6xl mx-auto px-6">
        <Link to="/pricing" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-blue transition-colors font-bold text-sm mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to plans
        </Link>

        <h1 className="text-4xl font-black text-gray-900 mb-8 tracking-tight">Complete Checkout</h1>

        {errorMessage && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm font-semibold flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            {errorMessage}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* Checkout Form */}
          <div className="lg:col-span-7 bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">1. Select Payment Method</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={() => setPaymentProvider('stripe')}
                className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 font-semibold transition-all ${
                  paymentProvider === 'stripe' 
                    ? 'border-brand-blue bg-blue-50/50 text-brand-blue shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-sm">Credit Card</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentProvider('paypal')}
                className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 font-semibold transition-all ${
                  paymentProvider === 'paypal' 
                    ? 'border-brand-blue bg-blue-50/50 text-brand-blue shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                <span className="text-lg font-black italic text-blue-900">Pay<span className="text-blue-500">Pal</span></span>
                <span className="text-sm">PayPal Account</span>
              </button>
            </div>

            <form onSubmit={handlePayment}>
              {paymentProvider === 'stripe' ? (
                <div className="space-y-5">
                  <h3 className="text-base font-bold text-gray-900 mb-2">2. Enter Card Information</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Name on Card</label>
                    <input
                      type="text"
                      className={`w-full px-5 py-4 border rounded-xl bg-gray-50 font-semibold focus:bg-white transition-all outline-none ${formErrors.cardName ? 'border-red-500' : 'border-gray-200 focus:border-brand-blue'}`}
                      placeholder="Jane Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                    />
                    {formErrors.cardName && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.cardName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        className={`w-full pl-12 pr-5 py-4 border rounded-xl bg-gray-50 font-semibold focus:bg-white transition-all outline-none ${formErrors.cardNumber ? 'border-red-500' : 'border-gray-200 focus:border-brand-blue'}`}
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                      />
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                    {formErrors.cardNumber && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.cardNumber}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Expiration Date</label>
                      <input
                        type="text"
                        className={`w-full px-5 py-4 border rounded-xl bg-gray-50 font-semibold focus:bg-white transition-all outline-none ${formErrors.cardExpiry ? 'border-red-500' : 'border-gray-200 focus:border-brand-blue'}`}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                      />
                      {formErrors.cardExpiry && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.cardExpiry}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Security Code (CVC)</label>
                      <input
                        type="password"
                        className={`w-full px-5 py-4 border rounded-xl bg-gray-50 font-semibold focus:bg-white transition-all outline-none ${formErrors.cardCvc ? 'border-red-500' : 'border-gray-200 focus:border-brand-blue'}`}
                        placeholder="123"
                        value={cardCvc}
                        onChange={handleCvcChange}
                      />
                      {formErrors.cardCvc && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.cardCvc}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-3xl border border-blue-100 bg-blue-50/20 text-center mb-6">
                  <span className="inline-block text-3xl font-black italic text-blue-900 mb-3">Pay<span className="text-blue-500">Pal</span></span>
                  <p className="text-sm text-gray-600 font-medium mb-6">Clicking confirm will securely verify your PayPal checkout credentials for the subscription.</p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-5 bg-brand-blue text-white rounded-2xl text-lg font-black hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Processing Payment...
                    </>
                  ) : isTrial ? (
                    `Start 7-Day Free Trial`
                  ) : (
                    `Pay £${subtotal.toLocaleString()}`
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-50">
                <div className="w-12 h-12 rounded-xl bg-brand-blue/5 flex items-center justify-center text-brand-blue shadow-sm">
                  <PlanIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{planId} Member</h3>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{tier} tier • {billing} Billing</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm font-semibold text-gray-500">
                  <span>Base Subscription</span>
                  <span>£{basePrice.toLocaleString()} / mo</span>
                </div>
                {billing === 'yearly' && (
                  <div className="flex justify-between text-sm font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                    <span>Yearly discount (20%)</span>
                    <span>-£{Math.floor(basePrice * 0.2).toLocaleString()} / mo</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold text-gray-500 pt-2 border-t border-gray-50">
                  <span>Subtotal</span>
                  <span>£{finalMonthlyPrice.toLocaleString()} / mo</span>
                </div>
                {isTrial && (
                  <div className="flex justify-between text-sm font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                    <span>Trial Mode Discount</span>
                    <span>-£{subtotal.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-between items-baseline mb-6">
                <span className="font-black text-gray-900 text-lg">Total Due Today</span>
                <span className="text-3xl font-black text-gray-900">£{total.toLocaleString()}</span>
              </div>

              {isTrial && (
                <div className="p-4 bg-blue-50/50 rounded-2xl text-xs text-blue-800 font-semibold border border-blue-100 leading-relaxed mb-6">
                  <Sparkles className="w-4 h-4 text-brand-blue inline mr-1" />
                  <strong>7-Day Free Trial:</strong> Your payment method will be validated today, but not charged. After 7 days, you will be billed £{subtotal.toLocaleString()} for the {billing} cycle unless canceled.
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                <Lock className="w-4 h-4 text-green-500" />
                <span>SSL Encrypted & Securing transactions via Stripe & PayPal</span>
              </div>
            </div>

            {/* Platform Access Guarantee */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-start gap-4">
              <ShieldCheck className="w-8 h-8 text-green-500 shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-gray-900 mb-1">MCOM Unified Access</h4>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Your purchase instantly grants you appropriate permission settings across all MCOM systems, including MCOM Mall, MCOM Rewards, Spin, Audit, and Q-Links.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
