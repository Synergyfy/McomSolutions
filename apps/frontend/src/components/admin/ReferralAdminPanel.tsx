import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gift,
  History,
  RefreshCw,
  Save,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import {
  useAdminAccessPlans,
  useAdminPlans,
  useAdminReferralConfig,
  useAdminReferralDetail,
  useAdminReferrers,
  usePublishReferralConfig,
} from '../../services/admin/hooks';
import type {
  AdminReferralConfig,
  PublishReferralConfigInput,
  RoleRewardConfig,
} from '../../services/admin/types';

const REFERRAL_ROLES = [
  'BUSINESS',
  'CUSTOMER',
  'AGENT',
  'CONSULTANT',
  'ACCOUNT_MANAGER',
  'PARTNER',
] as const;

function formatCredits(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase();
}

const emptyForm: PublishReferralConfigInput = {
  isActive: true,
  rewardMode: 'SINGLE',
  rewardType: 'PERCENTAGE',
  percentage: 10,
  fixedAmountGbp: null,
  roleRewards: {},
  eligibleRoles: ['BUSINESS', 'CUSTOMER', 'AGENT', 'CONSULTANT', 'ACCOUNT_MANAGER'],
  qualifyAllMemberships: true,
  qualifyAllAccessPasses: true,
  qualifiedMembershipPlanIds: [],
  qualifiedAccessPlanIds: [],
  commissionFrequency: 'RECURRING',
  note: '',
};

function formFromConfig(config: AdminReferralConfig): PublishReferralConfigInput {
  return {
    isActive: config.isActive,
    rewardMode: config.rewardMode,
    rewardType: config.rewardType,
    percentage: config.percentage,
    fixedAmountGbp: config.fixedAmountGbp,
    roleRewards: config.roleRewards ?? {},
    eligibleRoles: config.eligibleRoles ?? [],
    qualifyAllMemberships: config.qualifyAllMemberships,
    qualifyAllAccessPasses: config.qualifyAllAccessPasses,
    qualifiedMembershipPlanIds: config.qualifiedMembershipPlanIds ?? [],
    qualifiedAccessPlanIds: config.qualifiedAccessPlanIds ?? [],
    commissionFrequency: config.commissionFrequency,
    note: config.note ?? '',
  };
}

