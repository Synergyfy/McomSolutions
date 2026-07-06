import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, ArrowRight, ChevronLeft, Sparkles, Crown,
  Star, Zap, Shield, Building2, Trophy, CreditCard, Check,
  PartyPopper, LayoutDashboard
} from 'lucide-react';
import { usePricing, ICON_MAP, SubTier, Membership } from '../../context/PricingContext';

const QUARTERLY_DISCOUNT = 0.1;
const YEARLY_DISCOUNT = 0.2;

interface PostRegistrationFlowProps {
  businessName: string;
  businessEmail: string;
  onComplete: () => void;
  onBack?: () => void;
}

export default function PostRegistrationFlow({
  businessName,
  businessEmail,
  onComplete,
  onBack,
}: PostRegistrationFlowProps) {
  const navigate = useNavigate();
  const { plans } = usePricing();

  const [step, setStep] = useState<'account-created' | 'welcome' | 'membership' | 'payment' | 'activated'>('account-created');
  const [selectedTier, setSelectedTier] = useState<Membership>('Bronze');
  const [selectedSubTier, setSelectedSubTier] = useState<SubTier>('Normal');
  const [billingCycle, setBillingCycle] = useState<'quarterly' | 'yearly'>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank' | ''>('');

  const selectedPlan = plans.find(p => p.id === selectedTier)!;
  const baseMonthly = selectedPlan.price[selectedSubTier];
  const discount = billingCycle === 'yearly' ? YEARLY_DISCOUNT : QUARTERLY_DISCOUNT;
  const perMonthDiscounted = Math.floor(baseMonthly * (1 - discount));
  const totalPerCycle = billingCycle === 'yearly' ? perMonthDiscounted * 12 : perMonthDiscounted * 3;

  const subTierLabel = selectedSubTier === 'Normal' ? 'Standard' : selectedSubTier === 'Pro' ? 'Pro' : 'Pro+';

  // ═══════════════════════════════════════════════════════════
  // SCREEN 6 – Create Your MCOM Account
  // ═══════════════════════════════════════════════════════════
  if (step === 'account-created') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          className="mb-8"
        >
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-2xl shadow-orange-400/40">
            <CheckCircle2 className="w-14 h-14 text-white" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-5xl font-black text-gray-900 mb-4 text-center tracking-tight"
        >
          Congratulations!
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-lg text-gray-500 mb-2 text-center max-w-md"
        >
          Your MCOM Business Account has been created.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-orange-50 rounded-2xl p-6 max-w-sm w-full mb-8 border border-orange-100"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Business</span>
              <span className="font-bold text-gray-900">{businessName || 'Your Business'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Email</span>
              <span className="font-bold text-gray-900">{businessEmail}</span>
            </div>
            <div className="h-px bg-orange-200" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">MCOM ID</span>
              <span className="font-bold text-orange-600">Generated</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">Referral Code</span>
              <span className="font-bold text-orange-600">Generated</span>
            </div>
          </div>
        </motion.div>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setStep('welcome')}
          className="px-10 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all shadow-xl shadow-orange-500/25 flex items-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SCREEN 7 – Welcome to the Business Success Programme
  // ═══════════════════════════════════════════════════════════
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          className="mb-8"
        >
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-400/40">
            <Sparkles className="w-14 h-14 text-white" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl md:text-4xl font-black text-gray-900 mb-4 text-center tracking-tight"
        >
          Welcome to Your<br />Business Success Programme
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-base text-gray-500 mb-6 text-center max-w-lg"
        >
          Over the next 90 days, MCOM will help you:
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-lg w-full space-y-3 mb-8"
        >
          {[
            'Build your digital business profile',
            'Strengthen your brand',
            'Increase customer loyalty',
            'Expand your business network',
            'Improve your online presence',
            'Prepare for a professional Business Audit',
            'Receive personalised recommendations for growth',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-3 border border-orange-100">
              <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />
              <span className="text-sm font-medium text-gray-700">{item}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-amber-50 rounded-2xl p-5 max-w-lg w-full mb-8 border border-amber-200"
        >
          <p className="text-sm text-amber-800 font-medium text-center leading-relaxed">
            Most businesses complete the programme within 90 days. Some complete it in as little as 2 weeks. You can progress at your own pace. Your dashboard will guide you every step of the way.
          </p>
        </motion.div>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setStep('membership')}
          className="px-10 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all shadow-xl shadow-orange-500/25 flex items-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SCREEN 8 – Choose Your Membership
  // ═══════════════════════════════════════════════════════════
  if (step === 'membership') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 text-sm font-semibold mb-4">
                <Crown className="w-4 h-4" />
                Choose Your Membership
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Select Your <span className="text-orange-600">Growth Plan</span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 font-medium">
                Your membership includes access to the Business Success Programme and all included platform tools.
              </p>
            </motion.div>

            {/* Sub-tier selector */}
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="flex p-1 bg-gray-100 rounded-full">
                {(['quarterly', 'yearly'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={`px-6 md:px-8 py-3 rounded-full text-sm font-semibold transition-all ${
                      billingCycle === cycle ? 'bg-white text-orange-600 shadow-lg' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                    {cycle === 'quarterly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 10%</span>}
                    {cycle === 'yearly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 20%</span>}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 p-1.5 bg-orange-50 rounded-2xl border border-orange-100">
                {(['Normal', 'Pro', 'Pro+'] as SubTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedSubTier(tier)}
                    className={`px-4 md:px-6 py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center min-w-[90px] md:min-w-[120px] ${
                      selectedSubTier === tier
                        ? 'bg-orange-500 text-white shadow-lg'
                        : 'text-orange-600/60 hover:text-orange-600 hover:bg-orange-100'
                    }`}
                  >
                    {tier === 'Normal' ? 'Standard' : tier}
                    <span className="text-[10px] opacity-80 font-normal">
                      {tier === 'Normal' && 'Basic Access'}
                      {tier === 'Pro' && 'More Growth'}
                      {tier === 'Pro+' && 'Max Visibility'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Membership Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            {plans.map((plan, index) => {
              const isGold = plan.id === 'Gold';
              const baseMonthly = plan.price[selectedSubTier];
              const discount = billingCycle === 'yearly' ? YEARLY_DISCOUNT : QUARTERLY_DISCOUNT;
              const perMonthDiscounted = Math.floor(baseMonthly * (1 - discount));
              const totalPerCycle = billingCycle === 'yearly' ? perMonthDiscounted * 12 : perMonthDiscounted * 3;
              const PlanIcon = ICON_MAP[plan.iconName as keyof typeof ICON_MAP];
              const isSelected = selectedTier === plan.id;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={`relative p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] flex flex-col transition-all duration-500 cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500 text-white shadow-2xl shadow-orange-500/40 scale-[1.02] md:scale-105 z-10 ring-2 ring-orange-300'
                      : 'bg-white border border-gray-100 hover:border-orange-200 hover:shadow-xl'
                  }`}
                  onClick={() => setSelectedTier(plan.id)}
                >
                  {isGold && !isSelected && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 font-bold px-3 md:px-4 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg whitespace-nowrap">
                      <Star className="w-3 h-3 fill-current" /> MOST POPULAR
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-orange-600 font-bold px-3 md:px-4 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg whitespace-nowrap">
                      <Check className="w-3 h-3" /> SELECTED
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center p-2.5 md:p-3 shadow-sm ${
                      isSelected ? 'bg-white/20' : plan.color
                    }`}>
                      <PlanIcon className="w-full h-full" />
                    </div>
                    <div className={`text-xs font-semibold uppercase tracking-widest ${
                      isSelected ? 'text-orange-100' : 'text-gray-400'
                    }`}>
                      {plan.name}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl md:text-4xl font-bold">£{perMonthDiscounted}</span>
                      <span className={`text-sm ${isSelected ? 'text-orange-200' : 'text-gray-400'}`}>/mo</span>
                    </div>
                    <div className={`text-xs font-bold mt-1 ${isSelected ? 'text-green-300' : 'text-green-500'}`}>
                      £{totalPerCycle}/{billingCycle === 'yearly' ? 'yr' : 'qtr'}
                    </div>
                  </div>

                  <p className={`mb-6 md:mb-8 text-sm font-medium leading-relaxed ${
                    isSelected ? 'text-orange-50' : 'text-gray-500'
                  }`}>
                    {plan.description}
                  </p>

                  <div className={`h-px w-full mb-6 md:mb-8 ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`} />

                  <div className="space-y-3 md:space-y-4 mb-8 md:mb-10 flex-1">
                    <div className={`text-xs font-bold uppercase tracking-widest ${
                      isSelected ? 'text-orange-200/60' : 'text-gray-400'
                    }`}>Features</div>
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Check className={`w-4 h-4 shrink-0 ${isSelected ? 'text-orange-300' : 'text-orange-500'}`} />
                        <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>{f}</span>
                      </div>
                    ))}

                    <div className={`h-px w-8 my-3 md:my-4 ${isSelected ? 'bg-white/10' : 'bg-gray-100'}`} />

                    <div className={`text-xs font-bold uppercase tracking-widest ${
                      isSelected ? 'text-orange-200/60' : 'text-gray-400'
                    }`}>{subTierLabel} Access</div>
                    {(plan.tierFeatures?.[selectedSubTier] || []).map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Zap className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-300' : 'text-amber-500'}`} />
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>{f}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Confirm & Continue */}
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setStep('payment')}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-black text-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/25 active:scale-95 flex items-center justify-center gap-2"
            >
              Continue with {selectedTier} {subTierLabel}
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center text-xs text-gray-400 mt-3 font-medium">
              Annual billing • Includes 90-Day Business Success Programme
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SCREEN 9 – Payment
  // ═══════════════════════════════════════════════════════════
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <button
                onClick={() => setStep('membership')}
                className="flex items-center gap-1.5 text-sm font-bold text-orange-600 hover:text-orange-700 mb-6"
              >
                <ChevronLeft className="w-5 h-5" /> Back
              </button>
              <h1 className="text-3xl font-black text-gray-900 mb-2">Complete Payment</h1>
              <p className="text-gray-500 font-medium">Secure your membership to unlock everything.</p>
            </div>

            {/* Membership Summary Card */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Membership Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Plan</span>
                  <span className="font-bold text-gray-900">{selectedTier} {subTierLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Billing</span>
                  <span className="font-bold text-gray-900">{billingCycle === 'yearly' ? 'Annual' : 'Quarterly'}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Monthly Price</span>
                  <span className="font-bold text-gray-900">£{perMonthDiscounted}/mo</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Total Due Today</span>
                  <span className="text-xl font-black text-orange-600">£{totalPerCycle}</span>
                </div>
                {discount > 0 && (
                  <div className="bg-green-50 rounded-xl px-4 py-2 border border-green-100">
                    <span className="text-sm font-bold text-green-600">
                      You save {Math.round(discount * 100)}% with {billingCycle} billing
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h2>
              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'card' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'card' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Card Payment</div>
                    <div className="text-sm text-gray-500">Debit or credit card</div>
                  </div>
                  {paymentMethod === 'card' && <Check className="w-5 h-5 text-orange-500 ml-auto" />}
                </button>

                <button
                  onClick={() => setPaymentMethod('bank')}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === 'bank' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'bank' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Bank Transfer</div>
                    <div className="text-sm text-gray-500">Pay by bank transfer</div>
                  </div>
                  {paymentMethod === 'bank' && <Check className="w-5 h-5 text-orange-500 ml-auto" />}
                </button>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={() => {
                if (!paymentMethod) return;
                setStep('activated');
              }}
              disabled={!paymentMethod}
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                paymentMethod
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Pay £{totalPerCycle} Now
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-center text-xs text-gray-400 mt-4 font-medium">
              Secure payment • Your membership activates immediately
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SCREEN 10 – Membership Activated
  // ═══════════════════════════════════════════════════════════
  if (step === 'activated') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 12 }}
          className="mb-8"
        >
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-2xl shadow-orange-400/40">
            <PartyPopper className="w-16 h-16 text-white" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-5xl font-black text-gray-900 mb-4 text-center tracking-tight"
        >
          Membership Activated!
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-lg text-gray-500 mb-6 text-center max-w-md"
        >
          Your <span className="font-bold text-orange-600">{selectedTier} {subTierLabel}</span> membership is now active.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-orange-50 rounded-2xl p-6 max-w-sm w-full mb-8 border border-orange-100"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm font-medium text-gray-700">MCOM Central access</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm font-medium text-gray-700">Your Business Dashboard</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm font-medium text-gray-700">90-Day Business Success Programme</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm font-medium text-gray-700">Included platform access based on your membership</span>
            </div>
          </div>
        </motion.div>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onComplete}
          className="px-10 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all shadow-xl shadow-orange-500/25 flex items-center gap-2"
        >
          Go to My Dashboard
          <LayoutDashboard className="w-5 h-5" />
        </motion.button>
      </div>
    );
  }

  return null;
}
