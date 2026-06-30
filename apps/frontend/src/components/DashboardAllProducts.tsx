import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Gift, Dices, Store, FileSearch, UsersRound, Link2,
  ShoppingBag, Users, ShieldCheck, LayoutGrid, Rocket, ArrowUpRight,
  Sparkles, Lock
} from 'lucide-react';
import { businessApi } from '../lib/api';

type EcoKey = 'all' | 'mcom' | 'gbs';

const ALL_PLATFORMS = [
  {
    id: 'rewards',
    name: 'MCOM Rewards',
    tagline: 'Incentivise every interaction with a powerful loyalty engine.',
    icon: Gift,
    ecosystem: 'mcom',
    color: 'bg-orange-500',
    glow: 'shadow-orange-500/20',
    owned: true,
  },
  {
    id: 'spin',
    name: 'MCOM Spin',
    tagline: 'Gamified spin-to-win campaigns that capture leads at scale.',
    icon: Dices,
    ecosystem: 'mcom',
    color: 'bg-amber-500',
    glow: 'shadow-amber-500/20',
    owned: true,
  },
  {
    id: 'mall',
    name: 'MCOM Mall',
    tagline: 'A unified multi-vendor marketplace for modern commerce.',
    icon: Store,
    ecosystem: 'mcom',
    color: 'bg-sky-500',
    glow: 'shadow-sky-500/20',
    owned: true,
  },
  {
    id: 'link',
    name: 'MCOM Link',
    tagline: 'API-first integration layer bridging your business systems.',
    icon: Link2,
    ecosystem: 'mcom',
    color: 'bg-blue-700',
    glow: 'shadow-blue-700/20',
    owned: false,
  },
  {
    id: 'audit',
    name: '247GBS Audit',
    tagline: 'Real-time compliance, financial oversight, and anomaly detection.',
    icon: ShieldCheck,
    ecosystem: 'gbs',
    color: 'bg-indigo-600',
    glow: 'shadow-indigo-600/20',
    owned: false,
  },
  {
    id: 'expo',
    name: '247GBS Expo',
    tagline: 'End-to-end virtual and physical event management at scale.',
    icon: LayoutGrid,
    ecosystem: 'gbs',
    color: 'bg-cyan-500',
    glow: 'shadow-cyan-500/20',
    owned: false,
  },
  {
    id: 'loyalty',
    name: '247GBS Loyalty',
    tagline: 'Enterprise-grade retention and rewards for large scale operations.',
    icon: Users,
    ecosystem: 'gbs',
    color: 'bg-violet-600',
    glow: 'shadow-violet-600/20',
    owned: false,
  },
  {
    id: 'future-1',
    name: 'Coming Soon',
    tagline: 'A brand new MCOM platform is in development. Stay tuned.',
    icon: Sparkles,
    ecosystem: 'mcom',
    color: 'bg-gray-300',
    glow: '',
    owned: false,
    comingSoon: true,
  },
  {
    id: 'future-2',
    name: 'Coming Soon',
    tagline: 'Another 247GBS platform is on the way. Join the waitlist.',
    icon: Sparkles,
    ecosystem: 'gbs',
    color: 'bg-gray-300',
    glow: '',
    owned: false,
    comingSoon: true,
  },
];

const filters: { id: EcoKey; label: string }[] = [
  { id: 'all', label: 'All Platforms' },
  { id: 'mcom', label: 'MCOM Ecosystem' },
  { id: 'gbs', label: '247GBS Ecosystem' },
];

export default function DashboardAllProducts() {
  const [filter, setFilter] = useState<EcoKey>('all');

  const handleLaunch = async (platformId: string) => {
    if (platformId === 'mall') {
      try {
        const res = await businessApi.getSsoToken();
        const mcomMallUrl = import.meta.env.VITE_MCOM_MALL_URL || 'http://localhost:3002';
        const launchUrl = `${mcomMallUrl}/auth/sso?sso_token=${res.ssoToken}`;
        window.open(launchUrl, '_blank');
      } catch (err) {
        console.error('Failed to generate SSO token', err);
        alert('SSO Handshake failed. Please try again.');
      }
    } else {
      alert(`Launching ${platformId}... (Single Sign-On session active)`);
    }
  };

  const visible = filter === 'all' ? ALL_PLATFORMS : ALL_PLATFORMS.filter(p => p.ecosystem === filter);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Ecosystem Platform Directory</h2>
          <p className="text-gray-500">Every platform available to you across the MCOM &amp; 247GBS ecosystems.</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-full">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-200 ${
                filter === f.id
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {visible.map((platform, i) => {
          const Icon = platform.icon;
          return (
            <motion.div
              key={platform.id + filter}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`relative bg-white rounded-[2rem] border p-5 md:p-8 flex flex-col transition-all duration-200 ${
                platform.comingSoon
                  ? 'border-dashed border-gray-300 opacity-70'
                  : platform.owned
                  ? 'border-orange-200 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-500/10'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
              }`}
            >
              {/* Owned badge */}
              {platform.owned && !platform.comingSoon && (
                <div className="absolute top-6 right-6 bg-green-100 text-green-600 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                  Active
                </div>
              )}

              {/* Icon */}
              <div className={`w-16 h-16 ${platform.comingSoon ? 'bg-gray-100' : platform.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg ${platform.glow}`}>
                <Icon className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">{platform.name}</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed flex-1">{platform.tagline}</p>

              <div className="flex items-center gap-3 mt-auto">
                {platform.comingSoon ? (
                  <button disabled className="flex-1 py-3 rounded-full bg-gray-100 text-gray-400 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" /> Join Waitlist
                  </button>
                ) : platform.owned ? (
                  <>
                    <button 
                      onClick={() => handleLaunch(platform.id)}
                      className="flex-1 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors shadow-md shadow-orange-500/20 flex items-center justify-center gap-2"
                    >
                      <Rocket className="w-4 h-4" /> Launch
                    </button>
                    <button className="py-3 px-5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-sm transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="flex-1 py-3 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
                      <Lock className="w-4 h-4" /> Get Access
                    </button>
                    <button className="py-3 px-5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-sm transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
