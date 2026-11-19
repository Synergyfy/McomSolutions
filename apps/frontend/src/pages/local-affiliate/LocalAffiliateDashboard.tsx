import { Fragment, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Gift,
  HandCoins,
  Info,
  Link2,
  MousePointerClick,
  Share2,
  Sparkles,
  Ticket,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  AffiliateStat,
  CopyField,
  EmptyState,
  ErrorNote,
  Section,
  Spinner,
  StatusBadge,
  cx,
  explainReward,
  formatDate,
  formatMoneyMinor,
  formatPoints,
} from '../../components/local-affiliate/ui';
import {
  useAffiliateActivity,
  useAffiliateActivitySummary,
  useAffiliateLedger,
  useAffiliateOffer,
  useAffiliateOffers,
  useAffiliateRewards,
  useCreateAffiliateLink,
  useMyAffiliateProfile,
  useRedeemReward,
} from '../../services/local-affiliate/hooks';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'offers', label: 'Offers to share', icon: Gift },
  { id: 'activity', label: 'My activity', icon: MousePointerClick },
  { id: 'rewards', label: 'My rewards', icon: HandCoins },
  { id: 'how-it-works', label: 'How it works', icon: Info },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export default function LocalAffiliateDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  // The route is registered as /affiliate-hub/*, so the section comes from the
  // pathname rather than a named route param.
  const segment = location.pathname.replace(/^\/affiliate-hub\/?/, '').split('/')[0];
  const active: SectionId = (SECTIONS.find((s) => s.id === segment)?.id ?? 'overview') as SectionId;

  const profileQuery = useMyAffiliateProfile();
  const profile = profileQuery.data?.data ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">Local Affiliate</p>
            <p className="text-[11px] text-slate-500">247GBS consumer affiliate programme</p>
          </div>
          <Link
            to="/customer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5 sm:px-6">
        <nav className="hidden w-52 shrink-0 lg:block">
          <ul className="space-y-1">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    to={`/affiliate-hub/${item.id}`}
                    className={cx(
                      'flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
                      active === item.id
                        ? 'bg-orange-600 text-white'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex gap-1.5 overflow-x-auto lg:hidden">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/affiliate-hub/${item.id}`)}
                className={cx(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold',
                  active === item.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {profileQuery.isLoading ? (
            <Spinner />
          ) : profileQuery.isError ? (
            <ErrorNote message="Could not load your affiliate profile. Please refresh." />
          ) : !profile ? (
            <NotAnAffiliateYet />
          ) : (
            <div className="space-y-5">
              <ProfileHeader profile={profile} />
              {active === 'overview' && <OverviewSection profile={profile} />}
              {active === 'offers' && <OffersSection />}
              {active === 'activity' && <ActivitySection />}
              {active === 'rewards' && <RewardsSection />}
              {active === 'how-it-works' && <HowItWorksSection />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function NotAnAffiliateYet() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-orange-600" />
      <h1 className="mt-3 text-lg font-semibold text-slate-900">Become a Local Affiliate</h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
        Share offers from MCOM Mall, local businesses and approved partners. You keep one CHS
        account — becoming an affiliate adds a profile, not another identity.
      </p>
      <Link
        to="/join-affiliate"
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"
      >
        Activate my affiliate profile
      </Link>
    </div>
  );
}

function ProfileHeader({ profile }: { profile: NonNullable<ReturnType<typeof useMyAffiliateProfile>['data']>['data'] }) {
  if (!profile) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {profile.displayName || 'Your affiliate profile'}
            </p>
            <StatusBadge status={profile.status} />
            {profile.cardStatus === 'LINKED' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" /> vCard linked
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">{profile.affiliateCode}</p>
        </div>
        <div className="w-full max-w-md">
          <CopyField value={profile.affiliateLink} label="Your personal affiliate link" />
        </div>
      </div>
      {profile.status === 'PENDING' ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
          Verify your email address to start sharing offers. Your link is reserved but sharing is
          paused until verification completes.
        </p>
      ) : null}
      {profile.status === 'SUSPENDED' ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 ring-1 ring-inset ring-rose-200">
          This profile is suspended. Existing rewards are unchanged, but you cannot share new links
          or redeem while suspended.
        </p>
      ) : null}
    </div>
  );
}

function OverviewSection({ profile }: { profile: any }) {
  const summary = useAffiliateActivitySummary();
  const rewards = useAffiliateRewards();
  const points = rewards.data?.data.points;
  const data = summary.data?.data;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AffiliateStat
          label="Available points"
          value={points ? formatPoints(points.available) : '—'}
          tone="positive"
          hint="Ready to redeem"
        />
        <AffiliateStat
          label="Pending points"
          value={points ? formatPoints(points.pending) : '—'}
          tone="warning"
          hint="Awaiting confirmation"
        />
        <AffiliateStat
          label="Link clicks"
          value={data ? formatPoints(data.clicks) : '—'}
          hint="Tracked visits through your links"
        />
        <AffiliateStat
          label="Rewarded events"
          value={data ? formatPoints(data.byStatus?.ATTRIBUTED ?? 0) : '—'}
          hint="Attributed to you"
        />
      </div>

      <Section
        title="Your affiliate link"
        description="Every share should use this link so activity is attributed to you."
      >
        <CopyField value={profile.affiliateLink} />
        <p className="mt-3 text-xs text-slate-500">
          Share this page directly, or pick a specific offer from <strong>Offers to share</strong>.
          A QR code for your link is provisioned with your MCOM vCard.
        </p>
      </Section>

      <Section title="What you can promote" description="Approved offers you are eligible for.">
        <OffersGrid limit={3} compact />
      </Section>
    </>
  );
}

function OffersSection() {
  const [search, setSearch] = useState('');
  const offersQuery = useAffiliateOffers({ limit: 48, search: search || undefined });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search offers"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-orange-500"
        />
      </div>
      {offersQuery.isLoading ? (
        <Spinner />
      ) : (
        <OffersGrid offers={offersQuery.data?.data} />
      )}
    </>
  );
}

function OffersGrid({
  offers,
  limit,
  compact,
}: {
  offers?: any[];
  limit?: number;
  compact?: boolean;
}) {
  const query = useAffiliateOffers({ limit: limit ?? 48 });
  const list = (offers ?? query.data?.data ?? []).slice(0, limit ?? undefined);

  if (query.isLoading && !offers) return <Spinner />;
  if (list.length === 0) {
    return (
      <EmptyState
        title="No offers available yet"
        description="Approved offers appear here as soon as they go live in the marketplace."
      />
    );
  }

  return (
    <div className={cx('grid gap-3', compact ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3')}>
      {list.map((offer) => (
        <Fragment key={offer.id}>
          <OfferCard offer={offer} />
        </Fragment>
      ))}
    </div>
  );
}

function OfferCard({ offer }: { offer: any }) {
  const navigate = useNavigate();
  const createLink = useCreateAffiliateLink();
  const [link, setLink] = useState<string | null>(null);

  const share = async () => {
    const result = await createLink.mutateAsync({ offerId: offer.id });
    setLink(result.data.trackingUrl);
    if (navigator.share) {
      try {
        await navigator.share({ title: offer.title, url: result.data.trackingUrl });
      } catch {
        /* user dismissed */
      }
    }
  };

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{offer.title}</h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {offer.source?.providerName ?? 'Offer'}
            {offer.category?.name ? ` · ${offer.category.name}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {offer.integrationLevel.replaceAll('_', ' ')}
        </span>
      </div>

      {offer.customerBenefit?.label ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
          <Ticket className="h-3.5 w-3.5" />
          {String(offer.customerBenefit.label)}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-slate-600">
        {offer.reward
          ? `You earn ${formatPoints(
              offer.reward.calculation === 'FIXED'
                ? Number(offer.reward.fixedUnits ?? 0)
                : 0,
            )} ${offer.reward.unit.toLowerCase()} per ${offer.reward.qualifyingEvent
              .replaceAll('_', ' ')
              .toLowerCase()}${
              offer.reward.calculation === 'PERCENTAGE'
                ? ` (${Number(offer.reward.percentage)}% of the sale)`
                : ''
            }`
          : 'Traffic only — this offer does not carry a reward yet.'}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {offer.canPromote ? (
          <button
            onClick={share}
            disabled={createLink.isPending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            <Share2 className="h-3.5 w-3.5" />
            {createLink.isPending ? 'Creating…' : 'Share'}
          </button>
        ) : (
          <span className="text-[11px] font-medium text-amber-700">
            {offer.blockedReason || 'Not available for you yet'}
          </span>
        )}
        <button
          onClick={() => navigate(`/offers/${offer.slug}`)}
          className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Details
        </button>
        {link ? <CopyField value={link} /> : null}
      </div>
    </article>
  );
}

function ActivitySection() {
  const [type, setType] = useState<string>('');
  const activity = useAffiliateActivity({ limit: 25, type: type || undefined });
  const summary = useAffiliateActivitySummary();

  const counters = summary.data?.data;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AffiliateStat label="Clicks" value={counters ? formatPoints(counters.clicks) : '—'} />
        <AffiliateStat label="Purchases" value={counters ? formatPoints(counters.byEventType?.APPROVED_PURCHASE ?? 0) : '—'} />
        <AffiliateStat label="Redemptions" value={counters ? formatPoints(counters.byEventType?.VERIFIED_REDEMPTION ?? 0) : '—'} />
        <AffiliateStat label="Bookings" value={counters ? formatPoints(counters.byEventType?.COMPLETED_BOOKING ?? 0) : '—'} />
      </div>

      <Section
        title="Activity"
        description="Clicks are traffic; purchases, bookings and redemptions are the events that can earn a reward."
        action={
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="min-h-9 rounded-lg border border-slate-300 px-2 text-xs"
          >
            <option value="">All events</option>
            <option value="APPROVED_PURCHASE">Purchases</option>
            <option value="COMPLETED_BOOKING">Bookings</option>
            <option value="VERIFIED_REDEMPTION">Redemptions</option>
            <option value="VERIFIED_LEAD">Leads</option>
          </select>
        }
      >
        {activity.isLoading ? (
          <Spinner />
        ) : (activity.data?.data.length ?? 0) === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Once someone clicks your link and completes a qualifying action, it appears here."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {activity.data!.data.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.offer?.title ?? 'Offer'} — {item.eventType.replaceAll('_', ' ').toLowerCase()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatDate(item.occurredAt)} · {formatMoneyMinor(item.amountMinor, item.currency)}
                  </p>
                  {item.reward?.explanationText ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {explainReward(item.reward.explanationCode, item.reward.explanationText)}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {item.reward ? (
                    <span className="text-xs font-semibold text-slate-700">
                      {formatPoints(item.reward.units)} {item.reward.unit.toLowerCase()}
                    </span>
                  ) : null}
                  <StatusBadge status={item.reward?.status ?? item.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function RewardsSection() {
  const rewards = useAffiliateRewards();
  const ledger = useAffiliateLedger({ limit: 25 });
  const redeem = useRedeemReward();
  const [units, setUnits] = useState('100');
  const [result, setResult] = useState<{ voucherCode: string; balanceAfter: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const points = rewards.data?.data.points;

  const doRedeem = async () => {
    setError(null);
    setResult(null);
    try {
      const res = await redeem.mutateAsync({ rewardType: 'VOUCHER', units: Number(units) });
      setResult({ voucherCode: res.data.voucherCode, balanceAfter: res.data.balanceAfter });
    } catch (e: any) {
      setError(
        e?.response?.data?.message === 'INSUFFICIENT_REWARD_BALANCE'
          ? 'You do not have enough available points for that amount.'
          : 'Could not redeem right now. Please try again.',
      );
    }
  };

  const balances = useMemo(
    () =>
      points
        ? [
            { label: 'Available', value: points.available, tone: 'positive' as const },
            { label: 'Pending', value: points.pending, tone: 'warning' as const },
            { label: 'Redeemed', value: points.redeemed, tone: 'muted' as const },
            { label: 'Expired', value: points.expired, tone: 'muted' as const },
            { label: 'Reversed', value: points.reversed, tone: 'muted' as const },
            { label: 'Total earned', value: points.totalEarned, tone: 'default' as const },
          ]
        : [],
    [points],
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {balances.map((b) => (
          <Fragment key={b.label}>
            <AffiliateStat label={b.label} value={formatPoints(b.value)} tone={b.tone} />
          </Fragment>
        ))}
      </div>

      <Section
        title="Redeem points"
        description="Turn available points into a voucher you can use on a participating offer."
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            Points
            <input
              type="number"
              min={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={doRedeem}
            disabled={redeem.isPending || Number(units) <= 0}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            <Wallet className="h-4 w-4" />
            {redeem.isPending ? 'Redeeming…' : 'Redeem'}
          </button>
        </div>
        {error ? <div className="mt-3"><ErrorNote message={error} /></div> : null}
        {result ? (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-200">
            Voucher <strong className="font-mono">{result.voucherCode}</strong> issued. Remaining
            balance: <strong>{formatPoints(result.balanceAfter)}</strong> points.
          </div>
        ) : null}
      </Section>

      <Section title="Reward history" description="Every credit, spend, expiry and reversal is recorded.">
        {ledger.isLoading ? (
          <Spinner />
        ) : (ledger.data?.data.length ?? 0) === 0 ? (
          <EmptyState title="No rewards yet" />
        ) : (
          <div className="divide-y divide-slate-100">
            {ledger.data!.data.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900">{row.description}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatDate(row.createdAt)}
                    {row.expiresAt ? ` · expires ${formatDate(row.expiresAt)}` : ''}
                  </p>
                  {row.explanationText ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {explainReward(row.explanationCode, row.explanationText)}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cx(
                      'text-xs font-semibold tabular-nums',
                      row.entryType === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700',
                    )}
                  >
                    {row.entryType === 'CREDIT' ? '+' : '−'}
                    {formatPoints(row.units)} {row.unit.toLowerCase()}
                  </span>
                  <StatusBadge status={row.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      title: 'Share an offer',
      body: 'Pick an offer and share your personal link. The link is unique to you and to that offer.',
    },
    {
      title: 'Someone visits and buys',
      body: 'Your link records the visit. If they complete a qualifying action, the provider reports it.',
    },
    {
      title: 'The provider confirms',
      body: 'Depending on the provider this can be instant (a validated voucher) or take a few days (a purchase).',
    },
    {
      title: 'Your reward becomes available',
      body: 'Points move from Pending to Available. You can then redeem them for a voucher.',
    },
  ];

  return (
    <>
      <Section title="How Local Affiliates works">
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Why a reward can be pending">
        <ul className="space-y-2 text-xs text-slate-600">
          <li>• The business or provider has not confirmed the transaction yet.</li>
          <li>• The purchase is inside a short hold period so refunds can be processed.</li>
          <li>• A voucher has not yet been validated by the business.</li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          A click alone never earns a reward. Rewards are only created for events the provider can
          actually verify.
        </p>
      </Section>

      <Section title="What is not covered">
        <ul className="space-y-2 text-xs text-slate-600">
          <li>• Purchases after the attribution window (30 days by default) may not be attributed.</li>
          <li>• Blocked cookies or a different device can break attribution — that is a limit of every affiliate system.</li>
          <li>• Refunded or cancelled transactions reverse the related reward.</li>
        </ul>
      </Section>
    </>
  );
}

export function OfferDetailRoute() {
  const { slug = '' } = useParams<{ slug: string }>();
  const offerQuery = useAffiliateOffer(slug);
  const createLink = useCreateAffiliateLink();
  const [link, setLink] = useState<string | null>(null);

  if (offerQuery.isLoading) return <Spinner />;
  if (offerQuery.isError || !offerQuery.data?.data) {
    return <ErrorNote message="This offer could not be found." />;
  }
  const offer = offerQuery.data.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <Link to="/affiliate-hub/offers" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to offers
      </Link>
      <Section title={offer.title} description={offer.subtitle ?? undefined}>
        <p className="text-sm text-slate-700">{offer.description ?? 'No description provided.'}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source</dt>
            <dd className="text-sm text-slate-800">{offer.source?.providerName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</dt>
            <dd className="text-sm text-slate-800">{offer.category?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer gets</dt>
            <dd className="text-sm text-slate-800">
              {offer.customerBenefit?.label ? String(offer.customerBenefit.label) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">You earn</dt>
            <dd className="text-sm text-slate-800">
              {offer.reward
                ? `${formatPoints(
                    offer.reward.calculation === 'FIXED' ? Number(offer.reward.fixedUnits ?? 0) : 0,
                  )} ${offer.reward.unit.toLowerCase()}`
                : 'No reward on this offer'}
            </dd>
          </div>
        </dl>

        {offer.canPromote ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                const r = await createLink.mutateAsync({ offerId: offer.id });
                setLink(r.data.trackingUrl);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Link2 className="h-4 w-4" />
              {link ? 'Refresh my link' : 'Get my share link'}
            </button>
            {link ? <CopyField value={link} /> : null}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
            {offer.blockedReason || 'This offer is not available for you.'}
          </p>
        )}
      </Section>
    </div>
  );
}
