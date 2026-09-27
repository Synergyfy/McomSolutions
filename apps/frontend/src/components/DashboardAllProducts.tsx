import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  Copy,
  Dices,
  ExternalLink,
  Gift,
  Grid,
  Link2,
  List,
  Loader2,
  PackageOpen,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  Store,
  UsersRound,
  AlertCircle,
  AppWindow,
  Contact2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGetSsoToken, usePostSsoAuthorize, useCurrentUser } from '../services/auth/hooks';
import { useEcosystemApps } from '../services/business/hooks';
import type { SsoClientListItem } from '../services/admin/types';

type EcoFilter = 'all' | 'mcom' | 'gbs' | 'system';
type ViewMode = 'grid' | 'table';

interface PlatformMeta {
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  theme: {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  };
  ecosystem: 'mcom' | 'gbs' | 'custom';
}

const PLATFORM_THEMES: Record<string, PlatformMeta> = {
  mall: {
    icon: Store,
    tagline: 'Multi-vendor digital marketplace for local and enterprise commerce.',
    theme: {
      bg: 'bg-sky-50',
      text: 'text-sky-600',
      border: 'border-sky-200/80',
      badgeBg: 'bg-sky-100',
      badgeText: 'text-sky-700',
    },
    ecosystem: 'mcom',
  },
  rewards: {
    icon: Gift,
    tagline: 'Dynamic loyalty engine, rewards campaigns, and member retention.',
    theme: {
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      border: 'border-orange-200/80',
      badgeBg: 'bg-orange-100',
      badgeText: 'text-orange-700',
    },
    ecosystem: 'mcom',
  },
  loyalty: {
    icon: Gift,
    tagline: 'Enterprise-grade retention and rewards for large-scale operations.',
    theme: {
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      border: 'border-orange-200/80',
      badgeBg: 'bg-orange-100',
      badgeText: 'text-orange-700',
    },
    ecosystem: 'mcom',
  },
  spin: {
    icon: Dices,
    tagline: 'Gamified spin-to-win campaigns to capture verified leads at scale.',
    theme: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-200/80',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-700',
    },
    ecosystem: 'mcom',
  },
  spin_local: {
    icon: Dices,
    tagline: 'Hyper-local gamified campaigns for retail storefronts and events.',
    theme: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-200/80',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-700',
    },
    ecosystem: 'mcom',
  },
  vcard: {
    icon: Contact2,
    tagline: 'Digital NFC & interactive business cards bridging connections instantly.',
    theme: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-200/80',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-700',
    },
    ecosystem: 'mcom',
  },
  links: {
    icon: Link2,
    tagline: 'Smart bio-links, route tracking, and unified business landing pages.',
    theme: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-200/80',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-700',
    },
    ecosystem: 'mcom',
  },
  partner: {
    icon: PackageOpen,
    tagline: 'Partner operations, merchant management, and referral networks.',
    theme: {
      bg: 'bg-teal-50',
      text: 'text-teal-600',
      border: 'border-teal-200/80',
      badgeBg: 'bg-teal-100',
      badgeText: 'text-teal-700',
    },
    ecosystem: 'mcom',
  },
  audit: {
    icon: ShieldCheck,
    tagline: 'Real-time compliance, financial oversight, and anomaly detection.',
    theme: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      border: 'border-indigo-200/80',
      badgeBg: 'bg-indigo-100',
      badgeText: 'text-indigo-700',
    },
    ecosystem: 'gbs',
  },
  '247gbs_affiliate': {
    icon: UsersRound,
    tagline: 'Affiliate commission engine, sales territories, and broker tools.',
    theme: {
      bg: 'bg-cyan-50',
      text: 'text-cyan-600',
      border: 'border-cyan-200/80',
      badgeBg: 'bg-cyan-100',
      badgeText: 'text-cyan-700',
    },
    ecosystem: 'gbs',
  },
};

function resolveAppMeta(app: SsoClientListItem): PlatformMeta {
  const slug = (app.platformSlug || '').toLowerCase();
  const id = app.clientId.toLowerCase();

  for (const [key, meta] of Object.entries(PLATFORM_THEMES)) {
    if (slug === key || id.includes(key)) {
      return meta;
    }
  }

  const isGbs = id.includes('gbs') || slug.includes('gbs');
  return {
    icon: AppWindow,
    tagline: app.description || 'Ecosystem application connected via MCOM Central.',
    theme: {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200/80',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-700',
    },
    ecosystem: isGbs ? 'gbs' : 'mcom',
  };
}

