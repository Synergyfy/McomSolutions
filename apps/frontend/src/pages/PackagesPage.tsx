import { motion } from 'motion/react';
import { Check, PackageOpen, ArrowRight, Gift, Dices, Store, FileSearch, UsersRound, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useState } from 'react';

interface PackageTier {
  name: string;
  monthlyPrice: number;
  popular?: boolean;
  features: string[];
  limits: string;
}

interface PlatformPackages {
  id: string;
  name: string;
  icon: any;
  color: string;
  tagline: string;
  tiers: PackageTier[];
}

const QUARTERLY_DISCOUNT = 0.05;
const YEARLY_DISCOUNT = 0.15;

const PLATFORM_PACKAGES: PlatformPackages[] = [
  {
    id: 'mcom-rewards',
    name: 'MCOM Rewards',
    icon: Gift,
    color: 'bg-orange-500',
    tagline: 'Incentivise every interaction with a powerful loyalty engine.',
    tiers: [
      { name: 'Starter', monthlyPrice: 15, features: ['Basic Points Engine', 'Standard Rewards', '500 members', 'Email Support'], limits: 'Up to 500 members' },
      { name: 'Standard', monthlyPrice: 79, popular: true, features: ['Advanced Points Engine', 'Custom Rewards', 'Tiered VIP Levels', 'Priority Support', 'Analytics Dashboard'], limits: 'Up to 5,000 members' },
      { name: 'Enterprise', monthlyPrice: 199, features: ['Unlimited Points Engine', 'White-label Rewards', 'AI Behavioral Analytics', 'API Access', 'Dedicated Support'], limits: 'Unlimited members' },
    ],
  },
  {
    id: 'mcom-spin',
    name: 'MCOM Spin',
    icon: Dices,
    color: 'bg-amber-500',
    tagline: 'Gamified spin-to-win campaigns that capture leads at scale.',
    tiers: [
      { name: 'Starter', monthlyPrice: 19, features: ['Standard Wheel Design', 'Basic Data Capture', '1,000 spins/mo', 'Email Support'], limits: '1,000 spins/month' },
      { name: 'Standard', monthlyPrice: 49, popular: true, features: ['Custom Wheel Themes', 'Advanced Lead Capture', '10,000 spins/mo', 'Priority Support', 'A/B Testing'], limits: '10,000 spins/month' },
      { name: 'Enterprise', monthlyPrice: 149, features: ['Unlimited Wheels', 'Full Customization', 'Unlimited spins', 'API Access', 'Dedicated Manager'], limits: 'Unlimited spins' },
    ],
  },
  {
    id: 'mcom-mall',
    name: 'MCOM Mall',
    icon: Store,
    color: 'bg-sky-500',
    tagline: 'A unified multi-vendor marketplace for modern commerce.',
    tiers: [
      { name: 'Starter', monthlyPrice: 40, features: ['Basic Storefront', 'Up to 100 products', 'Standard Checkout', 'Community Support'], limits: '100 products' },
      { name: 'Standard', monthlyPrice: 99, popular: true, features: ['Premium Themes', 'Up to 1,000 products', 'Abandoned Cart Recovery', 'Advanced SEO', 'Priority Support'], limits: '1,000 products' },
      { name: 'Enterprise', monthlyPrice: 299, features: ['Custom Storefront', 'Unlimited products', 'Multi-vendor Support', 'Full API Suite', 'Dedicated Support'], limits: 'Unlimited products' },
    ],
  },
  {
    id: 'gbs-audit',
    name: '24/7 GBS Audit',
    icon: FileSearch,
    color: 'bg-indigo-600',
    tagline: 'Real-time compliance, financial oversight, and anomaly detection.',
    tiers: [
      { name: 'Starter', monthlyPrice: 99, features: ['Basic Compliance Checks', 'Monthly Reports', 'Single User', 'Email Support'], limits: '1 user' },
      { name: 'Standard', monthlyPrice: 249, popular: true, features: ['Automated Risk Assessment', 'Real-time Monitoring', 'Up to 10 users', 'Priority Support', 'Custom Reports'], limits: '10 users' },
      { name: 'Enterprise', monthlyPrice: 599, features: ['AI Anomaly Detection', 'Full Compliance Suite', 'Unlimited users', 'API Integration', 'Dedicated Account Manager'], limits: 'Unlimited users' },
    ],
  },
  {
    id: 'gbs-expo',
    name: '24/7 GBS Expo',
    icon: UsersRound,
    color: 'bg-cyan-500',
    tagline: 'End-to-end virtual and physical event management at scale.',
    tiers: [
      { name: 'Starter', monthlyPrice: 79, features: ['Basic Event Setup', 'Up to 100 attendees', 'Standard Booth', 'Email Support'], limits: '100 attendees' },
      { name: 'Standard', monthlyPrice: 149, popular: true, features: ['Premium 3D Booth', 'Up to 1,000 attendees', 'Lead Export', 'Analytics', 'Priority Support'], limits: '1,000 attendees' },
      { name: 'Enterprise', monthlyPrice: 399, features: ['Custom Virtual Venue', 'Unlimited attendees', 'Full Networking Suite', 'API Access', 'Event Manager'], limits: 'Unlimited attendees' },
    ],
  },
];

