import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Gift,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Ticket,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAdminCoupons,
  useAdminPlans,
  useCouponRedemptions,
  useCouponStats,
  useResendCouponEmail,
  useSetCouponStatus,
} from '../../services/admin/hooks';
import type {
  AdminCoupon,
  AdminCouponRedemption,
  CouponSource,
  CouponStatus,
} from '../../services/admin/types';

const STATUS_STYLES: Record<CouponStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  exhausted: 'bg-amber-50 text-amber-700 border-amber-200',
  inactive: 'bg-red-50 text-red-600 border-red-200',
};

const SOURCE_LABELS: Record<CouponSource, string> = {
  ADMIN: 'Admin code',
  TASK_REWARD: 'Task reward',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(value: number): string {
  return `£${Number(value).toFixed(2)}`;
}

function StatusBadge({ status }: { status: CouponStatus }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide', STATUS_STYLES[status])}>
      {status}
    </span>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-xs">
      <span className="text-gray-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 font-bold disabled:opacity-40 hover:bg-gray-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 font-bold disabled:opacity-40 hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function CouponsPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'coupons' | 'ledger'>('coupons');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CouponStatus | ''>('');
  const [source, setSource] = useState<CouponSource | ''>('');
  const [planId, setPlanId] = useState('');
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);

  const [ledgerSearchInput, setLedgerSearchInput] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatus, setLedgerStatus] = useState<'COMPLETED' | 'PENDING' | 'EXPIRED' | ''>('COMPLETED');
  const [ledgerSource, setLedgerSource] = useState<CouponSource | ''>('');
  const [ledgerPlanId, setLedgerPlanId] = useState('');
  const [ledgerFrom, setLedgerFrom] = useState('');
  const [ledgerTo, setLedgerTo] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerCouponId, setLedgerCouponId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLedgerSearch(ledgerSearchInput.trim());
      setLedgerPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [ledgerSearchInput]);

  const { data: plansRes } = useAdminPlans();
  const plans = plansRes?.data ?? [];

  const { data: statsRes, isLoading: statsLoading } = useCouponStats();
  const stats = statsRes?.data;

  const { data: couponsRes, isLoading: couponsLoading, refetch: refetchCoupons } = useAdminCoupons({
    page,
    limit: 20,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(planId ? { planId } : {}),
  });

  const { data: ledgerRes, isLoading: ledgerLoading, refetch: refetchLedger } = useCouponRedemptions({
    page: ledgerPage,
    limit: 20,
    ...(ledgerSearch ? { search: ledgerSearch } : {}),
    ...(ledgerStatus ? { status: ledgerStatus } : {}),
    ...(ledgerSource ? { source: ledgerSource } : {}),
    ...(ledgerPlanId ? { planId: ledgerPlanId } : {}),
    ...(ledgerCouponId ? { couponId: ledgerCouponId } : {}),
    ...(ledgerFrom ? { from: new Date(`${ledgerFrom}T00:00:00`).toISOString() } : {}),
    ...(ledgerTo ? { to: new Date(`${ledgerTo}T23:59:59`).toISOString() } : {}),
  });

  const setStatusMutation = useSetCouponStatus();
  const resendEmail = useResendCouponEmail();

  const coupons = couponsRes?.data ?? [];
  const redemptions = ledgerRes?.data ?? [];

  const statCards = useMemo(
    () => [
      { label: 'Total coupons', value: stats?.totalCoupons ?? 0, icon: Ticket, tone: 'text-gray-700 bg-gray-100' },
      { label: 'Active', value: stats?.activeCoupons ?? 0, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
      { label: 'Redemptions', value: stats?.totalRedemptions ?? 0, icon: Gift, tone: 'text-blue-700 bg-blue-50' },
      { label: 'Discount given', value: formatMoney(stats?.totalDiscountGiven ?? 0), icon: BarChart3, tone: 'text-orange-700 bg-orange-50' },
    ],
    [stats],
  );

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const viewCouponUsage = (coupon: AdminCoupon) => {
    setLedgerCouponId(coupon.id);
    setLedgerSearchInput('');
    setLedgerSearch('');
    setLedgerPage(1);
    setTab('ledger');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{card.label}</p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                  {statsLoading ? '—' : card.value}
                </p>
              </div>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', card.tone)}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => setTab('coupons')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              tab === 'coupons' ? 'bg-brand-blue text-white shadow-glow' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            <Ticket className="w-4 h-4" /> Coupons
          </button>
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              tab === 'ledger' ? 'bg-brand-blue text-white shadow-glow' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            <BarChart3 className="w-4 h-4" /> Redemption ledger
          </button>
        </div>

        {tab === 'coupons' && (
          <button
            type="button"
            onClick={() => navigate('/admin/coupons/new')}
            className="px-4 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2 min-h-[44px] w-fit"
          >
            <Plus className="w-4 h-4" /> Create coupon
          </button>
        )}
      </div>

      {tab === 'coupons' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-col lg:flex-row gap-2.5 lg:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search code or description..."
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as CouponStatus | '');
                  setPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
              >
                <option value="">All statuses</option>
                {(['active', 'scheduled', 'expired', 'exhausted', 'inactive'] as CouponStatus[]).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <select
                value={source}
                onChange={(event) => {
                  setSource(event.target.value as CouponSource | '');
                  setPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
              >
                <option value="">All sources</option>
                <option value="ADMIN">Admin code</option>
                <option value="TASK_REWARD">Task reward</option>
              </select>
              <select
                value={planId}
                onChange={(event) => {
                  setPlanId(event.target.value);
                  setPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 max-w-[190px]"
              >
                <option value="">All memberships</option>
                {plans.map((plan: any) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => refetchCoupons()}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {couponsLoading ? (
            <div className="py-16 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading coupons...
            </div>
          ) : coupons.length === 0 ? (
            <div className="py-16 text-center">
              <Ticket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-700">No coupons match these filters</p>
              <p className="text-xs text-gray-400 mt-1">Create a code or change the filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4">Applies to</th>
                    <th className="py-3 px-4">Usage</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-gray-50/60">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyCode(coupon.code)}
                            className="font-black font-mono text-gray-900 hover:text-brand-blue flex items-center gap-1"
                            title="Copy code"
                          >
                            {coupon.code}
                            {copied === coupon.code ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-400">{SOURCE_LABELS[coupon.source]}</span>
                          {coupon.lockedToUser && (
                            <span className="text-[10px] font-bold text-violet-600 truncate max-w-[180px]">
                              Locked: {coupon.lockedToUser.email}
                            </span>
                          )}
                        </div>
                        {coupon.description && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[230px]">{coupon.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-900">
                          {coupon.discountType === 'PERCENTAGE'
                            ? `${coupon.discountValue}% off`
                            : `${formatMoney(coupon.discountValue)} off`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {coupon.appliesToAllMemberships
                          ? 'All memberships'
                          : coupon.membershipPlans.map((plan) => plan.name).join(', ') || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-gray-900">{coupon.timesRedeemed}</span>
                        <span className="text-gray-400">
                          {coupon.maxUses === null ? ' / unlimited' : ` / ${coupon.maxUses}`}
                        </span>
                        <div className="text-[10px] text-gray-400">
                          {coupon.maxUsesPerUser === null ? 'No per-user cap' : `${coupon.maxUsesPerUser} per user`}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        <div>{formatDate(coupon.expiresAt)}</div>
                        <div className="text-[10px] text-gray-400">From {formatDate(coupon.validFrom)}</div>
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={coupon.status} /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => viewCouponUsage(coupon)}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold"
                            title="View usage"
                          >
                            Usage
                          </button>
                          {coupon.source === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/coupons/${coupon.id}/edit`)}
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-brand-blue"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {coupon.source === 'TASK_REWARD' && (
                            <button
                              type="button"
                              onClick={() => resendEmail.mutate(coupon.id)}
                              disabled={resendEmail.isPending}
                              className="p-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                              title="Resend reward email"
                            >
                              {resendEmail.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {coupon.source === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => setStatusMutation.mutate({ id: coupon.id, isActive: !coupon.isActive })}
                              disabled={setStatusMutation.isPending}
                              className={cn(
                                'p-1.5 rounded-lg disabled:opacity-50',
                                coupon.isActive
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                              )}
                              title={coupon.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {coupon.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={couponsRes?.totalPages ?? 1} onChange={setPage} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            {ledgerCouponId && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs">
                <span className="font-bold text-blue-800">
                  Showing usage for coupon {coupons.find((coupon) => coupon.id === ledgerCouponId)?.code ?? ledgerCouponId}
                </span>
                <button
                  type="button"
                  onClick={() => setLedgerCouponId(null)}
                  className="font-bold text-blue-700 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-2.5 lg:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={ledgerSearchInput}
                  onChange={(event) => setLedgerSearchInput(event.target.value)}
                  placeholder="Search code, email or business..."
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <select
                value={ledgerStatus}
                onChange={(event) => {
                  setLedgerStatus(event.target.value as typeof ledgerStatus);
                  setLedgerPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
              >
                <option value="">All statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending reservation</option>
                <option value="EXPIRED">Expired reservation</option>
              </select>
              <select
                value={ledgerSource}
                onChange={(event) => {
                  setLedgerSource(event.target.value as CouponSource | '');
                  setLedgerPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
              >
                <option value="">All sources</option>
                <option value="ADMIN">Admin code</option>
                <option value="TASK_REWARD">Task reward</option>
              </select>
              <select
                value={ledgerPlanId}
                onChange={(event) => {
                  setLedgerPlanId(event.target.value);
                  setLedgerPage(1);
                }}
                className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 max-w-[180px]"
              >
                <option value="">All memberships</option>
                {plans.map((plan: any) => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => refetchLedger()}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                From
                <input
                  type="date"
                  value={ledgerFrom}
                  onChange={(event) => {
                    setLedgerFrom(event.target.value);
                    setLedgerPage(1);
                  }}
                  className="block mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
                />
              </label>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                To
                <input
                  type="date"
                  value={ledgerTo}
                  onChange={(event) => {
                    setLedgerTo(event.target.value);
                    setLedgerPage(1);
                  }}
                  className="block mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
                />
              </label>
              {(ledgerFrom || ledgerTo || ledgerStatus !== 'COMPLETED' || ledgerSource || ledgerPlanId) && (
                <button
                  type="button"
                  onClick={() => {
                    setLedgerFrom('');
                    setLedgerTo('');
                    setLedgerStatus('COMPLETED');
                    setLedgerSource('');
                    setLedgerPlanId('');
                    setLedgerPage(1);
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-16 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading ledger...
            </div>
          ) : redemptions.length === 0 ? (
            <div className="py-16 text-center">
              <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-700">No redemptions match these filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[980px]">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Coupon</th>
                    <th className="py-3 px-4">User / business</th>
                    <th className="py-3 px-4">Membership</th>
                    <th className="py-3 px-4">Original</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4">Paid</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {redemptions.map((redemption: AdminCouponRedemption) => (
                    <tr key={redemption.id} className="hover:bg-gray-50/60">
                      <td className="py-3 px-4 text-gray-600">
                        <div>{formatDate(redemption.redeemedAt ?? redemption.createdAt)}</div>
                        <div className="text-[10px] text-gray-400">
                          {redemption.redeemedAt
                            ? new Date(redemption.redeemedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                            : 'Not completed'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black font-mono text-gray-900">{redemption.couponCode}</div>
                        <div className="text-[10px] text-gray-400">{SOURCE_LABELS[redemption.source]}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-800">
                          {redemption.user?.name ?? redemption.business?.businessName ?? '—'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {redemption.user?.email ?? redemption.business?.businessName ?? ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {redemption.plan?.name ?? redemption.planName ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{formatMoney(redemption.originalAmount)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">-{formatMoney(redemption.discountAmount)}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{formatMoney(redemption.finalAmount)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase',
                            redemption.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : redemption.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200',
                          )}
                        >
                          {redemption.status === 'COMPLETED' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : redemption.status === 'PENDING' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          {redemption.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={ledgerPage} totalPages={ledgerRes?.totalPages ?? 1} onChange={setLedgerPage} />
        </div>
      )}
    </div>
  );
}
