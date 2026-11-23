import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { useAccessPlans } from '../services/access/hooks';
import type { BusinessAccessPlan } from '../services/access';
import AccessPassPaymentModal from '../components/payment/AccessPassPaymentModal';

export default function AccessPassesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAccessPlans();
  const [selectedPlan, setSelectedPlan] = useState<BusinessAccessPlan | null>(null);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => typeof window !== 'undefined' && Boolean(localStorage.getItem('auth_token')),
  );

  useEffect(() => {
    setIsLoggedIn(typeof window !== 'undefined' && Boolean(localStorage.getItem('auth_token')));
  }, []);

  const plans = useMemo(
    () => (data?.data ?? []).filter((plan) => !plan.archived),
    [data],
  );

  const choosePlan = (plan: BusinessAccessPlan) => {
    if (!isLoggedIn) {
      navigate(`/login?redirect=${encodeURIComponent('/access-passes')}`);
      return;
    }
    setPurchaseComplete(false);
    setSelectedPlan(plan);
  };

  const closePayment = () => {
    setSelectedPlan(null);
    if (purchaseComplete) {
      navigate('/dashboard/access-passes');
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600">
              <Ticket className="h-4 w-4" />
              One-off access · No auto-renewal
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-7xl">
              Access <span className="text-brand-blue">Passes</span>
            </h1>
            <p className="text-lg font-medium text-gray-600 sm:text-xl">
              Unlock one or more ecosystem platforms for a fixed period. Buy a
              pass for your business, or gift one to another business.
            </p>
          </motion.div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-gray-500 md:mt-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Secure checkout
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5">
              <CalendarDays className="h-4 w-4 text-brand-blue" />
              Fixed-term access
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5">
              <KeyRound className="h-4 w-4 text-orange-500" />
              Redeem gift codes
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center rounded-[2rem] border border-gray-200 bg-white p-16">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : isError ? (
          <div className="mx-auto max-w-xl rounded-[2rem] border border-red-200 bg-red-50 p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <h2 className="text-lg font-bold text-red-900">Could not load access passes</h2>
            <p className="mt-1 text-sm text-red-700">
              Please check your connection and try again.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-[2rem] border border-gray-200 bg-white p-12 text-center">
            <Sparkles className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <h2 className="text-lg font-bold text-gray-900">No access passes available yet</h2>
            <p className="mt-1 text-sm text-gray-500">
              New passes are added regularly. Check back soon or contact our team.
            </p>
            <Link
              to="/membership"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-sm font-bold text-white hover:bg-blue-600"
            >
              Explore membership
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, index) => (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="flex flex-col rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-brand-blue/30 hover:shadow-xl md:p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {plan.badge ? (
                      <span className="mb-2 inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">
                        {plan.badge}
                      </span>
                    ) : null}
                    <h2 className="text-xl font-black text-gray-900">{plan.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {plan.description || 'Access pass for ecosystem platforms.'}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-700">
                    <CalendarDays className="h-3 w-3" />
                    {plan.durationDays} days
                  </span>
                </div>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">
                    £{Number(plan.price).toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    one-off
                  </span>
                </div>

                {plan.whoItIsFor ? (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-brand-blue">
                    For {plan.whoItIsFor}
                  </p>
                ) : null}

                <ul className="mt-5 flex-1 space-y-2">
                  {(plan.features ?? []).slice(0, 6).map((feature, featureIndex) => (
                    <li
                      key={`${feature}-${featureIndex}`}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {!plan.features?.length ? (
                    <li className="text-sm italic text-gray-400">
                      Feature details available at checkout.
                    </li>
                  ) : null}
                </ul>

                {(plan.appBundles ?? []).length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {plan.appBundles?.map((bundle, bundleIndex) => (
                      <span
                        key={`${bundle.platform}-${bundleIndex}`}
                        className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-brand-blue"
                      >
                        {bundle.platform}
                        {bundle.durationDays ? ` · ${bundle.durationDays}d` : ''}
                      </span>
                    ))}
                  </div>
                ) : null}

                <button
                  onClick={() => choosePlan(plan)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-95"
                >
                  <CreditCard className="h-4 w-4" />
                  {isLoggedIn ? 'Buy pass' : 'Sign in to buy'}
                </button>
              </motion.article>
            ))}
          </div>
        )}

        <div className="mx-auto mt-14 max-w-2xl rounded-[2rem] border border-gray-100 bg-gray-50 p-8 text-center md:mt-20 md:p-12">
          <KeyRound className="mx-auto mb-4 h-10 w-10 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Already have an access pass code?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 md:text-base">
            Sign in to redeem your code. Your pass starts the moment you redeem it.
          </p>
          <Link
            to={isLoggedIn ? '/dashboard/access-passes' : `/login?redirect=${encodeURIComponent('/dashboard/access-passes')}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-blue px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-95"
          >
            {isLoggedIn ? 'Redeem in dashboard' : 'Sign in to redeem'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {selectedPlan ? (
        <AccessPassPaymentModal
          plan={selectedPlan}
          onClose={closePayment}
          onSuccess={() => setPurchaseComplete(true)}
        />
      ) : null}
    </div>
  );
}