const ALL_FEATURES_MAP: Record<string, { label: string; getValue: (tier: PackageTier) => string | boolean }> = {
  'Basic Points Engine': { label: 'Points Engine', getValue: (t) => ['Basic Points Engine', 'Advanced Points Engine', 'Unlimited Points Engine'].includes(t.features[0]) ? 'Basic' : t.features[0].includes('Advanced') ? 'Advanced' : 'Unlimited' },
  'Standard Wheel Design': { label: 'Wheel Design', getValue: (t) => t.features[0] },
  'Basic Storefront': { label: 'Storefront', getValue: (t) => t.features[0] },
  'Basic Compliance Checks': { label: 'Compliance', getValue: (t) => t.features[0] },
  'Basic Event Setup': { label: 'Event Setup', getValue: (t) => t.features[0] },
};

function getPrice(tier: PackageTier, billingCycle: 'quarterly' | 'yearly') {
  const discount = billingCycle === 'yearly' ? YEARLY_DISCOUNT : QUARTERLY_DISCOUNT;
  const perMonthDiscounted = Math.floor(tier.monthlyPrice * (1 - discount));
  const totalPerCycle = billingCycle === 'yearly' ? perMonthDiscounted * 12 : perMonthDiscounted * 3;
  return { perMonthDiscounted, totalPerCycle };
}