export default function ReferralAdminPanel() {
  const [tab, setTab] = useState<'referrers' | 'config' | 'changelog'>('referrers');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState<PublishReferralConfigInput>(emptyForm);

  const referrersQuery = useAdminReferrers({
    page,
    limit: 20,
    search: search.trim() || undefined,
  });
  const configQuery = useAdminReferralConfig();
  const plansQuery = useAdminPlans();
  const accessPlansQuery = useAdminAccessPlans();
  const detailQuery = useAdminReferralDetail(selectedId ?? undefined);
  const publishMutation = usePublishReferralConfig();

  const currentConfig = configQuery.data?.data.current ?? null;
  const configHistory = configQuery.data?.data.history ?? [];
  const referrers = referrersQuery.data?.data ?? [];
  const membershipPlans = plansQuery.data?.data ?? [];
  const accessPlans = accessPlansQuery.data?.data ?? [];
  const detail = detailQuery.data?.data;

  useEffect(() => {
    if (currentConfig) setForm(formFromConfig(currentConfig));
  }, [currentConfig?.id]);

  const activePlanCount = useMemo(() => {
    const memberships = form.qualifyAllMemberships ? 0 : form.qualifiedMembershipPlanIds?.length ?? 0;
    const passes = form.qualifyAllAccessPasses ? 0 : form.qualifiedAccessPlanIds?.length ?? 0;
    return memberships + passes;
  }, [form]);

  const updateRoleReward = (role: string, patch: Partial<RoleRewardConfig>) => {
    setForm((current) => {
      const existing = current.roleRewards?.[role] ?? {
        rewardType: 'PERCENTAGE',
        percentage: 0,
        fixedAmountGbp: null,
      };
      return {
        ...current,
        roleRewards: {
          ...(current.roleRewards ?? {}),
          [role]: { ...existing, ...patch },
        },
      };
    });
  };

  const toggleEligibleRole = (role: string) => {
    setForm((current) => {
      const roles = new Set(current.eligibleRoles ?? []);
      if (roles.has(role)) roles.delete(role);
      else roles.add(role);
      return { ...current, eligibleRoles: Array.from(roles) };
    });
  };

  const togglePlan = (
    key: 'qualifiedMembershipPlanIds' | 'qualifiedAccessPlanIds',
    planId: string,
  ) => {
    setForm((current) => {
      const values = new Set(current[key] ?? []);
      if (values.has(planId)) values.delete(planId);
      else values.add(planId);
      return { ...current, [key]: Array.from(values) };
    });
  };

  const saveConfig = async () => {
    setNotice(null);
    try {
      await publishMutation.mutateAsync({
        ...form,
        percentage:
          form.rewardType === 'PERCENTAGE' ? Number(form.percentage ?? 0) : null,
        fixedAmountGbp:
          form.rewardType === 'FIXED' ? Number(form.fixedAmountGbp ?? 0) : null,
        note: form.note?.trim() || undefined,
      });
      setNotice({ type: 'success', message: 'New referral configuration published.' });
      setTab('changelog');
    } catch (error: any) {
      setNotice({
        type: 'error',
        message:
          error?.response?.data?.message ||
          error?.message ||
          'Could not publish the referral configuration.',
      });
    }
  };

  const openDetail = (userId: string) => {
    setSelectedId(userId);
    setTab('referrers');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
            Referral programme
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            Referral rewards
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            See who is actively referring, how much they earned from each person, and publish the
            commission rules used for every new qualifying purchase.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void referrersQuery.refetch();
            void configQuery.refetch();
          }}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <X className="h-4 w-4 shrink-0" />
            )}
            {notice.message}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Referral admin sections">
        {[
          { key: 'referrers' as const, label: 'Referrers', icon: Users },
          { key: 'config' as const, label: 'Configuration', icon: Settings2 },
          { key: 'changelog' as const, label: 'Changelog', icon: History },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              if (item.key !== 'referrers') setSelectedId(null);
            }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
              tab === item.key
                ? 'bg-blue-700 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {selectedId && tab === 'referrers' ? (
        <section className="space-y-5">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to all referrers
          </button>

          {detailQuery.isLoading ? (
            <p className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
              Loading referrer details…
            </p>
          ) : detailQuery.isError || !detail ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              Could not load this referrer.
            </p>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {[detail.referrer.firstName, detail.referrer.lastName]
                        .filter(Boolean)
                        .join(' ') || detail.referrer.email}
                    </h2>
                    <p className="text-sm text-gray-500">{detail.referrer.email}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {detail.referrer.role.replaceAll('_', ' ')} · code{' '}
                      {detail.referrer.referralCode || '—'}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-blue-50 px-4 py-3">
                      <p className="text-2xl font-black text-blue-800">
                        {detail.summary.totalReferrals}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-blue-700/70">Referred</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-4 py-3">
                      <p className="text-2xl font-black text-emerald-800">
                        {detail.summary.creditedReferrals}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-emerald-700/70">Earning</p>
                    </div>
                    <div className="rounded-xl bg-orange-50 px-4 py-3">
                      <p className="text-2xl font-black text-orange-800">
                        {formatCredits(detail.summary.totalEarnedCredits)}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-orange-700/70">MCOM earned</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 p-4">
                  <h3 className="font-bold text-gray-900">People referred</h3>
                  <p className="text-xs text-gray-500">
                    Earnings are commission credits credited to this referrer's MCOM wallet.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-bold">Referred person</th>
                        <th className="px-4 py-3 font-bold">Role</th>
                        <th className="px-4 py-3 font-bold">Joined</th>
                        <th className="px-4 py-3 font-bold">Qualifying purchases</th>
                        <th className="px-4 py-3 text-right font-bold">Earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detail.referredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No referrals yet.
                          </td>
                        </tr>
                      ) : (
                        detail.referredUsers.map((referred) => (
                          <tr key={referred.id}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{referred.displayName}</p>
                              <p className="text-xs text-gray-500">{referred.email}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {referred.role.replaceAll('_', ' ')}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {new Date(referred.joinedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {referred.creditedCount} credited / {referred.evaluationCount} evaluated
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-bold text-emerald-700">
                                {formatCredits(referred.earnedCredits)} MCOM
                              </p>
                              <p className="text-[11px] text-gray-400">
                                £{Number(referred.earnedGbp).toFixed(2)} commission
                              </p>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 p-4">
                  <h3 className="font-bold text-gray-900">Commission history</h3>
                  <p className="text-xs text-gray-500">
                    Every evaluated purchase, including skipped rows.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-bold">Referred person</th>
                        <th className="px-4 py-3 font-bold">Purchase</th>
                        <th className="px-4 py-3 font-bold">Source amount</th>
                        <th className="px-4 py-3 font-bold">Commission</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 text-right font-bold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detail.history.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No commission history yet.
                          </td>
                        </tr>
                      ) : (
                        detail.history.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">
                                {entry.referredName || entry.referredEmail || 'Referred user'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {entry.sourceName || entry.sourceType.replaceAll('_', ' ')}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              £{Number(entry.purchaseAmountGbp).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <p
                                className={`font-bold ${
                                  entry.status === 'CREDITED'
                                    ? 'text-emerald-700'
                                    : 'text-gray-500'
                                }`}
                              >
                                {formatCredits(entry.commissionCredits)} MCOM
                              </p>
                              <p className="text-[11px] text-gray-400">
                                £{Number(entry.commissionAmountGbp).toFixed(2)}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  entry.status === 'CREDITED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {statusLabel(entry.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-500">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      ) : tab === 'referrers' ? (
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Active referrers</h2>
              <p className="text-xs text-gray-500">
                {referrersQuery.data?.total ?? 0} people have referred at least one account.
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, email or code"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 sm:w-72"
            />
          </div>

          {referrersQuery.isLoading ? (
            <p className="p-8 text-center text-sm text-gray-500">Loading referrers…</p>
          ) : referrersQuery.isError ? (
            <p className="p-8 text-center text-sm text-red-600">Could not load referrers.</p>
          ) : referrers.length === 0 ? (
            <div className="p-10 text-center">
              <Gift className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 font-semibold text-gray-700">No active referrers yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Users appear here as soon as someone registers with their referral link.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Referrer</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">Referred</th>
                    <th className="px-4 py-3 font-bold">Credited</th>
                    <th className="px-4 py-3 font-bold">Skipped</th>
                    <th className="px-4 py-3 font-bold">Earned</th>
                    <th className="px-4 py-3 text-right font-bold">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {referrers.map((referrer) => (
                    <tr
                      key={referrer.id}
                      className="cursor-pointer hover:bg-gray-50/70"
                      onClick={() => openDetail(referrer.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{referrer.displayName}</p>
                        <p className="text-xs text-gray-500">{referrer.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {referrer.role.replaceAll('_', ' ')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {referrer.totalReferrals}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {referrer.creditedCommissions}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {referrer.skippedEvaluations}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-emerald-700">
                          {formatCredits(referrer.earnedCredits)} MCOM
                        </p>
                        <p className="text-[11px] text-gray-400">
                          £{Number(referrer.earnedGbp).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {referrer.lastActivityAt
                          ? new Date(referrer.lastActivityAt).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(referrersQuery.data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 p-4 text-xs text-gray-500">
              <span>
                Page {referrersQuery.data?.page} of {referrersQuery.data?.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-md border border-gray-200 p-2 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= (referrersQuery.data?.totalPages ?? 1)}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-md border border-gray-200 p-2 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      ) : tab === 'config' ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Publishing creates a new immutable version. The newest version is used for every
            subsequent purchase and the changelog can never be deleted.
            {currentConfig && (
              <span className="ml-1 font-semibold">Current version: {currentConfig.version}.</span>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900">Commission rule</h2>
                <p className="text-xs text-gray-500">
                  Choose one value for every eligible role, or configure each role separately.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="size-4 rounded border-gray-300"
                />
                Programme active
              </label>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">Reward mode</span>
                <select
                  value={form.rewardMode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rewardMode: event.target.value as 'SINGLE' | 'PER_ROLE',
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  <option value="SINGLE">Same reward for all eligible roles</option>
                  <option value="PER_ROLE">Different reward per role</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">Commission type</span>
                <select
                  value={form.rewardType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rewardType: event.target.value as 'PERCENTAGE' | 'FIXED',
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  <option value="PERCENTAGE">Percentage of purchase</option>
                  <option value="FIXED">Fixed GBP amount</option>
                </select>
              </label>
              {form.rewardType === 'PERCENTAGE' ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-gray-600">
                    Default percentage (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.percentage ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        percentage: Number(event.target.value),
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-gray-600">
                    Default fixed amount (£)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.fixedAmountGbp ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fixedAmountGbp: Number(event.target.value),
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">
                  Commission frequency
                </span>
                <select
                  value={form.commissionFrequency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      commissionFrequency: event.target.value as 'ONE_TIME' | 'RECURRING',
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
                >
                  <option value="RECURRING">Recurring — every qualifying purchase</option>
                  <option value="ONE_TIME">One-time — first qualifying purchase only</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="font-bold text-gray-900">Roles qualified to earn</h2>
            <p className="text-xs text-gray-500">
              A referral is always recorded. Commission is only paid when the referrer's role is
              selected here.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {REFERRAL_ROLES.map((role) => (
                <label
                  key={role}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    form.eligibleRoles.includes(role)
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.eligibleRoles.includes(role)}
                    onChange={() => toggleEligibleRole(role)}
                    className="size-4 rounded border-gray-300"
                  />
                  {role.replaceAll('_', ' ')}
                </label>
              ))}
            </div>
          </div>

          {form.rewardMode === 'PER_ROLE' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <h2 className="font-bold text-gray-900">Reward per role</h2>
              <p className="text-xs text-gray-500">
                Roles left blank fall back to the default rule above.
              </p>
              <div className="mt-4 space-y-3">
                {REFERRAL_ROLES.filter((role) => form.eligibleRoles.includes(role)).map((role) => {
                  const reward = form.roleRewards?.[role] ?? {
                    rewardType: form.rewardType,
                    percentage: form.percentage,
                    fixedAmountGbp: form.fixedAmountGbp,
                  };
                  return (
                    <div
                      key={role}
                      className="grid gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:grid-cols-[1fr_150px_160px] sm:items-center"
                    >
                      <span className="text-xs font-bold text-gray-700">
                        {role.replaceAll('_', ' ')}
                      </span>
                      <select
                        value={reward.rewardType}
                        onChange={(event) =>
                          updateRoleReward(role, {
                            rewardType: event.target.value as 'PERCENTAGE' | 'FIXED',
                          })
                        }
                        className="h-9 rounded-md border border-gray-200 px-2 text-xs"
                      >
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="FIXED">Fixed GBP</option>
                      </select>
                      {reward.rewardType === 'PERCENTAGE' ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={reward.percentage ?? ''}
                          onChange={(event) =>
                            updateRoleReward(role, {
                              percentage: Number(event.target.value),
                            })
                          }
                          placeholder="%"
                          className="h-9 rounded-md border border-gray-200 px-2 text-xs"
                        />
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={reward.fixedAmountGbp ?? ''}
                          onChange={(event) =>
                            updateRoleReward(role, {
                              fixedAmountGbp: Number(event.target.value),
                            })
                          }
                          placeholder="£"
                          className="h-9 rounded-md border border-gray-200 px-2 text-xs"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900">Qualified memberships</h2>
                  <p className="text-xs text-gray-500">
                    Which membership purchases earn commission.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.qualifyAllMemberships ?? true}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        qualifyAllMemberships: event.target.checked,
                      }))
                    }
                    className="size-4 rounded border-gray-300"
                  />
                  All
                </label>
              </div>
              {!form.qualifyAllMemberships && (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-100 p-2">
                  {membershipPlans.length === 0 ? (
                    <p className="p-2 text-xs text-gray-500">No membership plans found.</p>
                  ) : (
                    membershipPlans.map((plan) => (
                      <label
                        key={plan.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={(form.qualifiedMembershipPlanIds ?? []).includes(plan.id)}
                          onChange={() => togglePlan('qualifiedMembershipPlanIds', plan.id)}
                          className="size-4 rounded border-gray-300"
                        />
                        <span className="font-semibold">{plan.name}</span>
                        <span className="ml-auto text-gray-400">£{plan.price}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-gray-900">Qualified access passes</h2>
                  <p className="text-xs text-gray-500">
                    Which access-pass purchases earn commission.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.qualifyAllAccessPasses ?? true}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        qualifyAllAccessPasses: event.target.checked,
                      }))
                    }
                    className="size-4 rounded border-gray-300"
                  />
                  All
                </label>
              </div>
              {!form.qualifyAllAccessPasses && (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-100 p-2">
                  {accessPlans.length === 0 ? (
                    <p className="p-2 text-xs text-gray-500">No access plans found.</p>
                  ) : (
                    accessPlans.map((plan) => (
                      <label
                        key={plan.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={(form.qualifiedAccessPlanIds ?? []).includes(plan.id)}
                          onChange={() => togglePlan('qualifiedAccessPlanIds', plan.id)}
                          className="size-4 rounded border-gray-300"
                        />
                        <span className="font-semibold">{plan.name}</span>
                        <span className="ml-auto text-gray-400">£{plan.price}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-gray-600">
                Changelog note (optional)
              </span>
              <textarea
                value={form.note ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                rows={3}
                maxLength={500}
                placeholder="Why is this rule changing?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {activePlanCount > 0
                  ? `${activePlanCount} specific plan${activePlanCount === 1 ? '' : 's'} selected for qualification.`
                  : 'All memberships and access passes qualify unless changed above.'}
              </p>
              <button
                type="button"
                onClick={() => void saveConfig()}
                disabled={publishMutation.isPending || form.eligibleRoles.length === 0}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {publishMutation.isPending ? 'Publishing…' : 'Publish new version'}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-4">
            <h2 className="font-bold text-gray-900">Configuration changelog</h2>
            <p className="text-xs text-gray-500">
              Immutable history of every published rule. The current version is used for new
              purchases.
            </p>
          </div>
          {configHistory.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              No referral configuration has been published yet.
            </p>
          ) : (
            <ol className="divide-y divide-gray-100">
              {configHistory.map((version) => (
                <li key={version.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">
                        <History className="h-3.5 w-3.5" /> Version {version.version}
                      </span>
                      {version.isCurrent && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          Current
                        </span>
                      )}
                      {!version.isActive && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(version.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-gray-600">
                    {version.commissionFrequency === 'RECURRING' ? 'Recurring' : 'One-time'} ·{' '}
                    {version.rewardType === 'PERCENTAGE'
                      ? `${version.percentage ?? 0}%`
                      : `£${Number(version.fixedAmountGbp ?? 0).toFixed(2)}`}{' '}
                    · roles: {version.eligibleRoles.join(', ') || 'none'}
                  </p>
                  {version.note && (
                    <p className="mt-1 text-xs italic text-gray-500">“{version.note}”</p>
                  )}
                  <div className="mt-2 space-y-1">
                    {version.changes.length === 0 ? (
                      <p className="text-[11px] text-gray-400">No field-level changes recorded.</p>
                    ) : (
                      version.changes.map((change, index) => (
                        <p key={`${change.field}-${index}`} className="text-[11px] text-gray-500">
                          <span className="font-semibold text-gray-700">{change.field}</span>:{' '}
                          {JSON.stringify(change.from)} → {JSON.stringify(change.to)}
                        </p>
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
