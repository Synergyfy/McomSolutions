import { Link } from 'react-router-dom';
import { Gift, Sparkles } from 'lucide-react';
import CHSLogo from '../../components/CHSLogo';
import { EmptyState, Section, Spinner, formatPoints } from '../../components/local-affiliate/ui';
import { useAffiliateOffers } from '../../services/local-affiliate/hooks';

export default function PublicOffersPage() {
  const offers = useAffiliateOffers({ limit: 48 });

  return (
    <div className="min-h-screen bg-slate-50">

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Offers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Promotions from MCOM Mall, local businesses and approved partners.
          </p>
        </div>

        {offers.isLoading ? (
          <Spinner />
        ) : offers.isError ? (
          <EmptyState title="Could not load offers" description="Please try again shortly." />
        ) : (offers.data?.data.length ?? 0) === 0 ? (
          <EmptyState title="No offers live right now" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offers.data!.data.map((offer) => (
              <Link
                key={offer.id}
                to={`/offers/${offer.slug}`}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">{offer.title}</h2>
                  <Gift className="h-4 w-4 shrink-0 text-orange-500" />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {offer.source?.providerName ?? 'Offer'}
                  {offer.category?.name ? ` · ${offer.category.name}` : ''}
                </p>
                {offer.customerBenefit?.label ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    {String(offer.customerBenefit.label)}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-600">
                  {offer.reward
                    ? `Earn ${formatPoints(
                        offer.reward.calculation === 'FIXED'
                          ? Number(offer.reward.fixedUnits ?? 0)
                          : 0,
                      )} ${offer.reward.unit.toLowerCase()}`
                    : 'Open the offer to see details'}
                </p>
              </Link>
            ))}
          </div>
        )}

        <Section title="Want to earn from sharing these?" description="Become a Local Affiliate — one CHS account, one dashboard.">
          <Link
            to="/join-affiliate"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Join as a Local Affiliate
          </Link>
        </Section>
      </main>
    </div>
  );
}

export function PublicAffiliatePage() {
  return null;
}
