import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  Check,
  Copy,
  Gift,
  Loader2,
  Search,
  Ticket,
  TrendingDown,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useMyCoupons } from '../services/business/hooks';
import type { MyCoupon } from '../services/business';

type Tab = 'all' | 'available' | 'used' | 'expired';

const STATUS_STYLES: Record<MyCoupon['usageStatus'], string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_used: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  used: 'bg-blue-50 text-blue-700 border-blue-200',
  scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  exhausted: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_LABELS: Record<MyCoupon['usageStatus'], string> = {
  available: 'Available',
  partially_used: 'Available',
  used: 'Used',
  scheduled: 'Starts soon',
  expired: 'Expired',
  exhausted: 'Fully used',
  inactive: 'Inactive',
};

function formatDate(value: string | null): string {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function discountLabel(coupon: MyCoupon): string {
  return coupon.discountType === 'PERCENTAGE'
    ? `${coupon.discountValue}% off`
    : `£${Number(coupon.discountValue).toFixed(2)} off`;
}

export default function DashboardCoupons() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useMyCoupons();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const coupons = data?.data ?? [];

  const counts = useMemo(
    () => ({
      all: coupons.length,
      available: coupons.filter((coupon) => coupon.canUse).length,
      used: coupons.filter((coupon) => coupon.used).length,
      expired: coupons.filter((coupon) =>
        ['expired', 'exhausted', 'inactive'].includes(coupon.usageStatus),
      ).length,
    }),
    [coupons],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    return coupons.filter((coupon) => {
      if (term && !coupon.code.includes(term) && !(coupon.description ?? '').toUpperCase().includes(term)) {
        return false;
      }
      if (tab === 'available') return coupon.canUse;
      if (tab === 'used') return coupon.used;
      if (tab === 'expired') {
        return ['expired', 'exhausted', 'inactive'].includes(coupon.usageStatus);
      }
      return true;
    });
  }, [coupons, search, tab]);

  const totalSaved = coupons.reduce((sum, coupon) => sum + Number(coupon.totalSaved), 0);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const useCoupon = async (code: string) => {
    await copyCode(code);
    navigate('/dashboard/memberships');
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
        <span className="text-sm font-medium">Loading your coupons...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-black text-gray-900">Could not load your coupons</h2>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Available</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{counts.available}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Used</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{counts.used}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total saved</p>
              <p className="text-2xl font-black text-gray-900 mt-1">£{totalSaved.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-100 w-fit overflow-x-auto">
              {([
                ['all', 'All'],
                ['available', 'Available'],
                ['used', 'Used'],
                ['expired', 'Expired'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all',
                    tab === value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800',
                  )}
                >
                  {label}
                  <span className="ml-1.5 text-[10px] text-gray-400">{counts[value]}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code..."
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-gray-900">
              {coupons.length === 0 ? 'No coupons yet' : 'Nothing matches this filter'}
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              {coupons.length === 0
                ? 'Complete programme tasks with a coupon reward to earn membership discounts. Your codes will appear here.'
                : 'Try another tab or clear the search.'}
            </p>
            {coupons.length === 0 && (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="mt-5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600"
              >
                Go to my programme tasks
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((coupon) => (
              <div key={coupon.id} className="p-4 sm:p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 text-white font-mono text-sm font-black tracking-wider">
                        <Ticket className="w-3.5 h-3.5" />
                        {coupon.code}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide', STATUS_STYLES[coupon.usageStatus])}>
                        {STATUS_LABELS[coupon.usageStatus]}
                      </span>
                      {coupon.isPersonal && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold">
                          Personal to you
                        </span>
                      )}
                      {coupon.usedCount > 1 && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                          Used {coupon.usedCount}×
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                      <span className="font-bold text-orange-600 text-sm">{discountLabel(coupon)}</span>
                      <span className="flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-gray-400" />
                        {coupon.appliesToAllMemberships
                          ? 'All memberships'
                          : coupon.membershipPlans.join(', ') || 'Selected memberships'}
                        {coupon.appliesToAllAccess
                          ? ' · All access passes'
                          : coupon.accessPlans?.length
                            ? ` · ${coupon.accessPlans.join(', ')}`
                            : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                        {coupon.used
                          ? `Last used ${formatDate(coupon.lastUsedAt)}`
                          : coupon.expiresAt
                            ? `Expires ${formatDate(coupon.expiresAt)}`
                            : 'No expiry'}
                      </span>
                    </div>

                    {coupon.description && (
                      <p className="text-[11px] text-gray-400 mt-1">{coupon.description}</p>
                    )}

                    {coupon.used && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-bold text-emerald-700">
                          Saved £{Number(coupon.totalSaved).toFixed(2)}
                        </span>
                        {coupon.redemptions[0] && (
                          <span className="text-gray-400">
                            on {coupon.redemptions[0].planName || 'membership'} ·{' '}
                            {formatDate(coupon.redemptions[0].redeemedAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyCode(coupon.code)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 min-h-[42px]"
                    >
                      {copied === coupon.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                    {coupon.canUse ? (
                      <button
                        type="button"
                        onClick={() => useCoupon(coupon.code)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 min-h-[42px] shadow-sm"
                      >
                        Use coupon
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-gray-50 text-gray-400 text-[11px] font-bold">
                        {coupon.usageStatus === 'used' ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Used
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Unavailable
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