export default function DashboardAllProducts() {
  const { data: dbApps = [], isLoading, isError, refetch, isFetching } = useEcosystemApps();
  const { data: currentUser } = useCurrentUser();
  const { mutateAsync: getSsoToken } = useGetSsoToken();
  const { mutateAsync: postSsoAuthorize } = usePostSsoAuthorize();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EcoFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';

  const handleCopyId = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(clientId);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleLaunch = async (app: SsoClientListItem) => {
    setLaunchingId(app.clientId);
    setLaunchError(null);

    try {
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const slug = (app.platformSlug || '').toLowerCase();
      const id = app.clientId.toLowerCase();

      // 1. Direct SSO Handshake for MCOM Mall
      if (id === 'mcom-mall' || slug === 'mall') {
        const ssoRes = await getSsoToken('mcom-mall');
        const defaultMallUrl = isLocal ? 'http://localhost:3003' : 'https://mcommall.vercel.app';
        const mallUrl = (import.meta.env.VITE_MCOM_MALL_URL || app.appUrl || defaultMallUrl).replace(/\/$/, '');
        const launchUrl = `${mallUrl}/auth/sso?sso_token=${encodeURIComponent(ssoRes.ssoToken)}`;
        window.open(launchUrl, '_blank');
        return;
      }

      // 2. Direct SSO Handshake for MCOM Rewards / Loyalty
      if (id === 'mcom-rewards' || slug === 'rewards' || slug === 'loyalty') {
        const ssoRes = await getSsoToken(app.clientId);
        const defaultLoyaltyUrl = isLocal ? 'http://localhost:3005' : 'https://mcomloyalty.vercel.app';
        const loyaltyUrl = (import.meta.env.VITE_MCOM_LOYALTY_URL || app.appUrl || defaultLoyaltyUrl).replace(/\/$/, '');
        const launchUrl = `${loyaltyUrl}/sso-login?token=${encodeURIComponent(ssoRes.ssoToken)}`;
        window.open(launchUrl, '_blank');
        return;
      }

      // 3. OAuth Authorization Code Flow for Registered Apps with redirectUris
      const uris = app.redirectUris || [];
      if (uris.length > 0) {
        const preferredUri =
          uris.find((u) =>
            isLocal ? u.includes('localhost') || u.includes('127.0.0.1') : u.startsWith('https://')
          ) || uris[0];

        try {
          const authRes = await postSsoAuthorize({
            clientId: app.clientId,
            redirectUri: preferredUri,
            scope: 'profile email business membership packages',
            state: `launch_${Date.now()}`,
          });

          if (authRes?.code) {
            const separator = preferredUri.includes('?') ? '&' : '?';
            const launchUrl = `${preferredUri}${separator}code=${encodeURIComponent(authRes.code)}&state=dash_launch`;
            window.open(launchUrl, '_blank');
            return;
          }
        } catch (oauthErr) {
          console.warn('OAuth authorize fallback for', app.clientId, oauthErr);
        }
      }

      // 4. Token Query Fallback or Base URL
      if (app.appUrl) {
        try {
          const ssoRes = await getSsoToken(app.clientId);
          const separator = app.appUrl.includes('?') ? '&' : '?';
          window.open(`${app.appUrl}${separator}sso_token=${encodeURIComponent(ssoRes.ssoToken)}`, '_blank');
        } catch {
          window.open(app.appUrl, '_blank');
        }
        return;
      }

      setLaunchError(`Application "${app.name}" does not have an active frontend URL configured yet.`);
    } catch (err: any) {
      console.error('Failed to launch application:', err);
      setLaunchError(err?.message || 'Failed to initialize Single Sign-On handshake.');
    } finally {
      setLaunchingId(null);
    }
  };

  const filteredApps = useMemo(() => {
    return dbApps.filter((app) => {
      const meta = resolveAppMeta(app);

      if (filter === 'mcom' && meta.ecosystem !== 'mcom') return false;
      if (filter === 'gbs' && meta.ecosystem !== 'gbs') return false;
      if (filter === 'system' && !app.isSystemApp) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.clientId.toLowerCase().includes(q) ||
        (app.platformSlug && app.platformSlug.toLowerCase().includes(q)) ||
        (app.description && app.description.toLowerCase().includes(q))
      );
    });
  }, [dbApps, filter, search]);

  const counts = useMemo(() => {
    return {
      all: dbApps.length,
      mcom: dbApps.filter((a) => resolveAppMeta(a).ecosystem === 'mcom').length,
      gbs: dbApps.filter((a) => resolveAppMeta(a).ecosystem === 'gbs').length,
      system: dbApps.filter((a) => a.isSystemApp).length,
    };
  }, [dbApps]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 sm:space-y-4">
      {/* Page Header Banner */}
      <div className="flex items-center justify-between gap-2.5 bg-white p-3 sm:p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight font-display">
              Platform Directory
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] animate-pulse" />
              <span>{dbApps.length} Apps</span>
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">
            Registered ecosystem platforms with Single Sign-On and central credentials.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh application directory"
            className="p-1.5 sm:px-2.5 sm:py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold border border-gray-200/80 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin text-orange-500')} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {isAdmin && (
            <Link
              to="/admin/console"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Console</span>
            </Link>
          )}
        </div>
      </div>

      {/* Global Launch Error Banner */}
      {launchError && (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="truncate">{launchError}</span>
          </div>
          <button
            onClick={() => setLaunchError(null)}
            className="text-xs font-bold text-red-500 hover:text-red-800 px-1.5 py-0.5 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-gray-200/80 shadow-xs space-y-2">
        {/* Search input + View Mode Switcher */}
        <div className="flex items-center gap-2 w-full min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, slug or ID..."
              className="w-full pl-8 pr-6 py-1.5 bg-gray-50/80 border border-gray-200/80 rounded-lg text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-gray-600 p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Grid vs Table View Mode */}
          <div className="flex items-center gap-0.5 bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/60 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-white text-orange-600 shadow-xs font-bold'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="List View"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'table'
                  ? 'bg-white text-orange-600 shadow-xs font-bold'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Pills with Horizontal Scrolling */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 w-full min-w-0">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'mcom', label: 'MCOM' },
              { id: 'gbs', label: '247GBS' },
              { id: 'system', label: 'System' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap flex-shrink-0',
                filter === f.id
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70 hover:text-gray-900'
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.1 rounded-full font-mono font-bold',
                  filter === f.id
                    ? 'bg-white/25 text-white'
                    : 'bg-white text-gray-600 border border-gray-200/60'
                )}
              >
                {counts[f.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 w-full min-w-0">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="bg-white rounded-xl border border-gray-200/80 p-2.5 space-y-2 animate-pulse min-w-0"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-gray-100" />
                <div className="w-8 h-3 rounded-full bg-gray-100" />
              </div>
              <div className="space-y-1">
                <div className="w-3/4 h-3 rounded bg-gray-100" />
                <div className="w-full h-2 rounded bg-gray-50" />
              </div>
              <div className="w-full h-7 rounded-lg bg-gray-100 mt-2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-gray-200 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <h4 className="font-bold text-gray-900 text-sm">Failed to load platform directory</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">
            Could not communicate with the application directory service.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors shadow-xs"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 bg-white rounded-xl border border-gray-200 text-center">
          <Search className="w-8 h-8 text-gray-300 mb-2" />
          <h4 className="font-bold text-gray-900 text-sm">No applications match your filter</h4>
          <p className="text-xs text-gray-400 mt-1">
            Try adjusting your search query or switching the ecosystem filter.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="mt-3 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* MULTI-COLUMN RESPONSIVE GRID (2 cols on phones, 3 cols on larger phones / tablets, 4-5 on desktop) */
        <div className="grid grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3 w-full min-w-0">
          {filteredApps.map((app) => {
            const meta = resolveAppMeta(app);
            const Icon = meta.icon;
            const isLaunching = launchingId === app.clientId;

            return (
              <div
                key={app.clientId}
                className="group bg-white rounded-xl border border-gray-200/80 p-2.5 sm:p-3 flex flex-col justify-between hover:shadow-md hover:border-orange-300/80 transition-all duration-150 min-w-0"
              >
                <div className="min-w-0">
                  {/* Top: Icon + Status */}
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <div
                      className={cn(
                        'w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs border',
                        meta.theme.bg,
                        meta.theme.border,
                        meta.theme.text
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>

                    {/* Status & Badges */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        className={cn(
                          'text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider',
                          meta.theme.badgeBg,
                          meta.theme.badgeText
                        )}
                      >
                        {meta.ecosystem}
                      </span>
                      {app.isSystemApp && (
                        <span
                          title="System App"
                          className="p-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200/60"
                        >
                          <Shield className="w-2.5 h-2.5" />
                        </span>
                      )}
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          app.isActive
                            ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]'
                            : 'bg-gray-300'
                        )}
                        title={app.isActive ? 'Active' : 'Inactive'}
                      />
                    </div>
                  </div>

                  {/* Title & Slug */}
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-orange-600 transition-colors truncate leading-tight">
                      {app.name}
                    </h3>
                    {app.platformSlug && (
                      <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono truncate">
                        #{app.platformSlug}
                      </div>
                    )}
                  </div>

                  {/* Description (2 lines max, compact) */}
                  <p className="text-[10px] sm:text-[11px] text-gray-500 leading-snug line-clamp-2 my-1 sm:my-1.5 min-h-[1.75rem]">
                    {app.description || meta.tagline}
                  </p>
                </div>

                {/* Card Action Row */}
                <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between gap-1 mt-auto min-w-0">
                  <button
                    onClick={(e) => handleCopyId(app.clientId, e)}
                    title="Click to copy Client ID"
                    className="font-mono text-[9px] text-gray-400 hover:text-orange-600 truncate flex items-center gap-0.5 min-w-0 max-w-[65px] sm:max-w-[85px]"
                  >
                    <span className="truncate">{app.clientId}</span>
                    {copiedId === app.clientId ? (
                      <Check className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {app.appUrl && (
                      <a
                        href={app.appUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Direct link (${app.appUrl})`}
                        className="h-6.5 w-6.5 sm:h-7 sm:w-7 rounded-md border border-gray-200/80 hover:bg-gray-50 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}

                    <button
                      onClick={() => handleLaunch(app)}
                      disabled={isLaunching}
                      className={cn(
                        'h-6.5 sm:h-7 px-2 sm:px-2.5 rounded-md font-bold text-[10px] sm:text-[11px] transition-all flex items-center justify-center gap-1 shadow-xs',
                        'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/10 active:scale-95',
                        isLaunching && 'opacity-75 cursor-wait'
                      )}
                    >
                      {isLaunching ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <Rocket className="w-2.5 h-2.5" />
                      )}
                      <span>Launch</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DENSE TABLE / LIST VIEW */
        <div className="w-full max-w-full overflow-x-auto rounded-xl border border-gray-200/80 bg-white shadow-xs">
          <table className="w-full min-w-[460px] text-left text-xs">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-200/80 text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2 hidden sm:table-cell">Ecosystem</th>
                <th className="px-3 py-2 hidden md:table-cell">Client ID</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredApps.map((app) => {
                const meta = resolveAppMeta(app);
                const Icon = meta.icon;
                const isLaunching = launchingId === app.clientId;

                return (
                  <tr key={app.clientId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            'w-6.5 h-6.5 rounded-md flex items-center justify-center flex-shrink-0 border',
                            meta.theme.bg,
                            meta.theme.border,
                            meta.theme.text
                          )}
                        >
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 truncate flex items-center gap-1">
                            <span>{app.name}</span>
                            {app.isSystemApp && (
                              <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200/60">
                                System
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 truncate max-w-xs">
                            {app.description || meta.tagline}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2 hidden sm:table-cell">
                      <span
                        className={cn(
                          'text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider',
                          meta.theme.badgeBg,
                          meta.theme.badgeText
                        )}
                      >
                        {meta.ecosystem}
                      </span>
                    </td>

                    <td className="px-3 py-2 hidden md:table-cell">
                      <span
                        onClick={(e) => handleCopyId(app.clientId, e)}
                        className="font-mono text-[10px] text-gray-600 hover:text-orange-600 cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>{app.clientId}</span>
                        {copiedId === app.clientId ? (
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-gray-400" />
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleLaunch(app)}
                          disabled={isLaunching}
                          className="h-6.5 px-2 rounded-md font-bold text-[10px] bg-orange-500 hover:bg-orange-600 text-white shadow-xs transition-all flex items-center gap-1"
                        >
                          {isLaunching ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Rocket className="w-2.5 h-2.5" />
                          )}
                          <span>Launch</span>
                        </button>
                        {app.appUrl && (
                          <a
                            href={app.appUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 p-2 bg-white/70 rounded-xl border border-gray-200/60 text-[10px] text-gray-400">
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
          <span>Single Sign-On (SSO) active · Endpoints secured with short-lived tokens</span>
        </div>
        {isAdmin && (
          <Link
            to="/admin/console"
            className="font-bold text-orange-600 hover:underline"
          >
            Manage applications in Admin Console →
          </Link>
        )}
      </div>
    </div>
  );
}
