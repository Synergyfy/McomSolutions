import { useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import {
  EmptyState,
  ErrorNote,
  Section,
  Spinner,
  StatusBadge,
  formatDate,
  formatMoneyMinor,
  formatPoints,
} from '../../local-affiliate/ui';
import {
  useAdminAffiliateDetail,
  useAdminAffiliateMutation,
  useAdminAffiliateOverview,
  useAdminAffiliates,
  useAdminCampaigns,
  useAdminConversions,
  useAdminOffers,
  useAdminProviders,
  useAdminReconciliation,
  useAdminRewardRules,
  useAdminVouchers,
} from '../../../services/local-affiliate/hooks';
import { localAffiliateAdminApi } from '../../../services/local-affiliate';

const btn =
  'inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const btnPrimary =
  'inline-flex min-h-8 items-center gap-1 rounded-lg bg-orange-600 px-2.5 text-[11px] font-semibold text-white hover:bg-orange-700 disabled:opacity-50';
const input =
  'mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs';

// ── 1. Affiliates ────────────────────────────────────────────────────────

export function LocalAffiliatesAdminPanel() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const list = useAdminAffiliates({ limit: 25, status: status || undefined, search: search || undefined });
  const setStatusMutation = useAdminAffiliateMutation(
    ({ id, action, reason }: { id: string; action: 'suspend' | 'reinstate' | 'close'; reason?: string }) =>
      localAffiliateAdminApi.setAffiliateStatus(id, action, reason),
  );

  return (
    <div className="space-y-4">
      <Section
        title="Local Affiliates"
        description="Consumer affiliate profiles. Each row is an existing CHS identity — never a second account."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name or email"
              className="min-h-9 w-52 rounded-lg border border-slate-300 px-2.5 text-xs"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="min-h-9 rounded-lg border border-slate-300 px-2 text-xs"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        }
      >
        {list.isLoading ? (
          <Spinner />
        ) : (list.data?.data.length ?? 0) === 0 ? (
          <EmptyState title="No affiliates match this filter" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Code</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Links</th>
                  <th className="py-2">Created</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data!.data.map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-2 font-mono text-[11px]">{a.affiliateCode}</td>
                    <td className="py-2">{a.displayName || `${a.user?.firstName ?? ''} ${a.user?.lastName ?? ''}`.trim() || '—'}</td>
                    <td className="py-2 text-slate-600">{a.user?.email}</td>
                    <td className="py-2"><StatusBadge status={a.status} /></td>
                    <td className="py-2 tabular-nums">{a._count?.trackingLinks ?? 0}</td>
                    <td className="py-2 text-slate-500">{formatDate(a.createdAt)}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        <button className={btn} onClick={() => setSelected(a.id)}>View</button>
                        {a.status === 'SUSPENDED' ? (
                          <button
                            className={btn}
                            onClick={() =>
                              setStatusMutation.mutate({ id: a.id, action: 'reinstate' })
                            }
                          >
                            Reinstate
                          </button>
                        ) : (
                          <button
                            className={btn}
                            onClick={() =>
                              setStatusMutation.mutate({ id: a.id, action: 'suspend', reason: 'Suspended from admin' })
                            }
                          >
                            Suspend
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
      </Section>

      {selected ? <AffiliateDetail id={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function AffiliateDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useAdminAffiliateDetail(id);
  const data = detail.data?.data;

  return (
    <Section
      title="Affiliate detail"
      action={<button className={btn} onClick={onClose}>Close</button>}
    >
      {detail.isLoading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase text-slate-500">Code</p>
              <p className="font-mono text-xs">{data.profile.affiliateCode}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Status</p>
              <StatusBadge status={data.profile.status} />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Available points</p>
              <p className="text-xs font-semibold">{formatPoints(data.balances.available)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Pending points</p>
              <p className="text-xs font-semibold">{formatPoints(data.balances.pending)}</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase text-slate-500">Recent ledger</p>
            <div className="divide-y divide-slate-100">
              {data.ledger.slice(0, 8).map((row: any) => (
                <div key={row.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                  <span className="truncate">{row.description}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums">{formatPoints(row.units)}</span>
                    <StatusBadge status={row.status} />
                  </span>
                </div>
              ))}
              {data.ledger.length === 0 ? <p className="py-2 text-xs text-slate-500">No ledger entries.</p> : null}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

// ── 2. Offers & campaigns ────────────────────────────────────────────────

export function AffiliateOffersAdminPanel() {
  const offers = useAdminOffers({ limit: 25 });
  const providers = useAdminProviders();
  const rules = useAdminRewardRules();
  const campaigns = useAdminCampaigns();

  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    providerId: '',
    title: '',
    destinationUrl: '',
    rewardRuleId: '',
    customerBenefitLabel: '',
  });

  const createOffer = useAdminAffiliateMutation((body: Record<string, unknown>) =>
    localAffiliateAdminApi.createOffer(body),
  );
  const approve = useAdminAffiliateMutation((id: string) =>
    localAffiliateAdminApi.approveOffer(id),
  );
  const pause = useAdminAffiliateMutation((id: string) =>
    localAffiliateAdminApi.pauseOffer(id),
  );

  const submit = async () => {
    setError(null);
    try {
      await createOffer.mutateAsync({
        providerId: form.providerId,
        title: form.title,
        destinationUrl: form.destinationUrl,
        ...(form.rewardRuleId ? { rewardRuleId: form.rewardRuleId } : {}),
        ...(form.customerBenefitLabel
          ? { customerBenefit: { type: 'LABEL', label: form.customerBenefitLabel } }
          : {}),
      });
      setForm({ providerId: '', title: '', destinationUrl: '', rewardRuleId: '', customerBenefitLabel: '' });
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(
        message === 'REWARD_EVENT_NOT_VERIFIABLE'
          ? 'This provider cannot verify the event this reward rule pays on. A link-only provider can never promise a sale reward.'
          : message === 'INVALID_DESTINATION_URL'
            ? 'The destination URL must be an absolute http(s) URL.'
            : Array.isArray(e?.response?.data?.errors)
              ? e.response.data.errors.join(', ')
              : 'Could not create the offer.',
      );
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Create an offer" description="Offers reference a provider product; the provider keeps ownership.">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-medium text-slate-600">
            Provider
            <select
              value={form.providerId}
              onChange={(e) => setForm({ ...form, providerId: e.target.value })}
              className={input}
            >
              <option value="">Select a provider…</option>
              {(providers.data?.data ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.integrationLevel}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Reward rule (optional)
            <select
              value={form.rewardRuleId}
              onChange={(e) => setForm({ ...form, rewardRuleId: e.target.value })}
              className={input}
            >
              <option value="">No affiliate reward</option>
              {(rules.data?.data ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  v{r.version} · {r.name} · {r.qualifyingEvent}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Destination URL
            <input
              value={form.destinationUrl}
              onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
              placeholder="https://…"
              className={input}
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600 sm:col-span-2">
            Customer benefit label (optional)
            <input
              value={form.customerBenefitLabel}
              onChange={(e) => setForm({ ...form, customerBenefitLabel: e.target.value })}
              placeholder="20% off the bill"
              className={input}
            />
          </label>
        </div>
        {error ? <div className="mt-2"><ErrorNote message={error} /></div> : null}
        <button
          className={`${btnPrimary} mt-3`}
          onClick={submit}
          disabled={createOffer.isPending || !form.providerId || !form.title || !form.destinationUrl}
        >
          Create offer
        </button>
      </Section>

      <Section
        title="Offers"
        description="Only ACTIVE offers appear in the marketplace."
        action={
          <button className={btn} onClick={() => offers.refetch()}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        }
      >
        {offers.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Title</th>
                  <th className="py-2">Provider</th>
                  <th className="py-2">Level</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(offers.data?.data ?? []).map((o: any) => (
                  <tr key={o.id}>
                    <td className="py-2">{o.title}</td>
                    <td className="py-2 text-slate-600">{o.provider?.name}</td>
                    <td className="py-2 text-[10px] text-slate-500">{o.integrationLevel}</td>
                    <td className="py-2"><StatusBadge status={o.status} /></td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        {o.status !== 'ACTIVE' ? (
                          <button className={btnPrimary} onClick={() => approve.mutate(o.id)}>
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </button>
                        ) : (
                          <button className={btn} onClick={() => pause.mutate(o.id)}>
                            <XCircle className="h-3 w-3" /> Pause
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
      </Section>

      <Section title="Campaigns" description="A campaign groups offers with shared dates, caps and eligibility.">
        {campaigns.isLoading ? (
          <Spinner />
        ) : (campaigns.data?.data.length ?? 0) === 0 ? (
          <EmptyState title="No campaigns yet" />
        ) : (
          <div className="divide-y divide-slate-100">
            {campaigns.data!.data.map((c: any) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.code} · {c._count?.offers ?? 0} offers · cap{' '}
                    {c.rewardCapUnits ? formatPoints(c.rewardCapUnits) : 'none'} · issued{' '}
                    {formatPoints(c.budgetUnitsIssued)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── 3. Rewards ───────────────────────────────────────────────────────────

export function AffiliateRewardsAdminPanel() {
  const rules = useAdminRewardRules();
  const conversions = useAdminConversions({ limit: 25 });
  const vouchers = useAdminVouchers({ limit: 25 });

  const [error, setError] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    qualifyingEvent: 'APPROVED_PURCHASE',
    calculation: 'FIXED',
    unit: 'POINTS',
    fixedUnits: '100',
    percentage: '',
    pointsPerCurrencyUnit: '10',
    approvalMode: 'ADMIN_CONFIRMATION',
    expiryDays: '180',
  });

  const createRule = useAdminAffiliateMutation((body: Record<string, unknown>) =>
    localAffiliateAdminApi.createRewardRule(body),
  );
  const approveConversion = useAdminAffiliateMutation((id: string) =>
    localAffiliateAdminApi.approveConversion(id, 'Approved by admin'),
  );
  const rejectConversion = useAdminAffiliateMutation((id: string) =>
    localAffiliateAdminApi.rejectConversion(id, 'NOT_ELIGIBLE', 'Rejected by admin'),
  );
  const reverseConversion = useAdminAffiliateMutation((id: string) =>
    localAffiliateAdminApi.reverseConversion(id, 'REFUNDED'),
  );
  const revokeVoucher = useAdminAffiliateMutation((id: string) =>
    localAffiliateAdminApi.revokeVoucher(id, 'Revoked by admin'),
  );

  const submitRule = async () => {
    setError(null);
    try {
      await createRule.mutateAsync({
        name: ruleForm.name,
        qualifyingEvent: ruleForm.qualifyingEvent,
        rewardType: 'POINTS',
        calculation: ruleForm.calculation,
        unit: ruleForm.unit,
        ...(ruleForm.calculation === 'FIXED'
          ? { fixedUnits: Number(ruleForm.fixedUnits) }
          : {}),
        ...(ruleForm.calculation === 'PERCENTAGE'
          ? {
              percentage: Number(ruleForm.percentage),
              ...(ruleForm.unit === 'POINTS'
                ? { pointsPerCurrencyUnit: Number(ruleForm.pointsPerCurrencyUnit) }
                : {}),
            }
          : {}),
        approvalMode: ruleForm.approvalMode,
        expiryDays: Number(ruleForm.expiryDays),
      });
      setRuleForm({ ...ruleForm, name: '' });
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(
        Array.isArray(e?.response?.data?.errors)
          ? e.response.data.errors.join(', ')
          : message ?? 'Could not publish the reward rule.',
      );
    }
  };

  return (
    <div className="space-y-4">
      <Section
        title="Publish a reward rule"
        description="Rules are versioned and immutable. An offer can only use a rule whose event its provider can verify."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-[11px] font-medium text-slate-600 sm:col-span-2">
            Name
            <input value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} className={input} />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Qualifying event
            <select
              value={ruleForm.qualifyingEvent}
              onChange={(e) => setRuleForm({ ...ruleForm, qualifyingEvent: e.target.value })}
              className={input}
            >
              {[
                'APPROVED_PURCHASE',
                'COMPLETED_BOOKING',
                'VERIFIED_REDEMPTION',
                'VERIFIED_LEAD',
                'QUALIFIED_VISIT',
                'LINK_CLICK',
              ].map((e) => (
                <option key={e} value={e}>{e.replaceAll('_', ' ').toLowerCase()}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Calculation
            <select
              value={ruleForm.calculation}
              onChange={(e) => setRuleForm({ ...ruleForm, calculation: e.target.value })}
              className={input}
            >
              <option value="FIXED">Fixed</option>
              <option value="PERCENTAGE">Percentage</option>
            </select>
          </label>
          {ruleForm.calculation === 'FIXED' ? (
            <label className="text-[11px] font-medium text-slate-600">
              Points
              <input type="number" value={ruleForm.fixedUnits} onChange={(e) => setRuleForm({ ...ruleForm, fixedUnits: e.target.value })} className={input} />
            </label>
          ) : (
            <>
              <label className="text-[11px] font-medium text-slate-600">
                Percentage
                <input type="number" value={ruleForm.percentage} onChange={(e) => setRuleForm({ ...ruleForm, percentage: e.target.value })} className={input} />
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Points per £1
                <input type="number" value={ruleForm.pointsPerCurrencyUnit} onChange={(e) => setRuleForm({ ...ruleForm, pointsPerCurrencyUnit: e.target.value })} className={input} />
              </label>
            </>
          )}
          <label className="text-[11px] font-medium text-slate-600">
            Approval basis
            <select
              value={ruleForm.approvalMode}
              onChange={(e) => setRuleForm({ ...ruleForm, approvalMode: e.target.value })}
              className={input}
            >
              <option value="AUTOMATIC">Automatic</option>
              <option value="REDEMPTION_VALIDATION">Redemption validation</option>
              <option value="PROVIDER_CONFIRMATION">Provider confirmation</option>
              <option value="ADMIN_CONFIRMATION">Admin confirmation</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Expiry (days)
            <input type="number" value={ruleForm.expiryDays} onChange={(e) => setRuleForm({ ...ruleForm, expiryDays: e.target.value })} className={input} />
          </label>
        </div>
        {error ? <div className="mt-2"><ErrorNote message={error} /></div> : null}
        <button className={`${btnPrimary} mt-3`} onClick={submitRule} disabled={createRule.isPending || !ruleForm.name}>
          Publish version
        </button>
      </Section>

      <Section title="Reward rule versions">
        {rules.isLoading ? (
          <Spinner />
        ) : (
          <div className="divide-y divide-slate-100">
            {rules.data!.data.map((r: any) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <div>
                  <p className="font-medium text-slate-900">
                    v{r.version} · {r.name}
                    {r.isCurrent ? <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">current</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {r.qualifyingEvent} · {r.calculation} · {r.approvalMode} · expiry{' '}
                    {r.expiryDays ?? 'never'}
                  </p>
                </div>
                <span className="tabular-nums text-slate-700">
                  {r.calculation === 'FIXED'
                    ? `${formatPoints(r.fixedUnits)} ${r.unit.toLowerCase()}`
                    : `${Number(r.percentage)}% → ${formatPoints(r.pointsPerCurrencyUnit)} pts/£1`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Conversions" description="Provider events awaiting a decision.">
        {conversions.isLoading ? (
          <Spinner />
        ) : (conversions.data?.data.length ?? 0) === 0 ? (
          <EmptyState title="No conversions yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Event</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Affiliate</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Reward</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conversions.data!.data.map((c: any) => (
                  <tr key={c.id}>
                    <td className="py-2">{c.eventType.replaceAll('_', ' ').toLowerCase()}</td>
                    <td className="py-2 tabular-nums">{formatMoneyMinor(c.amountMinor, c.currency)}</td>
                    <td className="py-2 font-mono text-[10px] text-slate-500">{c.localAffiliateId ? c.localAffiliateId.slice(-8) : 'unmatched'}</td>
                    <td className="py-2"><StatusBadge status={c.status} /></td>
                    <td className="py-2">
                      {c.ledger?.length
                        ? c.ledger.map((l: any) => (
                            <span key={l.id} className="mr-1">
                              <StatusBadge status={l.status} />
                            </span>
                          ))
                        : '—'}
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        <button className={btnPrimary} onClick={() => approveConversion.mutate(c.id)}>
                          Approve
                        </button>
                        <button className={btn} onClick={() => rejectConversion.mutate(c.id)}>
                          Reject
                        </button>
                        <button className={btn} onClick={() => reverseConversion.mutate(c.id)}>
                          Reverse
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Vouchers" description="Codes the referred customer presents.">
        {vouchers.isLoading ? (
          <Spinner />
        ) : (vouchers.data?.data.length ?? 0) === 0 ? (
          <EmptyState title="No vouchers issued" />
        ) : (
          <div className="divide-y divide-slate-100">
            {vouchers.data!.data.map((v: any) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                <div>
                  <p className="font-mono text-[11px] font-semibold">{v.code}</p>
                  <p className="text-[11px] text-slate-500">
                    {v.offer?.title ?? 'Offer'} · {v.usedCount}/{v.maxUses} used
                    {v.expiresAt ? ` · expires ${formatDate(v.expiresAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={v.status} />
                  {v.status === 'ISSUED' || v.status === 'PARTIALLY_REDEEMED' ? (
                    <button className={btn} onClick={() => revokeVoucher.mutate(v.id)}>
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── 4. Reconciliation & reports ──────────────────────────────────────────

const QUEUE_LABELS: Record<string, string> = {
  unmatched_conversions: 'Unmatched conversions',
  duplicate_transactions: 'Duplicate transactions',
  failed_syncs: 'Failed provider syncs',
  negative_balances: 'Negative balances',
  over_budget_campaigns: 'Over-budget campaigns',
  stale_providers: 'Stale providers',
  identity_unverifiable: 'Offers with unverifiable identity',
};

export function AffiliateReconciliationAdminPanel() {
  const reconciliation = useAdminReconciliation();
  const overview = useAdminAffiliateOverview();

  return (
    <div className="space-y-4">
      <Section
        title="Programme overview"
        description="Totals and provider splits."
        action={
          <button className={btn} onClick={() => { overview.refetch(); reconciliation.refetch(); }}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        }
      >
        {overview.isLoading || !overview.data?.data ? (
          <Spinner />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ['Affiliates', overview.data.data.totals.affiliates],
                ['Active offers', overview.data.data.totals.activeOffers],
                ['Active campaigns', overview.data.data.totals.activeCampaigns],
                ['Conversions', overview.data.data.totals.conversions],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatPoints(value as number)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">By provider</p>
                <div className="divide-y divide-slate-100">
                  {overview.data.data.byProvider.map((row: any) => (
                    <div key={row.provider.id} className="flex justify-between py-1.5 text-xs">
                      <span>{row.provider.name ?? row.provider.code}</span>
                      <span className="tabular-nums text-slate-600">
                        {row.count} · {formatMoneyMinor(row.amountMinor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Rewards by status</p>
                <div className="divide-y divide-slate-100">
                  {Object.entries(overview.data.data.rewardsByStatus ?? {}).map(([status, units]) => (
                    <div key={status} className="flex justify-between py-1.5 text-xs">
                      <StatusBadge status={status} />
                      <span className="tabular-nums text-slate-600">{formatPoints(units as number)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title="Reconciliation queues" description="Items that need a human decision.">
        {reconciliation.isLoading ? (
          <Spinner />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(reconciliation.data?.data ?? {}).map(([queue, payload]) => {
              const count = (payload as any).count as number;
              return (
                <div
                  key={queue}
                  className={`rounded-lg border p-3 ${count > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">
                      {QUEUE_LABELS[queue] ?? queue}
                    </p>
                    {count > 0 ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{count}</p>
                  {count > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-600">
                      Review in the conversions or providers tab.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">Nothing to action.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
