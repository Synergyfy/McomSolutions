import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Crown,
  CheckCircle2,
  Star,
  Zap,
  Shield,
  CalendarDays,
  Clock,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Check,
  Sparkles,
  Layers,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info,
  BadgeCheck,
} from 'lucide-react';
import { useProfile } from '../services/business/hooks';
import { useTransactions } from '../services/pricing/hooks';
import { usePricing, PricingPlan } from '../context/PricingContext';
import MembershipPaymentModal, { MembershipPaymentPlan } from './payment/MembershipPaymentModal';
import { cn } from '../lib/utils';

const PLAN_THEME: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; badgeBg: string; border: string; highlight: string }> = {
  Bronze: {
    icon: Star,
    color: 'from-amber-600 to-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    border: 'border-amber-200 hover:border-amber-400',
    highlight: 'text-amber-600',
  },
  Silver: {
    icon: Zap,
    color: 'from-slate-600 to-slate-700',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
    border: 'border-slate-200 hover:border-slate-400',
    highlight: 'text-slate-600',
  },
  Gold: {
    icon: Crown,
    color: 'from-orange-500 to-orange-600',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200',
    border: 'border-orange-300 hover:border-orange-500',
    highlight: 'text-orange-600',
  },
  Platinum: {
    icon: Shield,
    color: 'from-purple-600 to-indigo-700',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    border: 'border-purple-200 hover:border-purple-400',
    highlight: 'text-purple-600',
  },
};

const DEFAULT_THEME = {
  icon: Sparkles,
  color: 'from-brand-blue to-blue-600',
  badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
  border: 'border-blue-200 hover:border-brand-blue',
  highlight: 'text-brand-blue',
};

export const TIER_CONFIGS: Record<
  'Standard' | 'Pro' | 'Pro+',
  { label: string; days: number; term: string; tagline: string; savings?: string }
> = {
  Standard: {
    label: 'Standard',
    days: 90,
    term: '90 Days (3 Months)',
    tagline: '90-Day Success Programme',
  },
  Pro: {
    label: 'Pro',
    days: 180,
    term: '180 Days (6 Months)',
    tagline: 'Scaling & Growth Programme',
    savings: 'Save 15%',
  },
  'Pro+': {
    label: 'Pro+',
    days: 365,
    term: '365 Days (1 Year)',
    tagline: 'Annual Full Access',
    savings: 'Best Value · Save 20%',
  },
};

