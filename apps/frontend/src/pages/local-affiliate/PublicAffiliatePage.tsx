import { Link, useParams } from 'react-router-dom';
import { Gift, Share2, Sparkles } from 'lucide-react';
import CHSLogo from '../../components/CHSLogo';
import { EmptyState, Spinner, formatPoints } from '../../components/local-affiliate/ui';
import { usePublicAffiliate } from '../../services/local-affiliate/hooks';

/**
 * Public affiliate page (/a/:affiliateCode).
 * Deliberately contains no PII — display name and promotable offers only.
 */
export default function PublicAffiliatePage() {
  const { affiliateCode = '' } = useParams<{ affiliateCode: string }>();
  const query = usePublicAffiliate(affiliateCode);
  const data = query.data?.data;

  return (
    <div className="min-h-screen bg-slate-50">

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {query.isLoading ? (
          <Spinner />
        ) : !data ? (
          <EmptyState
            title="This affiliate page is not available"
            description="The link may have expired, or the affiliate profile is not active."
          />
        ) : (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <Share2 className="h-5 w-5 text-orange-700" />
              </div>
              <h1 className="mt-3 text-xl font-semibold text-slate-900">
                Offers shared by {data.displayName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                A 247GBS Local Affiliate. Pick an offer below to see the details.
              </p>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.offers?.map((offer: any) => (
                <Link
                  key={offer.slug}
                  to={`/offers/${offer.slug}`}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{offer.title}</h2>
                    <Gift className="h-4 w-4 shrink-0 text-orange-500" />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {offer.provider?.name ?? 'Offer'}
                  </p>
                  {offer.customerBenefit?.label ? (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      {String(offer.customerBenefit.label)}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>

            <p className="text-center text-[11px] text-slate-500">
              {data.offers?.length ? `${formatPoints(data.offers.length)} offers available` : ''}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
