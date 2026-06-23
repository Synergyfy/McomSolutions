import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown, CheckCircle2, Star, Zap, Shield, ArrowUpRight,
  CalendarDays, Clock, ChevronRight, AlertCircle, TrendingUp, X, RefreshCw
} from 'lucide-react';

const TIERS = [
  {
    name: 'Bronze',
    icon: Star,
    price: '£49',
    period: '/month',
    color: 'bg-orange-400',
    ring: 'ring-orange-400',
    highlight: 'text-orange-500',
    bg: 'bg-orange-50',
    features: ['Basic Storefront', 'Standard Support (48hr)', 'Up to 100 products', 'Basic Analytics Dashboard', 'MCOM Ecosystem Read-Only Access'],
  },
  {
    name: 'Silver',
    icon: Zap,
    price: '£99',
    period: '/month',
    color: 'bg-orange-500',
    ring: 'ring-orange-500',
    highlight: 'text-orange-600',
    bg: 'bg-orange-100',
    features: ['Premium Storefront', 'Priority Support (12hr)', 'Up to 1,000 products', 'Advanced Analytics', 'MCOM Rewards Basic', 'MCOM Spin Access'],
    current: true,
  },
  {
    name: 'Gold',
    icon: Crown,
    price: '£199',
    period: '/month',
    color: 'bg-amber-500',
    ring: 'ring-amber-500',
    highlight: 'text-amber-600',
    bg: 'bg-amber-50',
    features: ['Custom Storefront Themes', '24/7 Dedicated Support', 'Unlimited products', 'Custom Reporting Suite', 'MCOM Rewards Pro', 'MCOM Spin Unlimited', 'Full Mall Access'],
  },
  {
    name: 'Platinum',
    icon: Shield,
    price: '£499',
    period: '/month',
    color: 'bg-gray-700',
    ring: 'ring-gray-700',
    highlight: 'text-gray-700',
    bg: 'bg-gray-100',
    features: ['White-label Solutions', 'Personal Account Manager', 'Full API Access', 'Complete Ecosystem Access', 'Audit & Expo VIP Priority', 'SLA Guarantee'],
  },
];

const HISTORY = [
  { date: '23 Jun 2026', action: 'Silver Membership Renewed', amount: '£99.00', status: 'paid' },
  { date: '23 May 2026', action: 'Silver Membership Charge', amount: '£99.00', status: 'paid' },
  { date: '23 Apr 2026', action: 'Upgraded from Bronze to Silver', amount: '£50.00', status: 'paid' },
  { date: '23 Mar 2026', action: 'Bronze Membership Charge', amount: '£49.00', status: 'paid' },
  { date: '23 Feb 2026', action: 'Bronze Membership — First Payment', amount: '£49.00', status: 'paid' },
];

type ModalType = 'upgrade' | 'renew' | 'cancel' | null;

