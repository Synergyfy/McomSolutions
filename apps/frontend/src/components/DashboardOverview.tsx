import React from 'react';
import { motion } from 'motion/react';
import {
  Crown, PackageOpen, LayoutGrid, Activity, Bell,
  CheckCircle2, Zap, CreditCard, HeadphonesIcon,
  ArrowUpRight, Gift, Dices, Store, FileSearch, UsersRound, Link2, AlertCircle, TrendingUp
} from 'lucide-react';

import { businessApi } from '../lib/api';

const myPlatforms = [
  { name: 'MCOM Rewards', icon: Gift, color: 'bg-orange-500' },
  { name: 'MCOM Spin', icon: Dices, color: 'bg-amber-500' },
  { name: 'MCOM Mall', icon: Store, color: 'bg-sky-500' },
];

const platformStyles: Record<string, { name: string; color: string; price: string }> = {
  Rewards: { name: 'MCOM Rewards', color: 'bg-orange-100 text-orange-600', price: '£79/mo' },
  Spin: { name: 'MCOM Spin', color: 'bg-amber-100 text-amber-600', price: '£19/mo' },
  Mall: { name: 'MCOM Mall', color: 'bg-sky-100 text-sky-600', price: '£99/mo' },
  Audit: { name: 'GBS Audit', color: 'bg-emerald-100 text-emerald-600', price: '£49/mo' },
  Expo: { name: 'GBS Expo', color: 'bg-purple-100 text-purple-600', price: '£149/mo' },
};

const recentActivity = [
  { action: 'Invoice paid', detail: 'Membership Active', time: 'Just now', type: 'success' },
  { action: 'Lead engine active', detail: 'Central platform link connected', time: 'Just now', type: 'info' },
];

const notifications = [
  { message: 'Welcome to MCOM central hub — verify your packages', type: 'info' },
];

const quickActions = [
  { label: 'Upgrade Plan', icon: Crown, variant: 'primary' },
  { label: 'Manage Billing', icon: CreditCard, variant: 'secondary' },
  { label: 'Add Package', icon: PackageOpen, variant: 'secondary' },
  { label: 'Get Support', icon: HeadphonesIcon, variant: 'secondary' },
];

