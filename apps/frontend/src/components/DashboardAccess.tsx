import React from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, Lock, Unlock, Crown,
  Gift, Dices, Store, FileSearch, UsersRound, Zap, AlertCircle, ShoppingBag, Shield
} from 'lucide-react';
import { useProfile, useEcosystemApps } from '../services/business/hooks';
import { useSubscriptions } from '../services/pricing/hooks';

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  rewards: Gift,
  spin: Dices,
  mall: Store,
  audit: FileSearch,
  expo: UsersRound,
  loyalty: ShoppingBag,
};

const DEFAULT_PLATFORMS = [
  { id: 'rewards', name: 'MCOM Rewards', icon: Gift },
  { id: 'spin', name: 'MCOM Spin', icon: Dices },
  { id: 'mall', name: 'MCOM Mall', icon: Store },
  { id: 'audit', name: '247GBS Audit', icon: FileSearch },
  { id: 'expo', name: '247GBS Expo', icon: UsersRound },
];

export default function DashboardAccess() {
  const { data: profile } = useProfile();
  const { data: subscriptions } = useSubscriptions();
  const { data: ecosystemApps = [] } = useEcosystemApps();

  const userRaw = localStorage.getItem('business_user');
  let displayName = profile?.businessName || '';
  if (!displayName && userRaw) {
    try {
      const user = JSON.parse(userRaw);
      displayName = user.businessName || user.firstName || user.name || user.email?.split('@')[0] || '';
    } catch (e) {
      console.error(e);
    }
  }
  if (!displayName) displayName = 'Business Account';

  const memberLevel = profile?.membershipLevel || 'Bronze';
  const memberLevelLower = memberLevel.toLowerCase();

  const activePackages = (subscriptions?.packages || []).filter(
    (p: any) => p.status?.toUpperCase() === 'ACTIVE'
  );
  const activeCount = activePackages.length;

  // Compute platform access based on membership tier + active package subscriptions
  const platformList = ecosystemApps.length > 0
    ? ecosystemApps.map((app: any) => {
        const key = app.slug || app.name?.toLowerCase() || '';
        const matchingIcon = Object.keys(PLATFORM_ICONS).find(k => key.includes(k));
        return {
          id: app.id || app.slug,
          name: app.name || 'Ecosystem App',
          icon: matchingIcon ? PLATFORM_ICONS[matchingIcon] : Zap,
        };
      })
    : DEFAULT_PLATFORMS;

  const accessList = platformList.map((p: any) => {
    const key = (p.id || p.name).toLowerCase();
    const hasActiveSub = activePackages.some(
      (pkg: any) => (pkg.platformPackage?.platform || pkg.platform || '').toLowerCase().includes(key)
    );

    let isIncludedInTier = false;
    if (memberLevelLower === 'platinum') {
      isIncludedInTier = true;
    } else if (memberLevelLower === 'gold') {
      isIncludedInTier = key.includes('rewards') || key.includes('spin') || key.includes('mall');
    } else if (memberLevelLower === 'silver') {
      isIncludedInTier = key.includes('rewards') || key.includes('spin');
    } else {
      isIncludedInTier = key.includes('rewards');
    }

    const hasAccess = hasActiveSub || isIncludedInTier;
    const reason = hasActiveSub
      ? 'Active Package Subscription'
      : isIncludedInTier
      ? `Included in ${memberLevel} Membership`
      : 'Subscription required to unlock';

    return {
      name: p.name,
      icon: p.icon,
      access: hasAccess,
      reason,
    };
  });

  // Dynamic limits based on membership tier
  const limits = [
    {
      metric: 'Storefront Products Allowed',
      current: memberLevelLower === 'platinum' ? 'Unlimited' : memberLevelLower === 'gold' ? '1,240' : memberLevelLower === 'silver' ? '150' : '12',
      max: memberLevelLower === 'platinum' ? 'Unlimited' : memberLevelLower === 'gold' ? '10,000' : memberLevelLower === 'silver' ? '1,000' : '100',
      percentage: memberLevelLower === 'platinum' ? 10 : memberLevelLower === 'gold' ? 12 : memberLevelLower === 'silver' ? 15 : 12,
      color: 'bg-orange-500',
      icon: Store,
    },
    {
      metric: 'Marketing Campaigns in Spin & Rewards',
      current: memberLevelLower === 'platinum' ? 'Unlimited' : memberLevelLower === 'gold' ? '8' : memberLevelLower === 'silver' ? '3' : '1',
      max: memberLevelLower === 'platinum' ? 'Unlimited' : memberLevelLower === 'gold' ? '20' : memberLevelLower === 'silver' ? '6' : '2',
      percentage: memberLevelLower === 'platinum' ? 15 : memberLevelLower === 'gold' ? 40 : memberLevelLower === 'silver' ? 50 : 50,
      color: 'bg-amber-500',
      icon: Dices,
    },
    {
      metric: 'Active Ecosystem Connections',
      current: `${Math.max(1, activeCount + 1)}`,
      max: memberLevelLower === 'platinum' ? 'All' : memberLevelLower === 'gold' ? '10' : memberLevelLower === 'silver' ? '5' : '2',
      percentage: Math.min(100, Math.round(((activeCount + 1) / (memberLevelLower === 'silver' ? 5 : 2)) * 100)),
      color: 'bg-sky-500',
      icon: Gift,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Access & Permissions</h2>
        <p className="text-gray-500">A complete view of your ecosystem access rights and limits.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Summary */}
        <div className="lg:col-span-3 bg-white rounded-[2rem] border border-gray-200 p-5 md:p-8 shadow-sm flex flex-col md:flex-row items-center gap-6 md:gap-8">
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-10 h-10 text-orange-500" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-black text-gray-900 mb-1">{displayName}'s Access Level</h3>
            <p className="text-gray-500">You are an <span className="font-bold text-gray-900">Administrator</span> for your Business Account.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Base Level</p>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-gray-900" />
                <span className="font-black text-gray-900">{memberLevel}</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Add-ons</p>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-gray-900" />
                <span className="font-black text-gray-900">{activeCount} Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Access Matrix */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-gray-200 p-5 md:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Unlock className="w-5 h-5 text-orange-500" /> Platform Access Rights
          </h3>
          <div className="divide-y divide-gray-100">
            {accessList.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${p.access ? 'bg-orange-50 text-orange-500' : 'bg-gray-50 text-gray-400'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${p.access ? 'text-gray-900' : 'text-gray-500'}`}>{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.reason}</p>
                    </div>
                  </div>
                  <div>
                    {p.access ? (
                      <span className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                        <Unlock className="w-3.5 h-3.5" /> Granted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 bg-red-50 text-red-500 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                        <Lock className="w-3.5 h-3.5" /> Denied
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Limits */}
        <div className="bg-white rounded-[2rem] border border-gray-200 p-5 md:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" /> Feature Limits
          </h3>
          <div className="space-y-8">
            {limits.map((limit, i) => {
              const Icon = limit.icon;
              const isNearing = limit.percentage >= 80;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="font-bold text-gray-800 text-sm">{limit.metric}</span>
                    </div>
                    <span className="font-black text-gray-900 text-sm">{limit.current} <span className="text-gray-400">/ {limit.max}</span></span>
                  </div>
                  <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${limit.percentage}%` }}
                      transition={{ duration: 1, delay: i * 0.2 }}
                      className={`h-full rounded-full ${isNearing ? 'bg-red-500' : limit.color}`}
                    />
                  </div>
                  {isNearing && <p className="text-[10px] font-bold text-red-500 mt-2 uppercase tracking-widest">Approaching Limit</p>}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