export default function PackagesPage() {
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'quarterly' | 'yearly'>('quarterly');

  return (
    <div className="pt-32 pb-24 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-600 text-sm font-semibold mb-6">
              <PackageOpen className="w-4 h-4" />
              Platform Packages
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              Add <span className="text-brand-blue">Platform Power</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 font-medium">
              Purchase platform-specific packages to unlock features, capacity, and tools for each product individually.
            </p>
          </motion.div>

          <div className="mt-8 md:mt-12 flex justify-center">
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
                  {cycle === 'quarterly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 5%</span>}
                  {cycle === 'yearly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 15%</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8 md:space-y-12">
          {PLATFORM_PACKAGES.map((platform, index) => {
            const Icon = platform.icon;
            const isExpanded = expandedPlatform === platform.id;

            const comparisonRows: { label: string; values: (string | boolean)[] }[] = [];
            platform.tiers[0].features.forEach((_, fi) => {
              const label = platform.tiers.map(t => t.features[fi] || '—').join(' ');
              const commonPrefix = platform.tiers
                .map(t => t.features[fi] || '')
                .reduce((common, curr) => {
                  let i = 0;
                  while (i < common.length && i < curr.length && common[i] === curr[i]) i++;
                  return common.substring(0, i);
                });
              const cleanLabel = commonPrefix.replace(/:\s*$/, '').trim() || `Feature ${fi + 1}`;
              comparisonRows.push({
                label: cleanLabel,
                values: platform.tiers.map(t => t.features[fi] || '—'),
              });
            });

            return (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="bg-white rounded-[2rem] md:rounded-[3rem] border border-gray-200 overflow-hidden transition-all hover:border-brand-blue/20 hover:shadow-xl"
              >
                <button
                  onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
                  className="w-full p-5 md:p-8 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-md", platform.color)}>
                      <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 group-hover:text-brand-blue transition-colors">{platform.name}</h3>
                      <p className="text-xs md:text-sm text-gray-500 font-medium">{platform.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:block text-xs font-bold text-gray-400">3 tiers available</span>
                    <div className={cn(
                      "w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center transition-all group-hover:bg-brand-blue group-hover:text-white",
                      isExpanded ? "rotate-180" : ""
                    )}>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-gray-100"
                  >
                    {/* Tier Cards */}
                    <div className="p-5 md:p-8 grid md:grid-cols-3 gap-4 md:gap-6 bg-gray-50/50 border-b border-gray-100">
                      {platform.tiers.map((tier) => {
                        const { perMonthDiscounted, totalPerCycle } = getPrice(tier, billingCycle);
                        return (
                          <div
                            key={tier.name}
                            className={cn(
                              "relative p-5 md:p-6 rounded-2xl md:rounded-3xl flex flex-col transition-all",
                              tier.popular
                                ? "bg-white border-2 border-brand-blue shadow-lg shadow-brand-blue/10 scale-[1.02]"
                                : "bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md"
                            )}
                          >
                            {tier.popular && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-blue text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm">
                                Most Popular
                              </div>
                            )}

                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-black text-gray-900">{tier.name}</h4>
                              <Sparkles className={cn("w-4 h-4", tier.popular ? "text-brand-blue" : "text-gray-300")} />
                            </div>

                            <div className="mb-2">
                              <span className="text-2xl md:text-3xl font-black text-gray-900">£{perMonthDiscounted}</span>
                              <span className="text-sm text-gray-400 font-semibold">/mo</span>
                            </div>
                            <div className="text-xs font-bold text-green-600 mb-4">
                              £{totalPerCycle}/{billingCycle === 'yearly' ? 'yr' : 'qtr'}
                            </div>

                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{tier.limits}</div>

                            <div className="space-y-2.5 mb-6 flex-1">
                              {tier.features.map((f, fi) => (
                                <div key={fi} className="flex items-start gap-2.5">
                                  <Check className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                                  <span className="text-sm text-gray-600 font-medium">{f}</span>
                                </div>
                              ))}
                            </div>

                            <button className={cn(
                              "w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95",
                              tier.popular
                                ? "bg-brand-blue text-white hover:bg-blue-600 shadow-md shadow-brand-blue/20"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                            )}>
                              Get Started
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Comparison Table */}
                    <div className="p-5 md:p-8">
                      <h4 className="text-base md:text-lg font-bold text-gray-900 mb-4 md:mb-6">Feature Comparison</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[500px]">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="pb-3 md:pb-4 pr-4 font-bold text-gray-500 uppercase tracking-widest text-xs">Feature</th>
                              {platform.tiers.map(t => (
                                <th key={t.name} className="pb-3 md:pb-4 px-3 md:px-4 font-bold text-center text-sm">
                                  <span className={cn(t.popular ? "text-brand-blue" : "text-gray-900")}>{t.name}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {comparisonRows.map((row, ri) => (
                              <tr key={ri} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 md:py-4 pr-4 font-semibold text-gray-700 text-sm">{row.label}</td>
                                {row.values.map((v, vi) => (
                                  <td key={vi} className="py-3 md:py-4 px-3 md:px-4 text-center">
                                    {typeof v === 'string' ? (
                                      <span className="text-sm text-gray-600 font-medium">{v}</span>
                                    ) : (
                                      v ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-gray-300 mx-auto" />
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="hover:bg-gray-50 transition-colors border-t-2 border-gray-100">
                              <td className="py-3 md:py-4 pr-4 font-bold text-gray-900 text-sm">Price</td>
                              {platform.tiers.map(t => {
                                const { perMonthDiscounted, totalPerCycle } = getPrice(t, billingCycle);
                                return (
                                  <td key={t.name} className="py-3 md:py-4 px-3 md:px-4 text-center">
                                    <span className="font-black text-gray-900">£{perMonthDiscounted}</span>
                                    <span className="text-xs text-gray-400">/mo</span>
                                    <div className="text-[10px] text-green-600 font-bold">£{totalPerCycle}/{billingCycle === 'yearly' ? 'yr' : 'qtr'}</div>
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 md:mt-32 text-center">
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 text-white">
            <PackageOpen className="w-10 h-10 text-brand-blue mx-auto mb-4" />
            <h3 className="text-2xl md:text-3xl font-bold mb-3">Need the full ecosystem?</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">Save more with a Membership that includes all platforms. Bundled pricing starts from £10/mo.</p>
            <Link to="/membership" className="inline-flex items-center gap-2 bg-brand-blue text-white px-8 py-4 rounded-full font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              View Memberships <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
