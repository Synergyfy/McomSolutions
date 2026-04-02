import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Zap, 
  Star, 
  Trophy, 
  Check, 
  Plus, 
  ArrowRight, 
  Globe, 
  Shield, 
  Zap as ZapIcon,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { PRODUCTS } from '../constants';

import { usePricing, ICON_MAP, SubTier, Membership } from '../context/PricingContext';

export default function PricingPage() {
  const { plans } = usePricing();
  const [selectedSubTier, setSelectedSubTier] = useState<SubTier>('Normal');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const discount = 0.2; // 20% discount for yearly

  return (
    <div className="pt-32 pb-24 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              Join the <span className="text-brand-blue font-serif font-medium">MCOM</span> Business Network
            </h1>
            <p className="text-xl text-gray-600 font-medium">
              Get visibility, tools, and support to grow your business at any scale.
            </p>
          </motion.div>

          {/* Toggle and Tier Switcher */}
          <div className="mt-12 flex flex-col items-center gap-8">
            <div className="flex p-1 bg-gray-100 rounded-full">
              {(['monthly', 'yearly'] as const).map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={cn(
                    "px-8 py-3 rounded-full text-sm font-semibold transition-all",
                    billingCycle === cycle ? "bg-white text-brand-blue shadow-lg" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  {cycle === 'yearly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 20%</span>}
                </button>
              ))}
            </div>

            <div className="flex gap-2 p-1.5 bg-brand-blue/5 rounded-2xl border border-brand-blue/10">
              {(['Normal', 'Pro', 'Pro+'] as SubTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedSubTier(tier)}
                  className={cn(
                    "px-6 py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center min-w-[120px]",
                    selectedSubTier === tier 
                      ? "bg-brand-blue text-white shadow-glow animate-in zoom-in-95 duration-200" 
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

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
          {plans.map((plan) => (
            <MembershipCard 
              key={plan.id}
              plan={plan}
              tier={selectedSubTier}
              cycle={billingCycle}
              discount={discount}
              isGold={plan.id === 'Gold'}
            />
          ))}
        </div>

        {/* Comparison Table */}
        <div className="mb-32">
          <h2 className="text-4xl font-semibold text-center mb-12">Compare Memberships</h2>
          <div className="overflow-x-auto glass rounded-[2.5rem] border-gray-100 p-8">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-6 pt-2 font-bold text-gray-500 uppercase tracking-widest text-xs">Features</th>
                  {plans.map(p => (
                    <th key={p.id} className="pb-6 pt-2 font-bold text-center">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <ComparisonRow label="Visibility Range" values={['Starter', 'Enhanced', 'Regional', 'Global Priority']} />
                <ComparisonRow label="Campaign Access" values={['Basic', 'Limited', 'Full', 'Exclusive']} />
                <ComparisonRow label="Growth Tools" values={['Basic', 'Advanced', 'Full Suite', 'Custom Suite']} />
                <ComparisonRow label="Dedicated Support" values={['None', 'Business Hours', 'Priority', 'White Glove']} />
                <ComparisonRow label="Multi-location" values={[false, false, true, true]} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust Points */}
        <div className="grid md:grid-cols-3 gap-12 mb-32">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-8 h-8 text-brand-blue" />
            </div>
            <h3 className="text-xl font-bold mb-4">Built for real businesses</h3>
            <p className="text-gray-500">Every tool is optimized for actual market performance and real-world growth.</p>
          </div>
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-brand-blue" />
            </div>
            <h3 className="text-xl font-bold mb-4">Easy to upgrade anytime</h3>
            <p className="text-gray-500">Scale your membership as your business grows. No lock-ins, just flexibility.</p>
          </div>
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-brand-blue" />
            </div>
            <h3 className="text-xl font-bold mb-4">Designed to grow with you</h3>
            <p className="text-gray-500">From individual startups to enterprises, MCOM scales alongside your success.</p>
          </div>
        </div>

        {/* Individual Product Access */}
        <div className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Prefer a Modular Approach?</h2>
            <p className="text-gray-500 font-medium">
              Subscribe to individual tools and build your own custom suite.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.slice(0, 0).concat(PRODUCTS.map(p => ({
              ...p,
              startingPrice: p.type === 'GBS' ? '£25' : '£20' // Placeholder logic for starting prices
            }))).map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group relative bg-white border border-gray-100 rounded-[3rem] p-10 hover:border-brand-blue/20 hover:shadow-2xl transition-all duration-500"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center p-3 text-white shadow-lg group-hover:scale-110 transition-transform duration-500", product.color)}>
                    <product.icon className="w-full h-full" />
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{product.type} MODULE</div>
                </div>

                <div className="mb-10">
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-brand-blue transition-colors mb-2">{product.name}</h3>
                  <p className="text-sm text-gray-500 font-medium line-clamp-2 leading-relaxed">{product.tagline}</p>
                </div>

                <div className="flex items-end gap-1 mb-10">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Starting at</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {product.name.includes('Mall') ? '£40' : 
                     product.name.includes('Loyalty') ? '£25' : 
                     product.name.includes('Rewards') ? '£15' : '£20'}
                  </div>
                  <div className="text-gray-400 font-bold mb-1">/mo</div>
                </div>

                <Link 
                  to={`/product/${product.id}`}
                  className="w-full py-4 border-2 border-brand-blue/10 rounded-2xl text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  View Product Pricing <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="relative glass rounded-[4rem] p-12 md:p-24 text-center overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-blue/5 blur-[100px] rounded-full -z-10" />
          <h2 className="text-4xl md:text-6xl font-bold mb-8">Start Growing Your Business Today</h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Choose your membership and get started in minutes. Joins thousands of merchants already scaling within the 24/7 GBS ecosystem.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button className="bg-brand-blue text-white px-10 py-5 rounded-full font-bold text-xl hover:bg-blue-600 transition-all shadow-glow-lg active:scale-95">
              Get Started Now
            </button>
            <button className="text-gray-900 border border-gray-200 px-10 py-5 rounded-full font-bold text-xl hover:bg-gray-50 transition-all active:scale-95">
              Compare All Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccordionItem({ title, subtitle, price, children }: { title: string, subtitle: string, price: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden transition-all hover:border-brand-blue/20">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-8 flex items-center justify-between text-left group"
      >
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-1">
             <h4 className="text-xl font-bold text-gray-900 group-hover:text-brand-blue transition-colors">{title}</h4>
             <span className="px-3 py-1 bg-blue-50 text-brand-blue rounded-full text-[10px] font-bold uppercase tracking-wider">{price}</span>
          </div>
          <p className="text-sm text-gray-400 font-medium">{subtitle}</p>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center transition-all group-hover:bg-brand-blue group-hover:text-white",
          isOpen ? "rotate-180" : ""
        )}>
          <ChevronDown className="w-5 h-5" />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-8 pb-8 pt-2 border-t border-gray-50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MembershipCard({ plan, tier, cycle, discount, isGold }: any) {
  const basePrice = plan.price[tier];
  const finalPrice = cycle === 'yearly' ? Math.floor(basePrice * (1 - discount)) : basePrice;

  const tierFeatures: Record<SubTier, string[]> = {
    'Normal': ['Basic visibility', 'Standard tools'],
    'Pro': ['Enhanced visibility', 'Growth analytics', 'Priority tools'],
    'Pro+': ['Maximum priority', 'Full data suite', 'Beta access']
  };

  const PlanIcon = ICON_MAP[plan.iconName as keyof typeof ICON_MAP];

  return (
    <div className={cn(
      "p-8 rounded-[3rem] flex flex-col transition-all duration-700 relative h-full group",
      isGold ? "bg-brand-blue text-white shadow-2xl shadow-blue-500/40 scale-105 z-10" : "bg-white border border-gray-100 hover:border-brand-blue/20 hover:shadow-2xl"
    )}>
      {isGold && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 font-bold px-4 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg font-bold px-4 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg">
          <Star className="w-3 h-3 fill-current" /> MOST POPULAR
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center p-3 shadow-sm transition-transform group-hover:scale-110", isGold ? "bg-white/10" : plan.color)}>
          <PlanIcon className="w-full h-full" />
        </div>
        <div className={cn("text-xs font-semibold uppercase tracking-widest", isGold ? "text-blue-100" : "text-gray-400")}>
          {plan.name}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">£{finalPrice}</span>
          <span className={cn("text-sm transition-opacity", isGold ? "text-blue-200" : "text-gray-400")}>/mo</span>
        </div>
        {cycle === 'yearly' && (
          <div className={cn("text-xs font-bold mt-1", isGold ? "text-green-300" : "text-green-500")}>
            Billed yearly (£{finalPrice * 12}/yr)
          </div>
        )}
      </div>

      <p className={cn("mb-8 text-sm font-medium leading-relaxed", isGold ? "text-blue-50" : "text-gray-500")}>
        {plan.description}
      </p>

      <div className={cn("h-px w-full mb-8", isGold ? "bg-white/20" : "bg-gray-100")} />

      <div className="space-y-4 mb-10 flex-1 text-left">
        <div className={cn("text-xs font-bold uppercase tracking-widest", isGold ? "text-blue-200/60" : "text-gray-400")}>Plan Inclusion</div>
        {plan.features.map((f: string, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <Check className={cn("w-4 h-4", isGold ? "text-blue-300" : "text-brand-blue")} />
            <span className={cn("text-sm font-semibold", isGold ? "text-white" : "text-gray-700")}>{f}</span>
          </div>
        ))}
        
        <div className={cn("h-px w-8 my-4", isGold ? "bg-white/10" : "bg-gray-100")} />
        
        <div className={cn("text-xs font-bold uppercase tracking-widest", isGold ? "text-blue-200/60" : "text-gray-400")}>{tier} Benefits</div>
        {tierFeatures[tier as SubTier].map((f: string, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <Zap className={cn("w-4 h-4", isGold ? "text-amber-300" : "text-amber-500")} />
            <span className={cn("text-sm font-bold", isGold ? "text-white" : "text-gray-900")}>{f}</span>
          </div>
        ))}
      </div>

      <button className={cn(
        "w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-lg",
        isGold ? "bg-white text-brand-blue hover:bg-blue-50" : "bg-brand-blue text-white hover:bg-blue-600 shadow-blue-500/20"
      )}>
        Choose {plan.name} {tier}
      </button>

      <div className={cn("mt-6 text-center text-xs font-semibold uppercase tracking-wider opacity-60", isGold ? "text-blue-100" : "text-gray-400")}>
        FOR {plan.whoItIsFor}
      </div>
    </div>
  );
}

function ComparisonRow({ label, values }: { label: string, values: any[] }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors group">
      <td className="py-6 font-bold text-gray-900 group-hover:text-brand-blue transition-colors">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-6 text-center font-medium text-gray-600">
          {typeof v === 'boolean' ? (
            <div className="flex justify-center">
              {v ? <Check className="w-5 h-5 text-green-500" /> : <div className="w-5 h-px bg-gray-200" />}
            </div>
          ) : v}
        </td>
      ))}
    </tr>
  );
}