export default function DashboardMemberships() {
  const [modal, setModal] = useState<ModalType>(null);
  const currentTier = TIERS.find(t => t.current)!;
  const CurrentIcon = currentTier.icon;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1">My Membership</h2>
        <p className="text-gray-500">Manage your central MCOM Ecosystem subscription.</p>
      </div>

      {/* Current Membership Hero Card */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-orange-500/20">
        <div className="absolute -right-12 -top-12 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 bg-white/5 rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm shadow-inner flex-shrink-0">
              <CurrentIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-1">Current Plan</p>
              <h3 className="text-5xl font-black mb-1">{currentTier.name}</h3>
              <p className="text-orange-200 font-semibold">{currentTier.price}<span className="text-orange-300 text-sm">{currentTier.period}</span></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-orange-200" />
              <div>
                <p className="text-orange-200 text-xs font-bold">Next Renewal</p>
                <p className="text-white font-black text-lg">23 Jul 2026</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-300" />
              <div>
                <p className="text-orange-200 text-xs font-bold">Status</p>
                <p className="text-white font-black text-lg">Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap gap-3 mt-8 pt-8 border-t border-white/20">
          <button onClick={() => setModal('upgrade')} className="flex items-center gap-2 bg-white text-orange-600 px-7 py-3 rounded-full font-bold hover:bg-orange-50 transition-colors shadow-md">
            <TrendingUp className="w-4 h-4" /> Upgrade Plan
          </button>
          <button onClick={() => setModal('renew')} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-7 py-3 rounded-full font-bold backdrop-blur-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> Renew Early
          </button>
          <button onClick={() => setModal('cancel')} className="flex items-center gap-2 bg-transparent hover:bg-white/10 text-orange-200 hover:text-white px-7 py-3 rounded-full font-bold transition-colors ml-auto">
            <X className="w-4 h-4" /> Cancel Membership
          </button>
        </div>
      </div>

      {/* Membership Benefits */}
      <div className="bg-white rounded-[2rem] border border-gray-200 p-10 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Your {currentTier.name} Benefits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {currentTier.features.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <CheckCircle2 className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <span className="text-sm font-bold text-gray-800">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Options */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Upgrade Options</h3>
          <span className="text-xs text-gray-400 font-semibold">Currently on Silver</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.filter(t => !t.current).map((tier, i) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-3xl border border-gray-200 hover:border-orange-300 hover:shadow-lg p-8 flex flex-col transition-all"
              >
                <div className={`w-12 h-12 ${tier.color} rounded-xl flex items-center justify-center mb-4 shadow-sm`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-xl font-black text-gray-900 mb-1">{tier.name}</h4>
                <p className="text-3xl font-black text-gray-900 mb-1">{tier.price}<span className="text-gray-400 text-sm font-semibold">{tier.period}</span></p>
                <div className="flex-1 my-6 space-y-3 border-t border-gray-100 pt-6">
                  {tier.features.slice(0, 4).map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <span className="text-gray-600 font-medium">{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setModal('upgrade')} className="w-full py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-md shadow-orange-500/20 flex items-center justify-center gap-2">
                  Upgrade to {tier.name} <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Membership History */}
      <div className="bg-white rounded-[2rem] border border-gray-200 p-10 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 mb-8">Membership History</h3>
        <div className="space-y-2">
          {HISTORY.map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">{item.action}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3" /> {item.date}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-black text-gray-900">{item.amount}</p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {modal === 'upgrade' && (
                <>
                  <TrendingUp className="w-12 h-12 text-orange-500 mb-6" />
                  <h3 className="text-2xl font-black text-gray-900 mb-3">Upgrade Your Plan</h3>
                  <p className="text-gray-500 mb-8">Choose a higher tier to unlock more features, more products, and more support across the MCOM Ecosystem.</p>
                  <button onClick={() => setModal(null)} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors">View Upgrade Options</button>
                </>
              )}
              {modal === 'renew' && (
                <>
                  <RefreshCw className="w-12 h-12 text-orange-500 mb-6" />
                  <h3 className="text-2xl font-black text-gray-900 mb-3">Renew Early</h3>
                  <p className="text-gray-500 mb-4">Renew your Silver membership now and extend your billing cycle.</p>
                  <div className="bg-orange-50 rounded-2xl p-6 mb-8 border border-orange-100">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-600">Silver Membership</span><span className="text-gray-900">£99.00</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold mt-2">
                      <span className="text-gray-600">New Renewal Date</span><span className="text-orange-600">23 Aug 2026</span>
                    </div>
                  </div>
                  <button onClick={() => setModal(null)} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors">Confirm Renewal — £99</button>
                </>
              )}
              {modal === 'cancel' && (
                <>
                  <AlertCircle className="w-12 h-12 text-red-400 mb-6" />
                  <h3 className="text-2xl font-black text-gray-900 mb-3">Cancel Membership</h3>
                  <p className="text-gray-500 mb-8">Are you sure? Cancelling will remove your access to all MCOM platforms at the end of your current billing period (23 Jul 2026).</p>
                  <div className="flex gap-3">
                    <button onClick={() => setModal(null)} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-bold transition-colors">Keep My Plan</button>
                    <button onClick={() => setModal(null)} className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition-colors">Confirm Cancel</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
