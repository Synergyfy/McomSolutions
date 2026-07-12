import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown, CheckCircle2, Star, Zap, Shield, ArrowUpRight,
  CalendarDays, Clock, ChevronRight, AlertCircle, TrendingUp, X, RefreshCw
} from 'lucide-react';
import { useProfile } from '../services/business/hooks';
import { useTransactions, useSubscribeMembership } from '../services/pricing/hooks';

const TIERS = [
  {
    name: 'Bronze',
    icon: Star,
    price: '£10',
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
    price: '£75',
    period: '/month',
    color: 'bg-orange-500',
    ring: 'ring-orange-500',
    highlight: 'text-orange-600',
    bg: 'bg-orange-100',
    features: ['Premium Storefront', 'Priority Support (12hr)', 'Up to 1,000 products', 'Advanced Analytics', 'MCOM Rewards Basic', 'MCOM Spin Access'],
  },
  {
    name: 'Gold',
    icon: Crown,
    price: '£350',
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
    price: '£1200',
    period: '/month',
    color: 'bg-gray-700',
    ring: 'ring-gray-700',
    highlight: 'text-gray-700',
    bg: 'bg-gray-100',
    features: ['White-label Solutions', 'Personal Account Manager', 'Full API Access', 'Complete Ecosystem Access', 'Audit & Expo VIP Priority', 'SLA Guarantee'],
  },
];

type ModalType = 'upgrade' | 'renew' | 'cancel' | null;

export default function DashboardMemberships() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: transactions = [], isLoading: txLoading } = useTransactions();
  const { mutateAsync: subscribeMembership } = useSubscribeMembership();
  const loading = profileLoading || txLoading;
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async (level: string) => {
    setUpgrading(true);
    try {
      await subscribeMembership({ level, tier: 'Normal' });
      setModal(null);
      setSelectedUpgrade(null);
    } catch (err: any) {
      alert('Upgrade failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-semibold">Loading membership info...</p>
      </div>
    );
  }

  const currentLevelName = profile?.membershipLevel || 'Bronze';
  const currentTier = TIERS.find(t => t.name.toLowerCase() === currentLevelName.toLowerCase()) || TIERS[0];
  const CurrentIcon = currentTier.icon;

  const nextRenewalDate = new Date();
  nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
  const renewalDateStr = nextRenewalDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1">My Membership</h2>
        <p className="text-gray-500">Manage your central MCOM Ecosystem subscription.</p>
      </div>

      {/* Current Membership Hero Card */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2rem] p-6 md:p-10 text-white relative overflow-hidden shadow-2xl shadow-orange-500/20">
        <div className="absolute -right-12 -top-12 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 bg-white/5 rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm shadow-inner flex-shrink-0">
              <CurrentIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-1">Current Plan</p>
              <h3 className="text-4xl md:text-5xl font-black mb-1">{currentTier.name}</h3>
              <p className="text-orange-200 font-semibold">{currentTier.price}<span className="text-orange-300 text-sm">{currentTier.period}</span></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 md:gap-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 md:p-5 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-orange-200" />
              <div>
                <p className="text-orange-200 text-xs font-bold">Next Renewal</p>
                <p className="text-white font-black text-sm md:text-lg">{renewalDateStr}</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 md:p-5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-300" />
              <div>
                <p className="text-orange-200 text-xs font-bold">Status</p>
                <p className="text-white font-black text-lg">{profile?.membershipStatus?.toUpperCase() || 'ACTIVE'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap gap-3 mt-8 pt-8 border-t border-white/20">
          <button onClick={() => setModal('upgrade')} className="flex items-center gap-2 bg-white text-orange-600 px-7 py-3 rounded-full font-bold hover:bg-orange-50 transition-colors shadow-md">
            <TrendingUp className="w-4 h-4" /> Change / Upgrade Plan
          </button>
          <button onClick={() => setModal('renew')} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-7 py-3 rounded-full font-bold backdrop-blur-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> Renew Early
          </button>
        </div>
      </div>

      {/* Membership Benefits */}
      <div className="bg-white rounded-[2rem] border border-gray-200 p-5 md:p-10 shadow-sm">
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
          <span className="text-xs text-gray-400 font-semibold">Currently on {currentTier.name}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.filter(t => t.name.toLowerCase() !== currentTier.name.toLowerCase()).map((tier, i) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white rounded-3xl border border-gray-200 hover:border-orange-300 hover:shadow-lg p-5 md:p-8 flex flex-col transition-all"
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
                <button
                  onClick={() => {
                    setSelectedUpgrade(tier.name);
                    setModal('upgrade');
                  }}
                  className="w-full py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-md shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  Select {tier.name} <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Membership History */}
      <div className="bg-white rounded-[2rem] border border-gray-200 p-5 md:p-10 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900 mb-8">Membership History</h3>
        {transactions.length === 0 ? (
          <p className="text-gray-500 font-semibold text-center py-6">No subscription transactions found.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm">{item.description}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-gray-900">£{item.amount}</p>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => {
              if (!upgrading) setModal(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-10 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {modal === 'upgrade' && (
                <>
                  <Crown className="w-12 h-12 text-orange-500 mb-6" />
                  <h3 className="text-2xl font-black text-gray-900 mb-3">
                    {selectedUpgrade ? `Upgrade to ${selectedUpgrade}` : 'Change Membership Plan'}
                  </h3>
                  <p className="text-gray-500 mb-8">
                    {selectedUpgrade
                      ? `Confirm your upgrade to the ${selectedUpgrade} tier. Access limits across the ecosystem platforms will be upgraded instantly.`
                      : 'Please select an upgrade option from the dashboard to continue.'}
                  </p>
                  {selectedUpgrade && (
                    <button
                      disabled={upgrading}
                      onClick={() => handleUpgrade(selectedUpgrade)}
                      className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors disabled:opacity-50"
                    >
                      {upgrading ? 'Upgrading...' : `Confirm & Subscribe`}
                    </button>
                  )}
                </>
              )}
              {modal === 'renew' && (
                <>
                  <RefreshCw className="w-12 h-12 text-orange-500 mb-6" />
                  <h3 className="text-2xl font-black text-gray-900 mb-3">Renew Early</h3>
                  <p className="text-gray-500 mb-4">Renew your {currentTier.name} membership now to extend your billing cycle.</p>
                  <div className="bg-orange-50 rounded-2xl p-6 mb-8 border border-orange-100">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-600">{currentTier.name} Membership</span>
                      <span className="text-gray-900">{currentTier.price}</span>
                    </div>
                  </div>
                  <button
                    disabled={upgrading}
                    onClick={() => handleUpgrade(currentTier.name)}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors disabled:opacity-50"
                  >
                    {upgrading ? 'Processing...' : `Confirm Renewal`}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

