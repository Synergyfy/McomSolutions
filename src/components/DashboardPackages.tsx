import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Dices, Store, FileSearch, UsersRound,
  CheckCircle2, AlertCircle, Clock, Plus, RefreshCw, X,
  TrendingUp, ArrowUpRight, ChevronRight, PackageOpen
} from 'lucide-react';

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
  expiredDate?: string;
  pendingDate?: string;
  features: string[];
}

const PACKAGES: Pkg[] = [
  {
    id: 'rewards-std',
    platform: 'MCOM Rewards',
    icon: Gift,
    iconColor: 'bg-orange-500',
    tier: 'Standard',
    price: '£79/mo',
    status: 'active',
    renewDate: '23 Jul 2026',
    features: ['Advanced Points Engine', 'Custom Rewards', 'Tiered VIP Levels', 'Priority Support'],
  },
  {
    id: 'spin-start',
    platform: 'MCOM Spin',
    icon: Dices,
    iconColor: 'bg-amber-500',
    tier: 'Starter',
    price: '£19/mo',
    status: 'active',
    renewDate: '23 Jul 2026',
    features: ['Standard Wheel Design', 'Basic Data Capture', '1,000 spins/mo', 'Email Support'],
  },
  {
    id: 'mall-std',
    platform: 'MCOM Mall',
    icon: Store,
    iconColor: 'bg-sky-500',
    tier: 'Standard',
    price: '£99/mo',
    status: 'active',
    renewDate: '23 Jul 2026',
    features: ['Premium Themes', 'Abandoned Cart Recovery', 'Advanced SEO', '1,000 Products'],
  },
  {
    id: 'audit-old',
    platform: '247GBS Audit',
    icon: FileSearch,
    iconColor: 'bg-indigo-500',
    tier: 'Starter',
    price: '£99/mo',
    status: 'expired',
    expiredDate: '1 Jun 2026',
    features: ['Excess Stock Listing', 'Standard Visibility', 'Basic Support'],
  },
  {
    id: 'expo-pend',
    platform: '247GBS Expo',
    icon: UsersRound,
    iconColor: 'bg-cyan-500',
    tier: 'Standard',
    price: '£149/mo',
    status: 'pending',
    pendingDate: '1 Jul 2026',
    features: ['Premium 3D Booth', 'Advanced Networking', 'Lead Export', 'Analytics'],
  },
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
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);

  const visible = filter === 'all' ? PACKAGES : PACKAGES.filter(p => p.status === filter);

  const counts = {
    all: PACKAGES.length,
    active: PACKAGES.filter(p => p.status === 'active').length,
    expired: PACKAGES.filter(p => p.status === 'expired').length,
    pending: PACKAGES.filter(p => p.status === 'pending').length,
  };

  const openModal = (type: ModalType, pkg: Pkg) => {
    setSelectedPkg(pkg);
    setModal(type);
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'active', label: `Active (${counts.active})` },
    { id: 'expired', label: `Expired (${counts.expired})` },
    { id: 'pending', label: `Pending (${counts.pending})` },
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
          <Plus className="w-5 h-5" /> Purchase New Package
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${
              filter === f.id
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Package Cards */}
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
                className={`bg-white rounded-[2rem] border p-5 md:p-8 flex flex-col transition-all ${
                  pkg.status === 'expired' ? 'border-red-200 opacity-80' :
                  pkg.status === 'pending' ? 'border-amber-200' :
                  'border-gray-200 hover:border-orange-300 hover:shadow-lg'
                }`}
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
                  {pkg.expiredDate && <span className="text-xs text-red-400 font-semibold">Expired {pkg.expiredDate}</span>}
                  {pkg.pendingDate && <span className="text-xs text-amber-500 font-semibold">Starts {pkg.pendingDate}</span>}
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

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {pkg.status === 'active' && (
                    <>
                      <button onClick={() => openModal('upgrade', pkg)} className="flex-1 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20">
                        <TrendingUp className="w-4 h-4" /> Upgrade
                      </button>
                      <button onClick={() => openModal('cancel', pkg)} className="py-3 px-4 rounded-full border border-gray-200 hover:border-red-200 hover:bg-red-50 hover:text-red-500 text-gray-500 font-bold text-sm transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {pkg.status === 'expired' && (
                    <button onClick={() => openModal('renew', pkg)} className="flex-1 py-3 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-4 h-4" /> Renew Package
                    </button>
                  )}
                  {pkg.status === 'pending' && (
                    <div className="flex-1 py-3 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center gap-1.5 cursor-default">
                      <Clock className="w-4 h-4" /> Activating Soon
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
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
              className="bg-white rounded-3xl p-6 md:p-10 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {modal === 'upgrade' && selectedPkg && (
                <>
                  <TrendingUp className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Upgrade {selectedPkg.platform}</h3>
                  <p className="text-gray-500 mb-8">Move to a higher tier to unlock more capacity and features for {selectedPkg.platform}.</p>
                  <button onClick={() => setModal(null)} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors">View Upgrade Plans</button>
                </>
              )}
              {modal === 'renew' && selectedPkg && (
                <>
                  <RefreshCw className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Renew {selectedPkg.platform}</h3>
                  <p className="text-gray-500 mb-4">Reactivate your {selectedPkg.tier} package to restore platform access.</p>
                  <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-200">
                    <div className="flex justify-between text-sm font-bold"><span className="text-gray-600">{selectedPkg.tier} Package</span><span className="text-gray-900">{selectedPkg.price}</span></div>
                  </div>
                  <button onClick={() => setModal(null)} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold">Confirm Renewal</button>
                </>
              )}
              {modal === 'cancel' && selectedPkg && (
                <>
                  <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Cancel {selectedPkg.platform}</h3>
                  <p className="text-gray-500 mb-8">Cancelling will remove access to this platform at the end of the current billing period.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setModal(null)} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-bold transition-colors">Keep Package</button>
                    <button onClick={() => setModal(null)} className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition-colors">Confirm Cancel</button>
                  </div>
                </>
              )}
              {modal === 'purchase' && (
                <>
                  <PackageOpen className="w-12 h-12 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Purchase New Package</h3>
                  <p className="text-gray-500 mb-8">Browse all available platform packages and add them to your account.</p>
                  <button onClick={() => setModal(null)} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold flex items-center justify-center gap-2 transition-colors">
                    Browse Packages <ChevronRight className="w-4 h-4" />
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
