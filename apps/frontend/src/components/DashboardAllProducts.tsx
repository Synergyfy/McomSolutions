import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Dices,
  ExternalLink,
  Gift,
  Grid,
  KeyRound,
  Link2,
  List,
  Loader2,
  Lock,
  PackageOpen,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  AlertCircle,
  AppWindow,
  Contact2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGetSsoToken, usePostSsoAuthorize, useCurrentUser } from '../services/auth/hooks';
import { useEcosystemApps, useProfile, useProgrammeAccessPolicy } from '../services/business/hooks';
import { useAccessPlans, useAccessPurchases } from '../services/access/hooks';
import { usePlans } from '../services/pricing/hooks';
import type { BusinessAccessPlan } from '../services/access';
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

// ─── ACCESS RESOLUTION ────────────────────────────────────────────────────────
// A product is an ecosystem app. Access can come from an active membership,
// an active access pass, a purchased platform package, or the programme trial.

type AccessSourceKind = 'membership' | 'access-pass' | 'trial' | 'direct' | 'admin';

interface AccessSource {
  kind: AccessSourceKind;
  label: string;
  detail?: string;
}

interface AccessSuggestion {
  key: string;
  kind: 'membership' | 'access-pass';
  name: string;
  meta: string;
  href: string;
}

interface MembershipPlanLike {
  id?: string;
  planId?: string;
  name: string;
  price?: number;
  monthlyPrice?: number;
  platformAccess?: string[];
  includedApps?: Array<{ platform?: string; platformName?: string }>;
  appBundles?: Array<{ platform?: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const normalise = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Maps the many platform labels used across plans, packages and SSO clients
 * (MCOM Mall, mcom-mall, mall, …) to one stable key.
 */
const platformKey = (value: unknown): string => {
  const compact = normalise(value);
  if (!compact) return '';

  if (compact.includes('mall')) return 'mall';
  if (compact.includes('reward')) return 'rewards';
  if (compact.includes('loyalty')) return 'loyalty';
  if (compact.includes('spin')) return 'spin';
  if (compact.includes('vcard') || compact.includes('visitingcard')) return 'vcard';
  if (compact.includes('audit')) return 'audit';
  if (compact.includes('expo')) return 'expo';
  if (compact.includes('affiliate')) return '247gbs_affiliate';
  if (compact.includes('partner')) return 'partner';
  if (compact.includes('link')) return 'links';

  return compact;
};

const appPlatformKeys = (app: SsoClientListItem): Set<string> => {
  const keys = new Set<string>();
  for (const raw of [app.platformSlug, app.name, app.clientId]) {
    const key = platformKey(raw);
    if (key) keys.add(key);
  }
  return keys;
};

const planPlatformKeys = (plan: {
  platformAccess?: unknown;
  includedApps?: unknown;
  appBundles?: unknown;
}): Set<string> => {
  const keys = new Set<string>();
  const add = (value: unknown) => {
    const key = platformKey(value);
    if (key) keys.add(key);
  };

  if (Array.isArray(plan.platformAccess)) {
    plan.platformAccess.forEach(add);
  }
  if (Array.isArray(plan.includedApps)) {
    plan.includedApps.forEach((raw: any) => add(raw?.platform ?? raw?.platformName));
  }
  if (Array.isArray(plan.appBundles)) {
    plan.appBundles.forEach((raw: any) => add(raw?.platform));
  }

  return keys;
};

const setsIntersect = (a: Set<string>, b: Set<string>) => {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
};

const packageIsActive = (pkg: any) => {
  if (String(pkg?.status ?? 'active').toLowerCase() !== 'active') return false;
  if (!pkg?.expiresAt) return true;
  const expiresAt = new Date(pkg.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const purchaseIsActive = (purchase: any) => {
  if (String(purchase?.status ?? '').toUpperCase() !== 'ACTIVE') return false;
  const expiresAt = new Date(purchase?.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const formatDate = (value?: string | number | Date | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatMembershipPrice = (plan: MembershipPlanLike) => {
  const price = Number(plan.monthlyPrice ?? plan.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 'Membership plan';
  return `From £${price.toLocaleString('en-GB', { maximumFractionDigits: 0 })}/mo`;
};

const formatPassPrice = (plan: BusinessAccessPlan) => {
  const price = Number(plan.price ?? 0);
  const priceLabel =
    Number.isFinite(price) && price > 0
      ? `£${price.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
      : 'Access pass';
  return `${priceLabel} · ${plan.durationDays} days`;
};

const getStoredBusinessRole = (): string => {
  try {
    const raw = localStorage.getItem('business_user');
    if (!raw) return '';
    return String(JSON.parse(raw)?.role ?? '').toUpperCase();
  } catch {
    return '';
  }
};

// ─── PRESENTATIONAL COMPONENTS ────────────────────────────────────────────────

function SourceBadge({ source }: { source: AccessSource; key?: React.Key }) {
  const Icon =
    source.kind === 'membership'
      ? Crown
      : source.kind === 'trial'
        ? Clock
        : source.kind === 'access-pass'
          ? KeyRound
          : source.kind === 'admin'
            ? ShieldCheck
            : Sparkles;

  const styles =
    source.kind === 'membership'
      ? 'bg-amber-50 text-amber-700 border-amber-200/70'
      : source.kind === 'trial'
        ? 'bg-blue-50 text-blue-700 border-blue-200/70'
        : source.kind === 'access-pass'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
          : 'bg-gray-50 text-gray-600 border-gray-200/70';

  return (
    <span
      title={source.detail || source.label}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold',
        styles,
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{source.label}</span>
    </span>
  );
}

interface AppTileProps {
  key?: React.Key;
  app: SsoClientListItem;
  meta: PlatformMeta;
  locked: boolean;
  sources: AccessSource[];
  suggestions: AccessSuggestion[];
  launching: boolean;
  copied: boolean;
  onCopy: (clientId: string, event: React.MouseEvent) => void;
  onLaunch: (app: SsoClientListItem) => void;
}

function AppTile({
  app,
  meta,
  locked,
  sources,
  suggestions,
  launching,
  copied,
  onCopy,
  onLaunch,
}: AppTileProps) {
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'group flex min-w-0 flex-col justify-between rounded-xl border bg-white p-2.5 transition-all duration-150 sm:p-3',
        locked
          ? 'border-gray-200/80 bg-gray-50/30'
          : 'border-gray-200/80 hover:border-orange-300/80 hover:shadow-md',
      )}
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex items-start justify-between gap-1.5">
          <div
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center',
              locked ? 'text-gray-400' : meta.theme.text,
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>

          <div className="flex flex-shrink-0 items-center gap-1">
            <span
              className={cn(
                'rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider sm:text-[9px]',
                meta.theme.badgeBg,
                meta.theme.badgeText,
              )}
            >
              {meta.ecosystem}
            </span>
            {app.isSystemApp && (
              <span
                title="System App"
                className="rounded border border-amber-200/60 bg-amber-50 p-0.5 text-amber-600"
              >
                <Shield className="h-2.5 w-2.5" />
              </span>
            )}
            {locked ? (
              <span
                title="Not included in your current access"
                className="rounded border border-gray-200 bg-white p-0.5 text-gray-400"
              >
                <Lock className="h-2.5 w-2.5" />
              </span>
            ) : (
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  app.isActive
                    ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]'
                    : 'bg-gray-300',
                )}
                title={app.isActive ? 'Active' : 'Inactive'}
              />
            )}
          </div>
        </div>

        <div className="min-w-0">
          <h3
            className={cn(
              'truncate text-xs font-bold leading-tight transition-colors sm:text-sm',
              locked ? 'text-gray-700' : 'text-gray-900 group-hover:text-orange-600',
            )}
          >
            {app.name}
          </h3>
          {app.platformSlug && (
            <div className="truncate font-mono text-[9px] text-gray-400 sm:text-[10px]">
              #{app.platformSlug}
            </div>
          )}
        </div>

        <p className="my-1 min-h-[1.75rem] line-clamp-2 text-[10px] leading-snug text-gray-500 sm:my-1.5 sm:text-[11px]">
          {app.description || meta.tagline}
        </p>

        {locked ? (
          <div className="mt-1.5 rounded-lg border border-dashed border-gray-200 bg-white/70 p-2">
            <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400">
              Unlock with
            </p>
            <div className="mt-1 space-y-1">
              {suggestions.slice(0, 3).map((suggestion) => (
                <Link
                  key={suggestion.key}
                  to={suggestion.href}
                  className="flex items-center justify-between gap-1 rounded-md border border-gray-200/70 bg-white px-1.5 py-1 transition-colors hover:border-orange-300 hover:bg-orange-50/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-bold text-gray-800">
                      {suggestion.name}
                    </span>
                    <span className="block truncate text-[8px] font-medium text-gray-400 sm:text-[9px]">
                      {suggestion.kind === 'membership' ? 'Membership' : 'Access pass'} ·{' '}
                      {suggestion.meta}
                    </span>
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
                </Link>
              ))}
              {suggestions.length > 3 && (
                <p className="px-0.5 text-[9px] font-semibold text-gray-500">
                  +{suggestions.length - 3} more option{suggestions.length - 3 === 1 ? '' : 's'}
                </p>
              )}
              {suggestions.length === 0 && (
                <p className="text-[10px] leading-snug text-gray-500">
                  No self-serve option yet — contact your account manager.
                </p>
              )}
            </div>
          </div>
        ) : (
          sources.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sources.slice(0, 2).map((source, index) => (
                <SourceBadge key={`${source.kind}-${source.label}-${index}`} source={source} />
              ))}
              {sources.length > 2 && (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[9px] font-bold text-gray-500">
                  +{sources.length - 2}
                </span>
              )}
            </div>
          )
        )}
      </div>

      <div className="mt-auto flex min-w-0 items-center justify-between gap-1 border-t border-gray-100 pt-1.5">
        <button
          onClick={(event) => onCopy(app.clientId, event)}
          title="Click to copy Client ID"
          className="flex min-w-0 max-w-[65px] items-center gap-0.5 truncate font-mono text-[9px] text-gray-400 hover:text-orange-600 sm:max-w-[85px]"
        >
          <span className="truncate">{app.clientId}</span>
          {copied ? (
            <Check className="h-2.5 w-2.5 flex-shrink-0 text-emerald-600" />
          ) : (
            <Copy className="h-2.5 w-2.5 flex-shrink-0 text-gray-400" />
          )}
        </button>

        <div className="flex flex-shrink-0 items-center gap-1">
          {locked ? (
            <Link
              to={suggestions[0]?.href || '/dashboard/memberships'}
              className="flex min-h-9 items-center justify-center gap-1 rounded-md bg-gray-900 px-2 text-[10px] font-bold text-white shadow-xs transition-all hover:bg-gray-800 active:scale-95 sm:min-h-7 sm:px-2.5 sm:text-[11px]"
            >
              <KeyRound className="h-2.5 w-2.5" />
              <span>Unlock</span>
            </Link>
          ) : (
            <>
              {app.appUrl && (
                <a
                  href={app.appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Direct link (${app.appUrl})`}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200/80 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 sm:h-7 sm:w-7"
                >
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}

              <button
                onClick={() => onLaunch(app)}
                disabled={launching}
                className={cn(
                  'flex min-h-9 items-center justify-center gap-1 rounded-md bg-orange-500 px-2 text-[10px] font-bold text-white shadow-xs shadow-orange-500/10 transition-all hover:bg-orange-600 active:scale-95 sm:min-h-7 sm:px-2.5 sm:text-[11px]',
                  launching && 'cursor-wait opacity-75',
                )}
              >
                {launching ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Rocket className="h-2.5 w-2.5" />
                )}
                <span>Launch</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface AppTableRowProps {
  key?: React.Key;
  app: SsoClientListItem;
  meta: PlatformMeta;
  locked: boolean;
  sources: AccessSource[];
  suggestions: AccessSuggestion[];
  launching: boolean;
  copied: boolean;
  onCopy: (clientId: string, event: React.MouseEvent) => void;
  onLaunch: (app: SsoClientListItem) => void;
}

function AppTableRow({
  app,
  meta,
  locked,
  sources,
  suggestions,
  launching,
  copied,
  onCopy,
  onLaunch,
}: AppTableRowProps) {
  const Icon = meta.icon;

  return (
    <tr className="transition-colors hover:bg-gray-50/60">
      <td className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center',
              locked ? 'text-gray-400' : meta.theme.text,
            )}
          >
            <Icon className="h-3 w-3" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 truncate font-bold text-gray-900">
              <span>{app.name}</span>
              {app.isSystemApp && (
                <span className="rounded border border-amber-200/60 bg-amber-50 px-1 text-[8px] font-bold text-amber-700">
                  System
                </span>
              )}
              {locked && <Lock className="h-2.5 w-2.5 text-gray-400" />}
            </div>
            <p className="max-w-xs truncate text-[10px] text-gray-400">
              {app.description || meta.tagline}
            </p>
          </div>
        </div>
      </td>

      <td className="hidden px-3 py-2 sm:table-cell">
        <span
          className={cn(
            'rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider',
            meta.theme.badgeBg,
            meta.theme.badgeText,
          )}
        >
          {meta.ecosystem}
        </span>
      </td>

      <td className="hidden px-3 py-2 md:table-cell">
        {locked ? (
          <span className="text-[10px] font-semibold text-gray-500">
            Locked · {suggestions.length} option{suggestions.length === 1 ? '' : 's'}
          </span>
        ) : sources.length > 0 ? (
          <SourceBadge source={sources[0]} />
        ) : (
          <span className="text-[10px] font-semibold text-emerald-600">Available</span>
        )}
      </td>

      <td className="hidden px-3 py-2 md:table-cell">
        <button
          onClick={(event) => onCopy(app.clientId, event)}
          className="inline-flex cursor-pointer items-center gap-1 font-mono text-[10px] text-gray-600 hover:text-orange-600"
        >
          <span>{app.clientId}</span>
          {copied ? (
            <Check className="h-2.5 w-2.5 text-emerald-600" />
          ) : (
            <Copy className="h-2.5 w-2.5 text-gray-400" />
          )}
        </button>
      </td>

      <td className="px-3 py-2 text-right">
        {locked ? (
          <Link
            to={suggestions[0]?.href || '/dashboard/memberships'}
            className="inline-flex min-h-9 items-center gap-1 rounded-md bg-gray-900 px-2 text-[10px] font-bold text-white transition-colors hover:bg-gray-800 sm:min-h-7"
          >
            <KeyRound className="h-2.5 w-2.5" />
            Unlock
          </Link>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button
              onClick={() => onLaunch(app)}
              disabled={launching}
              className="flex min-h-9 items-center gap-1 rounded-md bg-orange-500 px-2 text-[10px] font-bold text-white shadow-xs transition-all hover:bg-orange-600 sm:min-h-7"
            >
              {launching ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Rocket className="h-2.5 w-2.5" />
              )}
              <span>Launch</span>
            </button>
            {app.appUrl && (
              <a
                href={app.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function ProductSectionHeader({
  icon: Icon,
  title,
  count,
  description,
  tone = 'unlocked',
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  description: string;
  tone?: 'unlocked' | 'locked';
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-gray-200/80 bg-white p-3 shadow-xs sm:p-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border',
            tone === 'unlocked'
              ? 'border-emerald-200/70 bg-emerald-50 text-emerald-600'
              : 'border-gray-200 bg-gray-50 text-gray-500',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-black tracking-tight text-gray-900 sm:text-base">
              {title}
            </h3>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                tone === 'unlocked'
                  ? 'border-emerald-200/70 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600',
              )}
            >
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500 sm:text-xs">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DashboardAllProducts({
  initialFilter = 'all',
  initialSearch = '',
}: {
  initialFilter?: EcoFilter;
  initialSearch?: string;
} = {}) {
  const { data: dbApps = [], isLoading, isError, refetch, isFetching } = useEcosystemApps();
  const { data: currentUser } = useCurrentUser();
  const { mutateAsync: getSsoToken } = useGetSsoToken();
  const { mutateAsync: postSsoAuthorize } = usePostSsoAuthorize();

  const storedRole = getStoredBusinessRole();
  const userRole = String(currentUser?.role || storedRole || '').toUpperCase();
  const isBusinessUser = userRole === 'BUSINESS';
  const isAdmin = userRole === 'ADMIN';
  const gatingEnabled = isBusinessUser && !isAdmin;

  const { data: profile, isLoading: profileLoading } = useProfile(gatingEnabled);
  const { data: accessPolicy = {}, isLoading: policyLoading } = useProgrammeAccessPolicy(gatingEnabled);
  const { data: purchasesRes, isLoading: purchasesLoading } = useAccessPurchases(gatingEnabled);
  const { data: accessPlansRes, isLoading: accessPlansLoading } = useAccessPlans();
  const { data: membershipPlansRaw, isLoading: membershipPlansLoading } = usePlans();

  const membershipPlans: MembershipPlanLike[] = Array.isArray(membershipPlansRaw)
    ? (membershipPlansRaw as MembershipPlanLike[])
    : [];
  const accessPlans: BusinessAccessPlan[] = Array.isArray(accessPlansRes?.data)
    ? accessPlansRes.data
    : [];

  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<EcoFilter>(initialFilter);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const handleCopyId = (clientId: string, event: React.MouseEvent) => {
    event.stopPropagation();
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
        const mallUrl = (import.meta.env.VITE_MCOM_MALL_URL || app.appUrl || defaultMallUrl).replace(
          /\/$/,
          '',
        );
        const launchUrl = `${mallUrl}/auth/sso?sso_token=${encodeURIComponent(ssoRes.ssoToken)}`;
        window.open(launchUrl, '_blank');
        return;
      }

      // 2. Direct SSO Handshake for MCOM Rewards / Loyalty
      if (id === 'mcom-rewards' || slug === 'rewards' || slug === 'loyalty') {
        const ssoRes = await getSsoToken(app.clientId);
        const defaultLoyaltyUrl = isLocal ? 'http://localhost:3005' : 'https://mcomloyalty.vercel.app';
        const loyaltyUrl = (
          import.meta.env.VITE_MCOM_LOYALTY_URL ||
          app.appUrl ||
          defaultLoyaltyUrl
        ).replace(/\/$/, '');
        const launchUrl = `${loyaltyUrl}/sso-login?token=${encodeURIComponent(ssoRes.ssoToken)}`;
        window.open(launchUrl, '_blank');
        return;
      }

      // 3. OAuth Authorization Code Flow for Registered Apps with redirectUris
      const uris = app.redirectUris || [];
      if (uris.length > 0) {
        const preferredUri =
          uris.find((u) =>
            isLocal ? u.includes('localhost') || u.includes('127.0.0.1') : u.startsWith('https://'),
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
          window.open(
            `${app.appUrl}${separator}sso_token=${encodeURIComponent(ssoRes.ssoToken)}`,
            '_blank',
          );
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

  const accessModel = useMemo(() => {
    const now = Date.now();
    const profileData = (profile ?? {}) as any;
    const packages = Array.isArray(profileData.packages) ? profileData.packages : [];
    const activePackages = packages.filter(packageIsActive);
    const activePurchases = (purchasesRes?.data ?? []).filter(purchaseIsActive);

    const status = String(profileData.membershipStatus ?? '').toLowerCase();
    const membershipLevel = String(profileData.membershipLevel ?? '');
    const membershipExpiresAt = profileData.membershipExpiresAt
      ? new Date(profileData.membershipExpiresAt)
      : null;
    const membershipExpiresMs =
      membershipExpiresAt && !Number.isNaN(membershipExpiresAt.getTime())
        ? membershipExpiresAt.getTime()
        : null;

    const hasMembershipIdentity =
      Boolean(profileData.membershipPlanName) ||
      (Boolean(membershipLevel) && membershipLevel.toLowerCase() !== 'bronze');
    const membershipActive =
      Boolean(profileData) &&
      hasMembershipIdentity &&
      ['active', 'trial', 'past_due'].includes(status) &&
      (!membershipExpiresMs || membershipExpiresMs > now);

    const currentPlanName = profileData.membershipPlanName || membershipLevel;
    const membershipPlan = membershipPlans.find(
      (plan) =>
        normalise(plan.name) === normalise(currentPlanName) ||
        normalise(plan.id) === normalise(currentPlanName) ||
        normalise(plan.planId) === normalise(currentPlanName),
    );

    const sourcesByKey = new Map<string, AccessSource[]>();
    const sourceIdentity = new Set<string>();

    const addSource = (keys: Set<string>, source: AccessSource) => {
      const identity = `${source.kind}|${source.label}`;
      if (sourceIdentity.has(identity)) return;
      sourceIdentity.add(identity);
      for (const key of keys) {
        const existing = sourcesByKey.get(key) ?? [];
        if (!existing.some((entry) => entry.kind === source.kind && entry.label === source.label)) {
          existing.push(source);
          sourcesByKey.set(key, existing);
        }
      }
    };

    const membershipKeys = membershipPlan ? planPlatformKeys(membershipPlan) : new Set<string>();
    const membershipLabel = membershipPlan?.name || profileData.membershipPlanName || membershipLevel;
    if (membershipActive && membershipKeys.size > 0) {
      addSource(membershipKeys, {
        kind: 'membership',
        label: `${membershipLabel} membership`,
        detail: membershipExpiresMs ? `Active until ${formatDate(membershipExpiresMs)}` : undefined,
      });
    }

    const passNames = new Set<string>();

    for (const purchase of activePurchases) {
      const plan = purchase?.accessPlan;
      const keys = plan ? planPlatformKeys(plan) : new Set<string>();
      if (keys.size === 0) continue;
      passNames.add(purchase.accessPlanName);
      addSource(keys, {
        kind: 'access-pass',
        label: `Access pass: ${purchase.accessPlanName}`,
        detail: `Active until ${formatDate(purchase.expiresAt) ?? 'expiry'}`,
      });
    }

    for (const pkg of activePackages) {
      const key = platformKey(pkg?.platform);
      if (!key) continue;

      const isAccessPass = String(pkg?.planType ?? '').toUpperCase() === 'ACCESS';
      if (isAccessPass) {
        const passName = pkg.planName || pkg.packageName || pkg.platform;
        passNames.add(passName);
        addSource(new Set([key]), {
          kind: 'access-pass',
          label: `Access pass: ${passName}`,
          detail: packageIsActive(pkg) && pkg?.expiresAt ? `Active until ${formatDate(pkg.expiresAt)}` : undefined,
        });
        continue;
      }

      // Membership-provisioned packages are already represented by the
      // membership source above.
      if (membershipActive && Number(pkg?.amount ?? 0) === 0) continue;

      addSource(new Set([key]), {
        kind: 'direct',
        label: 'Purchased access',
        detail: pkg?.planName || pkg?.packageName || pkg?.platform,
      });
    }

    // Programme trial mirrors the rules used by the dashboard access gate.
    const verificationRequired = (accessPolicy as any)?.verificationRequired !== false;
    const trialDays =
      Number((accessPolicy as any)?.trialAccessDays) ||
      Number(profileData.trialAccessDays) ||
      14;
    const paidTrialExpiresMs = profileData.trialAccessExpiresAt
      ? new Date(profileData.trialAccessExpiresAt).getTime()
      : null;
    const profileCreatedAt = profileData.createdAt ? new Date(profileData.createdAt) : null;
    const optionalSince = (accessPolicy as any)?.verificationOptionalSince
      ? new Date((accessPolicy as any).verificationOptionalSince)
      : null;
    const freeTrialStartedAt = !profileCreatedAt
      ? optionalSince
      : optionalSince && optionalSince.getTime() > profileCreatedAt.getTime()
        ? optionalSince
        : profileCreatedAt;
    const freeTrialExpiresMs =
      !verificationRequired && freeTrialStartedAt && !Number.isNaN(freeTrialStartedAt.getTime())
        ? freeTrialStartedAt.getTime() + trialDays * DAY_MS
        : null;
    const trialExpiresMs = paidTrialExpiresMs ?? freeTrialExpiresMs;
    const hasTrialEntitlement =
      Boolean(profileData.hasPaidVerificationFee) || !verificationRequired;
    const trialActive =
      !membershipActive &&
      hasTrialEntitlement &&
      Number.isFinite(trialExpiresMs) &&
      (trialExpiresMs as number) > now;
    const trialDaysRemaining = trialActive
      ? Math.max(1, Math.ceil(((trialExpiresMs as number) - now) / DAY_MS))
      : 0;
    const trialSource: AccessSource = {
      kind: 'trial',
      label: 'Programme trial',
      detail: trialDaysRemaining
        ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining`
        : undefined,
    };

    const sourceForApp = (app: SsoClientListItem): AccessSource[] => {
      const keys = appPlatformKeys(app);
      const sources: AccessSource[] = [];
      const seen = new Set<string>();

      for (const key of keys) {
        for (const source of sourcesByKey.get(key) ?? []) {
          const identity = `${source.kind}|${source.label}`;
          if (seen.has(identity)) continue;
          seen.add(identity);
          sources.push(source);
        }
      }

      // A membership plan without configured platform bundles is treated as
      // covering the MCOM ecosystem so older plans never lock users out.
      if (sources.length === 0 && membershipActive && membershipKeys.size === 0) {
        if (resolveAppMeta(app).ecosystem === 'mcom') {
          sources.push({
            kind: 'membership',
            label: `${membershipLabel} membership`,
            detail: membershipExpiresMs
              ? `Active until ${formatDate(membershipExpiresMs)}`
              : undefined,
          });
        }
      }

      // Trials cover the MCOM products. Access passes and memberships take
      // precedence when they already cover the product.
      if (sources.length === 0 && trialActive && resolveAppMeta(app).ecosystem === 'mcom') {
        sources.push(trialSource);
      }

      return sources;
    };

    const suggestionsForApp = (app: SsoClientListItem): AccessSuggestion[] => {
      const appKeys = appPlatformKeys(app);
      const suggestions: AccessSuggestion[] = [];
      const seen = new Set<string>();

      for (const plan of membershipPlans) {
        if (!setsIntersect(planPlatformKeys(plan), appKeys)) continue;
        const key = `membership:${plan.planId || plan.id || plan.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push({
          key,
          kind: 'membership',
          name: plan.name,
          meta: formatMembershipPrice(plan),
          href: '/dashboard/memberships',
        });
      }

      for (const plan of accessPlans) {
        if (plan.archived) continue;
        if (!setsIntersect(planPlatformKeys(plan), appKeys)) continue;
        const key = `access-pass:${plan.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push({
          key,
          kind: 'access-pass',
          name: plan.name,
          meta: formatPassPrice(plan),
          href: '/dashboard/access-passes',
        });
      }

      return suggestions;
    };

    return {
      membershipActive,
      trialActive,
      trialDaysRemaining,
      membershipLabel,
      membershipExpiresAt: membershipExpiresMs ? formatDate(membershipExpiresMs) : null,
      passNames: [...passNames],
      sourceForApp,
      suggestionsForApp,
    };
  }, [
    profile,
    purchasesRes,
    accessPlans,
    membershipPlans,
    accessPolicy,
  ]);

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

  const categorisedApps = useMemo(() => {
    if (!gatingEnabled) {
      return {
        accessible: filteredApps.map((app) => ({ app, sources: [] as AccessSource[] })),
        locked: [] as Array<{
          app: SsoClientListItem;
          sources: AccessSource[];
          suggestions: AccessSuggestion[];
        }>,
      };
    }

    const accessible: Array<{ app: SsoClientListItem; sources: AccessSource[] }> = [];
    const locked: Array<{
      app: SsoClientListItem;
      sources: AccessSource[];
      suggestions: AccessSuggestion[];
    }> = [];

    for (const app of filteredApps) {
      const sources = accessModel.sourceForApp(app);
      if (sources.length > 0) {
        accessible.push({ app, sources });
      } else {
        locked.push({
          app,
          sources: [],
          suggestions: accessModel.suggestionsForApp(app),
        });
      }
    }

    return { accessible, locked };
  }, [filteredApps, gatingEnabled, accessModel]);

  const counts = useMemo(() => {
    return {
      all: dbApps.length,
      mcom: dbApps.filter((a) => resolveAppMeta(a).ecosystem === 'mcom').length,
      gbs: dbApps.filter((a) => resolveAppMeta(a).ecosystem === 'gbs').length,
      system: dbApps.filter((a) => a.isSystemApp).length,
    };
  }, [dbApps]);

  const accessSummary = useMemo(() => {
    if (!gatingEnabled) {
      return 'Registered ecosystem platforms with Single Sign-On and central credentials.';
    }
    if (accessModel.membershipActive) {
      const passLabel = accessModel.passNames.length
        ? ` plus ${accessModel.passNames.length} active access pass${accessModel.passNames.length === 1 ? '' : 'es'}`
        : '';
      return `${accessModel.membershipLabel} membership active${passLabel}.`;
    }
    if (accessModel.trialActive) {
      return `Programme trial active with ${accessModel.trialDaysRemaining} day${accessModel.trialDaysRemaining === 1 ? '' : 's'} remaining.`;
    }
    if (accessModel.passNames.length > 0) {
      return `${accessModel.passNames.length} active access pass${accessModel.passNames.length === 1 ? '' : 'es'} covering your products.`;
    }
    return 'No active membership, trial or access pass yet — unlock a product below to get started.';
  }, [gatingEnabled, accessModel]);

  const gatingLoading =
    gatingEnabled &&
    (profileLoading ||
      policyLoading ||
      purchasesLoading ||
      membershipPlansLoading ||
      accessPlansLoading);
  const showLoading = isLoading || gatingLoading;

  const renderApps = (
    items: Array<{
      app: SsoClientListItem;
      sources: AccessSource[];
      suggestions?: AccessSuggestion[];
    }>,
    locked: boolean,
  ) => {
    const shared = (item: (typeof items)[number]) => ({
      app: item.app,
      meta: resolveAppMeta(item.app),
      locked,
      sources: item.sources,
      suggestions: item.suggestions ?? [],
      launching: launchingId === item.app.clientId,
      copied: copiedId === item.app.clientId,
      onCopy: handleCopyId,
      onLaunch: handleLaunch,
    });

    if (viewMode === 'grid') {
      return (
        <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
            <AppTile key={item.app.clientId} {...shared(item)} />
          ))}
        </div>
      );
    }

    return (
      <>
        <div className="space-y-3 xl:hidden">
          {items.map((item) => (
            <AppTile key={item.app.clientId} {...shared(item)} />
          ))}
        </div>
        <div className="hidden w-full max-w-full overflow-x-auto rounded-xl border border-gray-200/80 bg-white shadow-xs xl:block">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200/80 bg-gray-50/70 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="px-3 py-2">Platform</th>
                <th className="hidden px-3 py-2 sm:table-cell">Ecosystem</th>
                <th className="hidden px-3 py-2 md:table-cell">Access</th>
                <th className="hidden px-3 py-2 md:table-cell">Client ID</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <AppTableRow key={item.app.clientId} {...shared(item)} />
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 sm:space-y-4">
      {/* Page Header Banner */}
      <div className="flex items-center justify-between gap-2.5 rounded-xl border border-gray-200/80 bg-white p-3 shadow-xs sm:p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-black tracking-tight text-gray-900 sm:text-lg">
              {gatingEnabled ? 'Your Products' : 'Platform Directory'}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:text-[11px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)]" />
              <span>
                {gatingEnabled
                  ? `${categorisedApps.accessible.length} of ${dbApps.length} available`
                  : `${dbApps.length} Apps`}
              </span>
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-gray-500 sm:text-xs">{accessSummary}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh application directory"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200/80 bg-gray-50 p-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 sm:px-2.5 sm:py-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin text-orange-500')} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {isAdmin && (
            <Link
              to="/admin/console"
              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-gray-800 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Console</span>
            </Link>
          )}
        </div>
      </div>

      {/* Global Launch Error Banner */}
      {launchError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
          <div className="flex min-w-0 items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            <span className="truncate">{launchError}</span>
          </div>
          <button
            onClick={() => setLaunchError(null)}
            className="flex-shrink-0 px-1.5 py-0.5 text-xs font-bold text-red-500 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="space-y-2 rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-xs sm:p-3">
        <div className="flex w-full min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, slug or ID..."
              className="min-h-10 w-full rounded-lg border border-gray-200/80 bg-gray-50/80 py-1.5 pl-8 pr-6 text-base font-medium text-gray-900 placeholder:text-gray-400 transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[10px] font-bold text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-0.5 rounded-lg border border-gray-200/60 bg-gray-100/80 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={cn(
                'min-h-9 min-w-9 rounded-md transition-colors sm:min-h-8 sm:min-w-8',
                viewMode === 'grid'
                  ? 'bg-white font-bold text-orange-600 shadow-xs'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <Grid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="List View"
              className={cn(
                'min-h-9 min-w-9 rounded-md transition-colors sm:min-h-8 sm:min-w-8',
                viewMode === 'table'
                  ? 'bg-white font-bold text-orange-600 shadow-xs'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="scrollbar-hide flex w-full min-w-0 items-center gap-1.5 overflow-x-auto py-0.5">
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
                'flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold transition-all',
                filter === f.id
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70 hover:text-gray-900',
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.1 font-mono text-[10px] font-bold',
                  filter === f.id
                    ? 'bg-white/25 text-white'
                    : 'border border-gray-200/60 bg-white text-gray-600',
                )}
              >
                {counts[f.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {showLoading ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="min-w-0 animate-pulse space-y-2 rounded-xl border border-gray-200/80 bg-white p-2.5"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="h-8 w-8 rounded-lg bg-gray-100" />
                <div className="h-3 w-8 rounded-full bg-gray-100" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-3/4 rounded bg-gray-100" />
                <div className="h-2 w-full rounded bg-gray-50" />
              </div>
              <div className="mt-2 h-7 w-full rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 text-center">
          <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
          <h4 className="text-sm font-bold text-gray-900">Failed to load platform directory</h4>
          <p className="mt-1 max-w-sm text-xs text-gray-500">
            Could not communicate with the application directory service.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-orange-600"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
          <Search className="mb-2 h-8 w-8 text-gray-300" />
          <h4 className="text-sm font-bold text-gray-900">No applications match your filter</h4>
          <p className="mt-1 text-xs text-gray-400">
            Try adjusting your search query or switching the ecosystem filter.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="mt-3 rounded-lg bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
          >
            Reset Filters
          </button>
        </div>
      ) : gatingEnabled ? (
        <div className="space-y-4 sm:space-y-5">
          <section className="space-y-2 sm:space-y-3">
            <ProductSectionHeader
              icon={CheckCircle2}
              title="Your products"
              count={categorisedApps.accessible.length}
              description={accessSummary}
            />

            {categorisedApps.accessible.length > 0 ? (
              renderApps(categorisedApps.accessible, false)
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
                <Lock className="mx-auto mb-2 h-7 w-7 text-gray-300" />
                <h4 className="text-sm font-bold text-gray-900">Nothing unlocked yet</h4>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500">
                  You don't currently have a membership, trial or access pass covering any products.
                  Choose an option in the section below to unlock your first product.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-2 sm:space-y-3">
            <ProductSectionHeader
              icon={Lock}
              title="Unlock more products"
              count={categorisedApps.locked.length}
              description="These products aren't included in your current membership, trial or access passes. Here's what unlocks each one."
              tone="locked"
            />

            {categorisedApps.locked.length > 0 ? (
              renderApps(categorisedApps.locked, true)
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>You already have access to every product in the directory.</span>
              </div>
            )}
          </section>
        </div>
      ) : (
        renderApps(categorisedApps.accessible, false)
      )}

      {/* Footer Info */}
      <div className="flex flex-col items-center justify-between gap-1.5 rounded-xl border border-gray-200/60 bg-white/70 p-2 text-[10px] text-gray-400 sm:flex-row">
        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 flex-shrink-0 text-emerald-600" />
          <span>Single Sign-On (SSO) active · Endpoints secured with short-lived tokens</span>
        </div>
        {isAdmin && (
          <Link to="/admin/console" className="font-bold text-orange-600 hover:underline">
            Manage applications in Admin Console →
          </Link>
        )}
      </div>
    </div>
  );
}
