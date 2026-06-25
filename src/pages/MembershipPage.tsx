import { motion } from 'motion/react';
import { Check, Star, Zap, ArrowRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { usePricing, ICON_MAP, SubTier } from '../context/PricingContext';
import { useState } from 'react';

const QUARTERLY_DISCOUNT = 0.1;
const YEARLY_DISCOUNT = 0.2;

export default function MembershipPage() {
  const { plans } = usePricing();
  const [selectedSubTier, setSelectedSubTier] = useState<SubTier>('Normal');
  const [billingCycle, setBillingCycle] = useState<'quarterly' | 'yearly'>('quarterly');

  return (
    <div className="pt-32 pb-24 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 text-purple-600 text-sm font-semibold mb-6">
              <Star className="w-4 h-4" />
              Membership & Subscriptions
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              Choose Your <span className="text-brand-blue">Membership</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 font-medium">
              Select the plan that fits your business. Unlock access levels, features, and tools across the entire ecosystem.
            </p>
          </motion.div>

          <div className="mt-8 md:mt-12 flex flex-col items-center gap-6">
            <div className="flex p-1 bg-gray-100 rounded-full">
              {(['quarterly', 'yearly'] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={cn(
                    "px-6 md:px-8 py-3 rounded-full text-sm font-semibold transition-all",
                    billingCycle === cycle ? "bg-white text-brand-blue shadow-lg" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  {cycle === 'quarterly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 10%</span>}
                  {cycle === 'yearly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 20%</span>}
                </button>
              ))}
            </div>

            <div className="flex gap-2 p-1.5 bg-brand-blue/5 rounded-2xl border border-brand-blue/10 overflow-x-auto">
              {(['Normal', 'Pro', 'Pro+'] as SubTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedSubTier(tier)}
                  className={cn(
                    "px-4 md:px-6 py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center min-w-[90px] md:min-w-[120px]",
                    selectedSubTier === tier 
                      ? "bg-brand-blue text-white shadow-glow" 
                      : "text-brand-blue/60 hover:text-brand-blue hover:bg-brand-blue/10"
                  )}
                >
                  {tier}
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16 md:mb-32">
          {plans.map((plan, index) => {
            const isGold = plan.id === 'Gold';
            const baseMonthly = plan.price[selectedSubTier];
            const discount = billingCycle === 'yearly' ? YEARLY_DISCOUNT : QUARTERLY_DISCOUNT;
            const perMonthDiscounted = Math.floor(baseMonthly * (1 - discount));
            const totalPerCycle = billingCycle === 'yearly' ? perMonthDiscounted * 12 : perMonthDiscounted * 3;
            const PlanIcon = ICON_MAP[plan.iconName as keyof typeof ICON_MAP];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={cn(
                  "relative p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] flex flex-col transition-all duration-500",
                  isGold 
                    ? "bg-brand-blue text-white shadow-2xl shadow-blue-500/40 scale-[1.02] md:scale-105 z-10" 
                    : "bg-white border border-gray-100 hover:border-brand-blue/20 hover:shadow-2xl"
                )}
              >
                {isGold && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 font-bold px-3 md:px-4 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg whitespace-nowrap">
                    <Star className="w-3 h-3 fill-current" /> MOST POPULAR
                  </div>
                )}

                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center p-2.5 md:p-3 shadow-sm transition-transform group-hover:scale-110", isGold ? "bg-white/10" : plan.color)}>
                    <PlanIcon className="w-full h-full" />
                  </div>
                  <div className={cn("text-xs font-semibold uppercase tracking-widest", isGold ? "text-blue-100" : "text-gray-400")}>
                    {plan.name}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl md:text-4xl font-bold">£{perMonthDiscounted}</span>
                    <span className={cn("text-sm", isGold ? "text-blue-200" : "text-gray-400")}>/mo</span>
                  </div>
                  <div className={cn("text-xs font-bold mt-1", isGold ? "text-green-300" : "text-green-500")}>
                    £{totalPerCycle}/{billingCycle === 'yearly' ? 'yr' : 'qtr'}
                  </div>
                </div>

                <p className={cn("mb-6 md:mb-8 text-sm font-medium leading-relaxed", isGold ? "text-blue-50" : "text-gray-500")}>
                  {plan.description}
                </p>

                <div className={cn("h-px w-full mb-6 md:mb-8", isGold ? "bg-white/20" : "bg-gray-100")} />

                <div className="space-y-3 md:space-y-4 mb-8 md:mb-10 flex-1">
                  <div className={cn("text-xs font-bold uppercase tracking-widest", isGold ? "text-blue-200/60" : "text-gray-400")}>Features</div>
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Check className={cn("w-4 h-4 shrink-0", isGold ? "text-blue-300" : "text-brand-blue")} />
                      <span className={cn("text-sm font-semibold", isGold ? "text-white" : "text-gray-700")}>{f}</span>
                    </div>
                  ))}
                  
                  <div className={cn("h-px w-8 my-3 md:my-4", isGold ? "bg-white/10" : "bg-gray-100")} />
                  
                  <div className={cn("text-xs font-bold uppercase tracking-widest", isGold ? "text-blue-200/60" : "text-gray-400")}>{selectedSubTier} Access</div>
                  {(plan.tierFeatures?.[selectedSubTier] || []).map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Zap className={cn("w-4 h-4 shrink-0", isGold ? "text-amber-300" : "text-amber-500")} />
                      <span className={cn("text-sm font-bold", isGold ? "text-white" : "text-gray-900")}>{f}</span>
                    </div>
                  ))}
                </div>

                <button className={cn(
                  "w-full py-3 md:py-4 rounded-2xl font-black text-base md:text-lg transition-all active:scale-95 shadow-lg",
                  isGold ? "bg-white text-brand-blue hover:bg-blue-50" : "bg-brand-blue text-white hover:bg-blue-600 shadow-blue-500/20"
                )}>
                  Select Membership
                </button>

                <div className={cn("mt-4 md:mt-6 text-center text-xs font-semibold uppercase tracking-wider", isGold ? "text-blue-100" : "text-gray-400")}>
                  FOR {plan.whoItIsFor}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Compare Plans CTA */}
        <div className="text-center mb-16 md:mb-32">
          <div className="max-w-2xl mx-auto bg-gray-50 rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-gray-100">
            <Shield className="w-10 h-10 text-brand-blue mx-auto mb-4" />
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">Not sure which plan fits?</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Compare all membership tiers side by side to find the perfect fit for your business.</p>
            <Link to="/pricing" className="inline-flex items-center gap-2 bg-brand-blue text-white px-8 py-4 rounded-full font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              Compare Plans <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Trust Points */}
        <div className="grid sm:grid-cols-3 gap-8 md:gap-12">
          {[
            { title: 'Built for real businesses', desc: 'Every tool is optimized for actual market performance and real-world growth.' },
            { title: 'Easy to upgrade anytime', desc: 'Scale your membership as your business grows. No lock-ins, just flexibility.' },
            { title: 'Designed to scale with you', desc: 'From startups to enterprises, our ecosystem scales alongside your success.' },
          ].map((item, i) => (
            <div key={i} className="text-center p-6 md:p-8">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <Check className="w-7 h-7 text-brand-blue" />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3">{item.title}</h3>
              <p className="text-sm md:text-base text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