export default function DashboardMemberships() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { plans = [], loading: plansLoading } = usePricing();

  const loading = profileLoading || txLoading || plansLoading;

  // Global duration tier filter ('Standard' | 'Pro' | 'Pro+')
  const [selectedTier, setSelectedTier] = useState<'Standard' | 'Pro' | 'Pro+'>('Standard');

  // Per-plan expanded features toggle on mobile
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>({});

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<MembershipPaymentPlan | null>(null);

  // Success Notification
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const toggleFeaturesExpand = (planId: string) => {
    setExpandedFeatures((prev) => ({ ...prev, [planId]: !prev[planId] }));
  };

  const openPaymentForPlan = (plan: PricingPlan, chosenTier?: 'Standard' | 'Pro' | 'Pro+') => {
    const tier = chosenTier || selectedTier;
    const tierConfig = plan.tiers?.find((t) => t.tier === tier);

    // Calculate price for this tier
    let tierPrice = 0;
    if (tierConfig && tierConfig.fullPrice > 0) {
      tierPrice = tierConfig.fullPrice;
    } else if (plan.tierPrices && plan.tierPrices[tier] != null) {
      tierPrice = Number(plan.tierPrices[tier]);
    } else if (tier === 'Pro+') {
      tierPrice = plan.annualPrice || Math.round((plan.monthlyPrice || plan.price || 0) * 12 * 0.8);
    } else if (tier === 'Pro') {
      tierPrice = Math.round((plan.monthlyPrice || plan.price || 0) * 6 * 0.85);
    } else {
      tierPrice = plan.monthlyPrice || plan.price || 0;
    }

    const billingCycle: 'monthly' | 'quarterly' | 'yearly' =
      tier === 'Pro+' ? 'yearly' : tier === 'Pro' ? 'quarterly' : 'monthly';

    const paymentPlanPayload: MembershipPaymentPlan = {
      id: plan.planId || plan.id || plan.name,
      name: plan.name,
      price: tierPrice,
      billingCycle,
      totalPerCycle: tierPrice,
      description: plan.description,
      includedApps: plan.includedApps?.map((app) => ({
        platform: app.platform,
        planName: app.planName,
        standalonePrice: app.standalonePrice,
      })),
      selectedTier: tier,
    };

    setSelectedPlanForPayment(paymentPlanPayload);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['plans'] });
    setSuccessBanner('Payment successful! Your membership tier and platform permissions have been updated.');
    setTimeout(() => setSuccessBanner(null), 8000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-semibold text-sm">Loading membership info...</p>
      </div>
    );
  }

  const currentLevelName = profile?.membershipLevel;
  const isMembershipActive =
    Boolean(currentLevelName) &&
    profile?.membershipStatus === 'active' &&
    (!profile?.membershipExpiresAt || new Date(profile.membershipExpiresAt) > new Date());

  const activePlanObject = plans.find(
    (p) => p.name?.toLowerCase() === (currentLevelName || '').toLowerCase() || p.id === currentLevelName
  );

  const activeTheme = currentLevelName ? (PLAN_THEME[currentLevelName] || DEFAULT_THEME) : DEFAULT_THEME;
  const ActiveIcon = activeTheme.icon;

  const renewalDate = profile?.membershipExpiresAt
    ? new Date(profile.membershipExpiresAt)
    : profile?.createdAt
    ? new Date(new Date(profile.createdAt).setMonth(new Date(profile.createdAt).getMonth() + 1))
    : null;

  const renewalDateStr = renewalDate
    ? renewalDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Active';

  return (
    <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16 px-1 sm:px-4">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-extrabold uppercase tracking-wide">
            Central Ecosystem
          </span>
          <span className="text-xs text-gray-400 font-medium">· Dashboard</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
          Memberships &amp; Plans
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-3xl">
          Choose and pay for your membership tier configured by the ecosystem administrator. Select your programme duration below to see instant pricing and installment splits.
        </p>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {successBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-900 font-semibold text-xs sm:text-sm shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <span className="flex-1">{successBanner}</span>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-green-700 hover:text-green-900 text-xs font-bold px-2 py-1 cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Status Hero Banner */}
      <div
        className={cn(
          "rounded-3xl p-5 sm:p-8 md:p-10 text-white relative overflow-hidden shadow-xl transition-all",
          isMembershipActive
            ? `bg-gradient-to-br ${activeTheme.color}`
            : "bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800"
        )}
      >
        <div className="absolute -right-12 -top-12 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-8 bottom-0 w-44 h-44 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
            <div className="w-14 h-14 sm:w-18 sm:h-18 bg-white/20 rounded-2xl sm:rounded-3xl flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0">
              <ActiveIcon className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-white/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest">
                  Current Status
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide",
                    isMembershipActive ? "bg-green-400 text-green-950" : "bg-amber-400 text-amber-950"
                  )}
                >
                  {isMembershipActive ? (profile?.membershipStatus?.toUpperCase() || 'ACTIVE') : 'NO ACTIVE PLAN'}
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight truncate">
                {currentLevelName ? `${currentLevelName} Membership` : 'Trial Access'}
              </h3>
              <p className="text-white/80 text-xs sm:text-sm font-medium mt-0.5">
                {isMembershipActive
                  ? `Renews on ${renewalDateStr} · Sub-tier: ${profile?.membershipTier || 'Standard'}`
                  : 'Select a membership below to activate your storefront and unlock all apps.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
            {isMembershipActive && activePlanObject && (
              <button
                type="button"
                onClick={() => openPaymentForPlan(activePlanObject, (profile?.membershipTier as any) || 'Standard')}
                className="min-h-[48px] px-5 py-3 rounded-2xl bg-white text-gray-900 font-bold text-xs sm:text-sm hover:bg-gray-100 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCw className="w-4 h-4 text-orange-600 shrink-0" />
                <span>Renew Early</span>
              </button>
            )}
            <a
              href="#plans-section"
              className="min-h-[48px] px-5 py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm backdrop-blur-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-center"
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>{isMembershipActive ? 'Upgrade Plan' : 'View Plans'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* SUPER OBVIOUS DURATION / TIER SELECTOR SECTION */}
      <div id="plans-section" className="scroll-mt-6">
        <div className="bg-white rounded-3xl border-2 border-orange-200/80 p-4 sm:p-6 shadow-md relative overflow-hidden">
          {/* Header text for toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black text-sm shrink-0">
                1
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900">
                  Select Programme Duration &amp; Tier
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-500">
                  Tapping a duration instantly updates all membership prices below:
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100 self-start">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Active: {TIER_CONFIGS[selectedTier].term}</span>
            </div>
          </div>

          {/* Large, Touch-Friendly 3-Way Segmented Control */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200">
            {(['Standard', 'Pro', 'Pro+'] as const).map((tierKey) => {
              const isSelected = selectedTier === tierKey;
              const cfg = TIER_CONFIGS[tierKey];

              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => setSelectedTier(tierKey)}
                  className={cn(
                    "min-h-[58px] sm:min-h-[70px] p-3 sm:p-3.5 rounded-xl text-left transition-all duration-200 flex flex-col justify-center relative cursor-pointer active:scale-[0.98]",
                    isSelected
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25 ring-2 ring-orange-500"
                      : "bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 border border-gray-200/80"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 w-full mb-0.5">
                    <span className={cn("text-sm sm:text-base font-black tracking-tight", isSelected ? "text-white" : "text-gray-900")}>
                      {cfg.label} ({cfg.days} Days)
                    </span>
                    {cfg.savings && (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase whitespace-nowrap",
                          isSelected ? "bg-white text-orange-700 shadow-2xs" : "bg-green-100 text-green-800"
                        )}
                      >
                        {cfg.savings}
                      </span>
                    )}
                  </div>
                  <p className={cn("text-[11px] font-medium leading-tight", isSelected ? "text-orange-100" : "text-gray-500")}>
                    {cfg.tagline}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Available Plans Grid */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Configured Membership Tiers
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">
              Showing <span className="font-bold text-orange-600">{TIER_CONFIGS[selectedTier].term}</span> packages with full benefits:
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold shrink-0">
            {plans.length} Plans
          </span>
        </div>

        {plans.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center shadow-xs">
            <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <h4 className="text-base sm:text-lg font-bold text-gray-800 mb-1">No Membership Plans Configured</h4>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
              The administrator has not configured any membership plans in /admin/memberships yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
            {plans.map((plan, idx) => {
              const theme = PLAN_THEME[plan.name] || DEFAULT_THEME;
              const PlanIcon = theme.icon;

              const isCurrent =
                isMembershipActive &&
                (profile?.membershipLevel?.toLowerCase() === plan.name.toLowerCase() ||
                  profile?.membershipLevel === plan.id);

              // Find tier row for price resolution
              const tierRow = plan.tiers?.find((t) => t.tier === selectedTier);

              // Calculate price
              let fullPrice = 0;
              if (tierRow && tierRow.fullPrice > 0) {
                fullPrice = tierRow.fullPrice;
              } else if (plan.tierPrices && plan.tierPrices[selectedTier] != null) {
                fullPrice = Number(plan.tierPrices[selectedTier]);
              } else if (selectedTier === 'Pro+') {
                fullPrice = plan.annualPrice || Math.round((plan.monthlyPrice || plan.price || 0) * 12 * 0.8);
              } else if (selectedTier === 'Pro') {
                fullPrice = Math.round((plan.monthlyPrice || plan.price || 0) * 6 * 0.85);
              } else {
                fullPrice = plan.monthlyPrice || plan.price || 0;
              }

              // Monthly split installment option
              const monthlyOption = tierRow?.paymentOptions?.find((o) => o.paymentPlan === 'monthly');
              const cfg = TIER_CONFIGS[selectedTier];

              // Features list
              const features =
                (tierRow?.features && tierRow.features.length > 0 ? tierRow.features : plan.features) || [];

              const isExpanded = Boolean(expandedFeatures[plan.id || plan.name]);
              const visibleFeatures = isExpanded ? features : features.slice(0, 5);

              return (
                <motion.div
                  key={plan.id || plan.name}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "bg-white rounded-3xl border-2 p-5 sm:p-7 flex flex-col justify-between transition-all duration-300 relative shadow-sm hover:shadow-xl",
                    isCurrent ? "border-orange-500 ring-4 ring-orange-500/15" : theme.border
                  )}
                >
                  {/* Top Badge */}
                  {plan.badge && (
                    <div className="absolute -top-3 left-6 z-10">
                      <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {plan.badge}
                      </span>
                    </div>
                  )}

                  <div>
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3 mt-0.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                            {plan.name}
                          </h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-extrabold uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        {plan.whoItIsFor && (
                          <p className="text-xs font-bold text-orange-600 mt-0.5 truncate">{plan.whoItIsFor}</p>
                        )}
                      </div>

                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 shadow-2xs">
                        <PlanIcon className="w-6 h-6 text-gray-800" />
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">
                      {plan.description || 'Full ecosystem tier with storefront, tools, and 90-day success roadmap.'}
                    </p>

                    {/* Price Card */}
                    <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-orange-50/40 border border-gray-100">
                      <div className="flex items-baseline justify-between gap-1 flex-wrap">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                            £{fullPrice}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            / {cfg.days} Days
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md bg-orange-100 text-orange-800">
                          {selectedTier} Tier
                        </span>
                      </div>

                      {monthlyOption ? (
                        <div className="mt-2 pt-2 border-t border-orange-100/60 flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">Monthly Split:</span>
                          <span className="font-extrabold text-orange-700">
                            {monthlyOption.installments} × £{monthlyOption.perChargePrice}/mo
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
                          {cfg.tagline}
                        </p>
                      )}
                    </div>

                    {/* Included Platform Apps */}
                    {((plan.appBundles && plan.appBundles.length > 0) || (plan.includedApps && plan.includedApps.length > 0)) && (
                      <div className="mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-700 mb-2">
                          <Layers className="w-3.5 h-3.5 text-orange-500" />
                          <span>Bundled Apps &amp; Platforms:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(plan.appBundles || []).map((b, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-100 text-[10px] font-bold text-orange-800"
                            >
                              {b.platform} ({b.packageName})
                            </span>
                          ))}
                          {(plan.includedApps || []).map((app, i) => (
                            <span
                              key={`app-${i}`}
                              className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-800"
                            >
                              {app.platform} · {app.planName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Features List */}
                    <div className="space-y-2 mb-4">
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Included Features
                      </div>
                      {visibleFeatures.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                          <span className="text-gray-700 font-medium leading-snug">{feat}</span>
                        </div>
                      ))}

                      {features.length > 5 && (
                        <button
                          type="button"
                          onClick={() => toggleFeaturesExpand(plan.id || plan.name)}
                          className="text-xs font-bold text-orange-600 hover:text-orange-700 pt-1 flex items-center gap-1 cursor-pointer min-h-[36px]"
                        >
                          {isExpanded ? (
                            <>
                              Show fewer features <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              +{features.length - 5} more features <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile-Optimized Action Button (Touch Target >= 48px) */}
                  <div className="pt-4 border-t border-gray-100 mt-2">
                    <button
                      type="button"
                      onClick={() => openPaymentForPlan(plan, selectedTier)}
                      className={cn(
                        "w-full min-h-[48px] sm:min-h-[52px] py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98",
                        isCurrent
                          ? "bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/15"
                          : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/25"
                      )}
                    >
                      {isCurrent ? (
                        <>
                          <RefreshCw className="w-4 h-4 shrink-0" />
                          <span>Renew / Extend {plan.name}</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 shrink-0" />
                          <span>Select &amp; Pay for {plan.name}</span>
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-center text-[10px] sm:text-[11px] font-medium text-gray-400">
                      Pay with card, PayPal or MCOM Wallet via MCOM Pay
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Membership History / Transaction Records */}
      <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 md:p-10 shadow-sm mt-8 sm:mt-12">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-gray-900">Membership History</h3>
            <p className="text-xs text-gray-500 mt-0.5">Audit log of your membership transactions and invoices.</p>
          </div>
          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-100">
            {transactions.length} Records
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-10 sm:py-12 text-center">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-semibold text-xs sm:text-sm">No subscription transactions found.</p>
            <p className="text-[11px] text-gray-400 mt-1">Once you complete a payment, your receipts will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors border border-gray-100"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 text-green-700 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">{item.description}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-black text-gray-900 text-sm sm:text-base">£{item.amount}</p>
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-green-700 bg-green-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    {item.status || 'COMPLETED'}
                  </span>
                  {item.provider === 'mcom-rewards' && (
                    <span className="ml-1.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                      Granted via Rewards
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real Checkout / Payment Modal */}
      <MembershipPaymentModal
        isOpen={paymentModalOpen}
        plan={selectedPlanForPayment}
        source="dashboard"
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
