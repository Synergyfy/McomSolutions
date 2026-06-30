import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Dices, Store, FileSearch, UsersRound,
  CheckCircle2, AlertCircle, Clock, Plus, RefreshCw, X,
  TrendingUp, ArrowUpRight, ChevronRight, PackageOpen
} from 'lucide-react';
import { businessApi } from '../lib/api';

type PkgStatus = 'active' | 'expired' | 'pending';

interface Pkg {
  id: string;
  platform: string;
  icon: any;
  iconColor: string;
  tier: string;
  price: string;
  status: PkgStatus;
  renewDate?: string;
  features: string[];
}

const AVAILABLE_PLANS = [
  { platform: 'MCOM Rewards', icon: Gift, color: 'bg-orange-500', tier: 'Standard', price: '£79/mo', features: ['Advanced Points Engine', 'Custom Rewards', 'Tiered VIP Levels', 'Priority Support'] },
  { platform: 'MCOM Spin', icon: Dices, color: 'bg-amber-500', tier: 'Starter', price: '£19/mo', features: ['Standard Wheel Design', 'Basic Data Capture', '1,000 spins/mo', 'Email Support'] },
  { platform: 'MCOM Mall', icon: Store, color: 'bg-sky-500', tier: 'Standard', price: '£99/mo', features: ['Premium Themes', 'Abandoned Cart Recovery', 'Advanced SEO', '1,000 Products'] },
  { platform: '247GBS Audit', icon: FileSearch, color: 'bg-indigo-500', tier: 'Starter', price: '£99/mo', features: ['Excess Stock Listing', 'Standard Visibility', 'Basic Support'] },
  { platform: '247GBS Expo', icon: UsersRound, color: 'bg-cyan-500', tier: 'Standard', price: '£149/mo', features: ['Premium 3D Booth', 'Advanced Networking', 'Lead Export', 'Analytics'] },
];

const STATUS_CONFIG: Record<PkgStatus, { label: string; bg: string; text: string; icon: any }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  expired: { label: 'Expired', bg: 'bg-red-100', text: 'text-red-600', icon: AlertCircle },
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
};

type Filter = 'all' | PkgStatus;
type ModalType = 'upgrade' | 'renew' | 'cancel' | 'purchase' | null;

export default function DashboardPackages() {
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedPkg, setSelectedPkg] = useState<any | null>(null);
  const [activePackages, setActivePackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const profile = await businessApi.getProfile();
      // map active platform packages
      const list = (profile.packages || []).map((pkg: any) => {
        const matchingPlan = AVAILABLE_PLANS.find(p => p.platform.toLowerCase() === pkg.platformName.toLowerCase());
        const renewDateStr = new Date();
        renewDateStr.setMonth(renewDateStr.getMonth() + 1);

        return {
          id: pkg.id,
          platform: pkg.platformName,
          icon: matchingPlan?.icon || Gift,
          iconColor: matchingPlan?.color || 'bg-orange-500',
          tier: pkg.packageName,
          price: matchingPlan?.price || '£49/mo',
          status: 'active' as PkgStatus,
          renewDate: renewDateStr.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          features: matchingPlan?.features || ['Central ecosystem access'],
        };
      });
      setActivePackages(list);
    } catch (err) {
      console.error('Failed to load packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (platformName: string, packageName: string) => {
    setBuying(true);
    try {
      await businessApi.purchasePackage(platformName, packageName);
      await loadPackages();
      setModal(null);
      setSelectedPkg(null);
    } catch (err: any) {
      alert('Purchase failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-semibold">Loading platform packages...</p>
      </div>
    );
  }

  const visible = filter === 'all' ? activePackages : activePackages.filter(p => p.status === filter);

  const counts = {
    all: activePackages.length,
    active: activePackages.filter(p => p.status === 'active').length,
    expired: activePackages.filter(p => p.status === 'expired').length,
    pending: activePackages.filter(p => p.status === 'pending').length,
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: `Active (${counts.all})` },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">My Packages</h2>
          <p className="text-gray-500">Manage your platform-specific add-ons and subscriptions.</p>
        </div>
        <button
          onClick={() => setModal('purchase')}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-7 py-4 rounded-full font-bold transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-5 h-5" /> Purchase / Activate Add-on
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-6 py-2.5 rounded-full font-bold text-sm bg-orange-500 text-white shadow-md shadow-orange-500/20"
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Package Cards */}
      {activePackages.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-200">
          <PackageOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-bold text-gray-700">No Add-on Packages Activated Yet</h4>
          <p className="text-gray-500 text-sm mb-6">Unlock additional platforms in the MCOM and 247GBS Ecosystems.</p>
          <button
            onClick={() => setModal('purchase')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition shadow-md shadow-orange-500/25"
          >
            Browse Add-on Packages
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {visible.map((pkg, i) => {
              const Icon = pkg.icon;
              const status = STATUS_CONFIG[pkg.status];
              const StatusIcon = status.icon;
              return (
                <motion.div
                  key={pkg.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-[2rem] border border-gray-200 p-5 md:p-8 flex flex-col transition-all hover:border-orange-300 hover:shadow-lg"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 ${pkg.iconColor} rounded-2xl flex items-center justify-center shadow-md flex-shrink-0`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 text-lg">{pkg.platform}</h4>
                        <span className="text-sm font-bold text-orange-500">{pkg.tier} Plan</span>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black ${status.bg} ${status.text}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-6 pb-6 border-b border-gray-100">
                    <span className="text-3xl font-black text-gray-900">{pkg.price}</span>
                    {pkg.renewDate && <span className="text-xs text-gray-400 font-semibold">Renews {pkg.renewDate}</span>}
                  </div>

                  {/* Features */}
                  <div className="flex-1 space-y-3 mb-8">
                    {pkg.features.map((f, fi) => (
                      <div key={fi} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600 font-medium">{f}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal === 'purchase' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => {
              if (!buying) setModal(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-gray-900">Purchase Platform Add-ons</h3>
                <button onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-full transition">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {AVAILABLE_PLANS.filter(plan => !activePackages.some(ap => ap.platform.toLowerCase() === plan.platform.toLowerCase())).map((plan, idx) => {
                  const Icon = plan.icon;
                  return (
                    <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-gray-50 border border-gray-200 rounded-2xl gap-4 hover:border-orange-200 transition">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 ${plan.color} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900">{plan.platform}</h4>
                          <p className="text-xs text-orange-500 font-bold mb-2">{plan.tier} Plan — {plan.price}</p>
                          <div className="flex flex-wrap gap-2">
                            {plan.features.slice(0, 2).map((f, fi) => (
                              <span key={fi} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{f}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        disabled={buying}
                        onClick={() => handlePurchase(plan.platform, plan.tier)}
                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold text-sm transition shadow-md shadow-orange-500/10 shrink-0 disabled:opacity-50"
                      >
                        {buying ? 'Activating...' : 'Activate Add-on'}
                      </button>
                    </div>
                  );
                })}
                {AVAILABLE_PLANS.filter(plan => !activePackages.some(ap => ap.platform.toLowerCase() === plan.platform.toLowerCase())).length === 0 && (
                  <p className="text-center py-6 text-gray-500 font-bold">You have purchased all available platform add-ons!</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
