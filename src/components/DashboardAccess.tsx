import React from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, Lock, Unlock, Crown,
  Gift, Dices, Store, FileSearch, UsersRound, Zap, AlertCircle
} from 'lucide-react';

const LIMITS = [
  { platform: 'MCOM Rewards', metric: 'Rewards created in MCOM Rewards', current: 3, max: 5, color: 'bg-orange-500', icon: Gift },
  { platform: 'MCOM Spin', metric: 'Campaigns in MCOM Spin', current: 4, max: 6, color: 'bg-amber-500', icon: Dices },
  { platform: 'MCOM Mall', metric: 'Listing in Mall', current: 2, max: 20, color: 'bg-sky-500', icon: Store },
];

const PLATFORMS = [
  { name: 'MCOM Rewards', access: true, reason: 'Included in Silver Membership', icon: Gift },
  { name: 'MCOM Spin', access: true, reason: 'Active Starter Package', icon: Dices },
  { name: 'MCOM Mall', access: true, reason: 'Active Standard Package', icon: Store },
  { name: '247GBS Audit', access: false, reason: 'Package Expired', icon: FileSearch },
  { name: '247GBS Expo', access: false, reason: 'Package Pending Activation', icon: UsersRound },
];

export default function DashboardAccess() {
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
          <div className="flex-1">
            <h3 className="text-2xl font-black text-gray-900 mb-1">Frank's Access Level</h3>
            <p className="text-gray-500">You are an <span className="font-bold text-gray-900">Administrator</span> for your Business Account.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Base Level</p>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-gray-900" />
                <span className="font-black text-gray-900">Silver</span>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Add-ons</p>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-gray-900" />
                <span className="font-black text-gray-900">3 Active</span>
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
            {PLATFORMS.map((p, i) => {
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
            {LIMITS.map((limit, i) => {
              const percentage = (limit.current / limit.max) * 100;
              const Icon = limit.icon;
              const isNearing = percentage >= 80;
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
                      animate={{ width: `${percentage}%` }}
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