export default function DashboardOverview({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const userRaw = localStorage.getItem('business_user');
  let displayName = 'Partner';
  if (userRaw) {
    try {
      const user = JSON.parse(userRaw);
      displayName = user.firstName || user.name || user.email?.split('@')[0] || 'Partner';
    } catch (e) {
      console.error(e);
    }
  }

  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let isMounted = true;
    businessApi.getProfile()
      .then(data => {
        if (isMounted) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Error fetching profile in DashboardOverview:', err);
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  const membershipLevel = profile?.membershipLevel || 'Bronze';
  const activePackagesCount = profile?.packages?.length || 0;
  
  const priceMap: Record<string, string> = {
    Bronze: '£0',
    Silver: '£99',
    Gold: '£199',
    Platinum: '£399',
  };
  const planPrice = priceMap[membershipLevel] || '£0';

  const formatRenewalDate = () => {
    const baseDate = profile?.createdAt ? new Date(profile.createdAt) : new Date();
    baseDate.setMonth(baseDate.getMonth() + 1);
    return baseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Good morning, {displayName} 👋</h2>
        <p className="text-gray-500">Here's your ecosystem at a glance.</p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* My Membership - Large Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-orange-500/20">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -right-4 bottom-0 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-2">My Membership</p>
                <h3 className="text-3xl md:text-4xl font-black mb-1">{loading ? '...' : membershipLevel}</h3>
                <p className="text-orange-200 text-sm font-medium">Renews {loading ? '...' : formatRenewalDate()}</p>
              </div>
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                <Crown className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-4 md:gap-6">
                <div><div className="text-xl md:text-2xl font-black">{loading ? '...' : activePackagesCount}</div><div className="text-orange-200 text-xs font-bold">Active Packages</div></div>
                <div><div className="text-xl md:text-2xl font-black">{loading ? '...' : planPrice}</div><div className="text-orange-200 text-xs font-bold">Per Month</div></div>
              </div>
              <button
                onClick={() => onNavigate?.('memberships')}
                className="bg-white text-orange-600 px-6 py-3 rounded-full font-bold text-sm hover:bg-orange-50 transition-colors flex items-center gap-2 shadow-md"
              >
                Manage <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 md:mb-6">Subscription Status</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700">Membership</span>
              <span className="flex items-center gap-1.5 text-green-600 font-bold text-sm"><CheckCircle2 className="w-4 h-4" /> Active</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700">Rewards</span>
              <span className="flex items-center gap-1.5 text-green-600 font-bold text-sm"><CheckCircle2 className="w-4 h-4" /> Active</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700">Mall</span>
              <span className="flex items-center gap-1.5 text-amber-600 font-bold text-sm"><AlertCircle className="w-4 h-4" /> Renewing</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700">Spin</span>
              <span className="flex items-center gap-1.5 text-green-600 font-bold text-sm"><CheckCircle2 className="w-4 h-4" /> Active</span>
            </div>
          </div>
        </div>

        {/* My Platforms */}
        <div className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">My Platforms</p>
            <button onClick={() => onNavigate?.('all-products')} className="text-orange-500 text-xs font-bold hover:underline flex items-center gap-1">View All <ArrowUpRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-4">
            {myPlatforms.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.name} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer group">
                  <div className={`w-10 h-10 ${p.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-gray-800 text-sm">{p.name}</span>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-orange-500 transition-colors" />
                </div>
              );
            })}
          </div>
        </div>

        {/* My Packages */}
        <div className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">My Packages</p>
            <button onClick={() => onNavigate?.('packages')} className="text-orange-500 text-xs font-bold hover:underline flex items-center gap-1">Manage <ArrowUpRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-xs py-4 text-center">Loading packages...</p>
            ) : profile?.packages && profile.packages.length > 0 ? (
              profile.packages.map((pkg: any) => {
                const style = platformStyles[pkg.platform] || { name: `MCOM ${pkg.platform}`, color: 'bg-gray-100 text-gray-600', price: 'Free' };
                return (
                  <div key={pkg.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{style.name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.color}`}>{pkg.packageName}</span>
                    </div>
                    <span className="font-black text-gray-900 text-sm">{style.price}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-400 text-xs mb-3">No active packages</p>
                <button
                  onClick={() => onNavigate?.('packages')}
                  className="text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl transition-colors border border-gray-200"
                >
                  Activate Packages
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 md:mb-6">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => action.label.includes('Plan') ? onNavigate?.('memberships') : action.label.includes('Package') ? onNavigate?.('packages') : null}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl font-bold text-sm transition-all active:scale-95 ${
                    action.variant === 'primary'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mcom Partner Card */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl hover:shadow-2xl transition-shadow cursor-pointer" onClick={() => onNavigate?.('partner')}>
          <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">Mcom Partner</h3>
            <p className="text-purple-100 mb-4">Access partner tools, manage referrals, and grow your business.</p>
            <button className="bg-white text-purple-600 px-4 py-2 rounded-full font-semibold hover:bg-purple-50 transition-colors">
              Go to Partner Portal
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Recent Activity</p>
            <TrendingUp className="w-5 h-5 text-gray-300" />
          </div>
          <div className="space-y-1">
            {recentActivity.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  item.type === 'success' ? 'bg-green-500' :
                  item.type === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm">{item.action}</p>
                  <p className="text-xs text-gray-400 truncate">{item.detail}</p>
                </div>
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{item.time}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Notifications</p>
            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{notifications.length}</span>
          </div>
          <div className="space-y-4">
            {notifications.map((n, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl ${
                n.type === 'success' ? 'bg-green-50' :
                n.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'
              }`}>
                <Bell className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  n.type === 'success' ? 'text-green-500' :
                  n.type === 'warning' ? 'text-amber-500' : 'text-blue-400'
                }`} />
                <p className="text-sm font-medium text-gray-700">{n.message}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
