import { BadgeCheck, CalendarClock } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectorOption {
  paymentPlan: 'full' | 'monthly' | 'quarterly' | 'halfYearly' | string;
  installments: number;
  mode: 'manual' | 'auto' | string;
  perChargePrice: number;
  totalPrice: number;
  sliceDays: number;
  /** Display-only: original amounts before an applied coupon. */
  originalPerChargePrice?: number;
  originalTotalPrice?: number;
  couponDiscount?: number;
}

interface PaymentPlanSelectorProps {
  tier: 'Standard' | 'Pro' | 'Pro+' | string;
  durationDays: number;
  options: SelectorOption[];
  value: string;
  onChange: (paymentPlan: string) => void;
  disabled?: boolean;
}

const ORDER = ['full', 'halfYearly', 'quarterly', 'monthly'];

function durationText(tier: string, durationDays: number): string {
  if (tier === 'Pro+') return '1 year';
  if (tier === 'Pro') return '180 days';
  if (durationDays > 0) return `${durationDays} days`;
  return 'full term';
}

function planLabel(opt: SelectorOption): { title: string; sub: string } {
  const discounted = (opt.couponDiscount ?? 0) > 0;
  const original = Number(opt.originalPerChargePrice ?? opt.perChargePrice);
  const remaining = discounted && opt.installments > 1
    ? ` then £${original} × ${opt.installments - 1}`
    : '';
  if (opt.paymentPlan === 'full') {
    return { title: 'Pay in full', sub: `One payment of £${opt.perChargePrice}` };
  }
  if (opt.paymentPlan === 'monthly') {
    return {
      title: 'Pay monthly',
      sub: discounted
        ? `£${opt.perChargePrice} today${remaining}`
        : `£${opt.perChargePrice} × ${opt.installments} months`,
    };
  }
  if (opt.paymentPlan === 'quarterly') {
    return {
      title: 'Pay quarterly',
      sub: discounted
        ? `£${opt.perChargePrice} today${remaining}`
        : `£${opt.perChargePrice} × ${opt.installments} payments`,
    };
  }
  return {
    title: 'Pay every 6 months',
    sub: discounted
      ? `£${opt.perChargePrice} today${remaining}`
      : `£${opt.perChargePrice} × ${opt.installments} payments`,
  };
}

export default function PaymentPlanSelector({ tier, durationDays, options, value, onChange, disabled = false }: PaymentPlanSelectorProps) {
  if (!Array.isArray(options) || options.length === 0) return null;

  const ordered = [...options].sort(
    (a, b) => ORDER.indexOf(a.paymentPlan) - ORDER.indexOf(b.paymentPlan),
  );
  const monthly = ordered.find((o) => o.paymentPlan === 'monthly');
  const monthlyTotal = monthly ? Number(monthly.totalPrice) : null;
  const term = durationText(tier, durationDays);

  return (
    <div role="radiogroup" aria-label="Choose how to pay" className="space-y-2.5 sm:space-y-3">
      {ordered.map((opt) => {
        const selected = value === opt.paymentPlan;
        const { title, sub } = planLabel(opt);
        const total = Number(opt.totalPrice);
        const save = monthlyTotal != null && opt.paymentPlan !== 'monthly' ? monthlyTotal - total : 0;
        const showSave = save > 0.005;
        const access =
          opt.paymentPlan === 'full'
            ? `Full ${term} unlocked today`
            : `+${opt.sliceDays} days access per payment`;

        return (
          <button
            key={opt.paymentPlan}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.paymentPlan)}
            disabled={disabled}
            className={cn(
              'w-full min-h-[64px] p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.99] cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed active:scale-100',
              selected
                ? 'border-brand-blue bg-blue-50/60 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  selected ? 'border-brand-blue' : 'border-gray-300',
                )}
              >
                {selected && <span className="w-2.5 h-2.5 rounded-full bg-brand-blue" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-extrabold text-gray-900">{title}</span>
                  {showSave && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-extrabold">
                      <BadgeCheck className="w-3 h-3" /> Save £{save.toFixed(2).replace(/\.00$/, '')}
                    </span>
                  )}
                  {opt.paymentPlan === 'monthly' && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold">
                      Most flexible
                    </span>
                  )}
                </span>
                <span className="block text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
                  {sub} · {access}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-lg sm:text-xl font-black text-gray-900">
                  £{opt.perChargePrice}
                </span>
                {(opt.originalPerChargePrice ?? opt.perChargePrice) > opt.perChargePrice && (
                  <span className="block text-[11px] text-gray-400 font-semibold line-through">
                    £{opt.originalPerChargePrice}
                  </span>
                )}
                <span className="block text-[11px] text-gray-400 font-semibold">
                  {opt.paymentPlan === 'full'
                    ? 'one-off'
                    : (opt.couponDiscount ?? 0) > 0
                      ? 'today'
                      : 'per payment'}
                </span>
              </span>
            </span>
            {opt.paymentPlan === 'monthly' && (
              <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                <CalendarClock className="w-3.5 h-3.5" />
                Highest total (£{total}
                {(opt.originalTotalPrice ?? total) > total ? `, was £${opt.originalTotalPrice}` : ''})
                — you pay as you go and can stop anytime.
              </span>
            )}
          </button>
        );
      })}
      <p className="text-[11px] sm:text-xs text-gray-400 font-medium leading-relaxed">
        Split payments unlock access step by step — each successful payment extends your {term} membership. Paying in full unlocks everything today and always costs the least overall.
      </p>
    </div>
  );
}
