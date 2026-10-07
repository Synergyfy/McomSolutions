import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Dices, Store, FileSearch, UsersRound,
  CheckCircle2, AlertCircle, Clock, PackageOpen
} from 'lucide-react';
import { useProfile } from '../services/business/hooks';

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

export default function DashboardPackages() {
  const [filter, setFilter] = useState<Filter>('all');
  const [activePackages, setActivePackages] = useState<any[]>([]);
  const { data: profile, isLoading: loading } = useProfile();

  // Static catalogue metadata (icons/features) for packages owned on external
  // platforms. Packages themselves are bought on those platforms, not here.
  const availablePlans = AVAILABLE_PLANS;

  useEffect(() => {
    if (profile) {
      const list = (profile.packages || []).map((pkg: any) => {
        const matchingPlan = availablePlans.find((p: any) =>
          p.platform.toLowerCase() === (pkg.platformName || pkg.platform || '').toLowerCase() ||
          p.tier.toLowerCase() === (pkg.packageName || '').toLowerCase()
        );
        const renewDateStr = pkg.expiresAt ? new Date(pkg.expiresAt) : new Date(Date.now() + 30 * 86400000);

        return {
          id: pkg.id,
          platform: pkg.platformName || pkg.platform,
          icon: matchingPlan?.icon || Gift,
          iconColor: matchingPlan?.color || 'bg-orange-500',
          tier: pkg.packageName,
          price: matchingPlan?.price || (pkg.amount ? `£${pkg.amount}/mo` : '£49/mo'),
          status: (pkg.status?.toLowerCase() === 'active' ? 'active' : pkg.status?.toLowerCase() === 'expired' ? 'expired' : 'active') as PkgStatus,
          renewDate: renewDateStr.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          features: matchingPlan?.features || ['Central ecosystem access'],
        };
      });
      setActivePackages(list);
    } else {
      setActivePackages([]);
    }
  }, [profile, availablePlans]);

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
          <p className="text-gray-500">Packages you own on MCOM and 247GBS ecosystem platforms. New packages are purchased on each platform directly.</p>
        </div>
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
          <p className="text-gray-500 text-sm mb-6">Unlock additional platforms in the MCOM and 247GBS Ecosystems by purchasing on each platform.</p>
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
    </div>
  );
}
