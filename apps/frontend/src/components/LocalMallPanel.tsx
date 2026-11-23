import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Loader2,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';
import { useMyLocalMall } from '../services/local-mall/hooks';
import type { LocalMallPartner, MyLocalMallOverview } from '../services/local-mall';
import { cn } from '../lib/utils';

interface LocalMallPanelProps {
  /** Where to send the user to update their postcode when nothing is linked. */
  profileHref?: string;
  profileLabel?: string;
  /** Preview/dev screens disable the network call. */
  enabled?: boolean;
  /** Static data for dev previews (skips the network call). */
  previewData?: MyLocalMallOverview;
}

/**
 * The orange "your local mall" card. Shared by the business and customer
 * dashboards so both roles see the same City → Borough → High Street →
 * Local Mall chain and the same partner directory.
 */
export default function LocalMallPanel({
  profileHref,
  profileLabel = 'Update your postcode',
  enabled = true,
  previewData,
}: LocalMallPanelProps) {
  const { data, isLoading, isError, refetch } = useMyLocalMall(enabled && !previewData);

  if (previewData) {
    return <LocalMallContent data={previewData} profileHref={profileHref} profileLabel={profileLabel} />;
  }

  if (isLoading) return <LocalMallSkeleton />;

  if (isError || !data) {
    return (
      <div className="rounded-[28px] border border-orange-200 bg-orange-50 p-6 sm:p-8">
        <p className="text-sm font-semibold text-orange-900">
          We couldn&apos;t load your local mall right now.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <LocalMallContent
      data={data}
      profileHref={profileHref}
      profileLabel={profileLabel}
      onRefresh={() => refetch()}
    />
  );
}

function LocalMallContent({
  data,
  profileHref,
  profileLabel,
  onRefresh,
}: {
  data: MyLocalMallOverview;
  profileHref?: string;
  profileLabel: string;
  onRefresh?: () => void;
}) {
  const mallName = data.localMall?.name || 'No local mall linked yet';
  const coverage = data.postcode
    ? `Covering ${data.postcode}`
    : 'Add your postcode to be placed in a local mall';

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 p-5 text-white shadow-[0_18px_40px_-24px_rgba(234,88,12,0.9)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <Store className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
              Local Mall
            </span>
          </div>

          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{mallName}</h2>
          <p className="mt-1.5 text-xs text-white/85 sm:text-sm">{coverage}</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HierarchyTile icon={Building2} label="City" value={data.city?.name} />
            <HierarchyTile icon={MapPin} label="Borough" value={data.borough?.name} />
            <HierarchyTile icon={Store} label="High Street" value={data.highStreet?.name} />
            <HierarchyTile icon={ShoppingBag} label="Local Mall" value={data.localMall?.name} />
          </div>

          <div className="mt-6 border-t border-white/25 pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold sm:text-xl">Businesses you can partner with</h3>
                <p className="mt-1 text-xs text-white/85 sm:text-sm">
                  Partner-ready businesses in your local mall.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                <Users className="h-4 w-4" />
                {data.partnerCount} {data.partnerCount === 1 ? 'business' : 'businesses'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {data.assigned && data.partners.length > 0 && (
        <PartnerList
          partners={data.partners}
          partnerCount={data.partnerCount}
          hideSelfLabel={data.role === 'BUSINESS'}
        />
      )}

      {data.assigned && data.partners.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          {data.role === 'BUSINESS'
            ? 'You are the first business in this local mall. Other businesses in your postcode area will appear here as they join.'
            : 'No businesses have joined this local mall yet. Check back soon.'}
        </div>
      )}

      {!data.assigned && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              You are not linked to a local mall yet
            </p>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Local malls are resolved from your postcode. Add or update it and we will place you in
              the right city, borough, high street and mall.
            </p>
          </div>
          {profileHref && (
            <Link
              to={profileHref}
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              {profileLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Check again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HierarchyTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 px-4 py-3">
      <div className="flex items-center gap-2 text-white/80">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className={cn('mt-1.5 truncate text-sm font-semibold', value ? 'text-white' : 'text-white/60')}>
        {value || 'Not assigned'}
      </p>
    </div>
  );
}

function PartnerList({
  partners,
  partnerCount,
  hideSelfLabel,
}: {
  partners: LocalMallPartner[];
  partnerCount: number;
  hideSelfLabel: boolean;
}) {
  const remaining = partnerCount - partners.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">
          {hideSelfLabel ? 'Other businesses in your local mall' : 'Businesses in your local mall'}
        </h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {partnerCount} total
        </span>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {partners.map((partner) => (
          <li
            key={partner.id}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
          >
            <PartnerAvatar partner={partner} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{partner.businessName}</p>
              <p className="truncate text-xs text-slate-500">
                {[partner.category || partner.industry].filter(Boolean).join(' · ') ||
                  'Local business'}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <p className="mt-3 text-xs font-medium text-slate-500">
          + {remaining} more {remaining === 1 ? 'business' : 'businesses'} in this local mall
        </p>
      )}
    </div>
  );
}

function PartnerAvatar({ partner }: { partner: LocalMallPartner }) {
  const initials = partner.businessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

  if (partner.logoUrl) {
    return (
      <img
        src={partner.logoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
      />
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-bold text-orange-700">
      {initials || '•'}
    </span>
  );
}

function LocalMallSkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 p-5 text-white sm:p-8">
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 animate-pulse rounded-lg bg-white/20" />
        <span className="h-3 w-24 animate-pulse rounded bg-white/20" />
      </div>
      <div className="mt-4 h-7 w-64 max-w-full animate-pulse rounded bg-white/25" />
      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-white/20" />
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-[72px] animate-pulse rounded-2xl border border-white/25 bg-white/10" />
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-white/25 pt-5">
        <Loader2 className="h-4 w-4 animate-spin text-white/70" />
        <span className="text-xs text-white/85">Loading your local mall…</span>
      </div>
    </div>
  );
}
