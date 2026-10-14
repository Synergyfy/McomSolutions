import { cn } from '../../lib/utils';

export type TierKey = 'Standard' | 'Pro' | 'Pro+';
export type SplitPlan = 'full' | 'monthly' | 'quarterly' | 'halfYearly';

export interface OptionDraft {
  paymentPlan: SplitPlan;
  mode: 'manual' | 'auto';
  manualPrice: number;
  surchargePct: number;
}

/** Display-only preview (the server recomputes prices authoritatively on save). */
export function previewCharge(
  full: number,
  installments: number,
  mode: 'manual' | 'auto',
  manualPrice: number,
  pct: number,
): number {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (mode === 'manual') return r2(Math.max(0, Number(manualPrice) || 0));
  return r2((full / installments) * (1 + (Number(pct) || 0) / 100));
}

export function draftError(d: OptionDraft): string | null {
  if (d.mode === 'manual') {
    if (!Number.isFinite(d.manualPrice) || d.manualPrice < 0) return 'Enter a price of £0 or more.';
    return null;
  }
  if (!Number.isFinite(d.surchargePct) || d.surchargePct < 0 || d.surchargePct > 100) {
    return 'Surcharge must be between 0% and 100%.';
  }
  return null;
}

export const TIER_SPLITS: Record<TierKey, { paymentPlan: SplitPlan; installments: number; hint: string }[]> = {
  Standard: [
    { paymentPlan: 'monthly', installments: 3, hint: '3 monthly payments · +30 days access each' },
  ],
  Pro: [
    { paymentPlan: 'quarterly', installments: 2, hint: '2 payments · +90 days access each' },
    { paymentPlan: 'monthly', installments: 6, hint: '6 monthly payments · +30 days access each' },
  ],
  'Pro+': [
    { paymentPlan: 'halfYearly', installments: 2, hint: '2 payments · +180 days access each' },
    { paymentPlan: 'quarterly', installments: 4, hint: '4 payments · +91 days access each' },
    { paymentPlan: 'monthly', installments: 12, hint: '12 monthly payments · +30 days access each' },
  ],
};

export const TIER_DURATIONS: Record<TierKey, number> = { Standard: 90, Pro: 180, 'Pro+': 365 };

export const SPLIT_LABEL: Record<SplitPlan, string> = {
  full: 'Pay in full',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  halfYearly: 'Every 6 months',
};

export default function SplitEditor({
  tierKey,
  fullPrice,
  drafts,
  onChange,
  chipClass,
}: {
  tierKey: TierKey;
  fullPrice: number;
  drafts: OptionDraft[];
  onChange: (next: OptionDraft[]) => void;
  chipClass: string;
}) {
  const splits = TIER_SPLITS[tierKey];
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-gray-500 leading-relaxed">
        Paying outright (£{fullPrice}) unlocks the full term today. Splits unlock access step by step — buyers pick one at checkout.{' '}
        <span className="inline-flex items-center px-1.5 py-px rounded-md bg-gray-100 text-gray-400 text-[10px] font-extrabold uppercase tracking-wide align-middle">
          Optional
        </span>{' '}
        Leave a split on Auto 0% to divide the price evenly.
      </p>
      {splits.map((s) => {
        const d = drafts.find((x) => x.paymentPlan === s.paymentPlan) ?? {
          paymentPlan: s.paymentPlan,
          mode: 'auto' as const,
          manualPrice: 0,
          surchargePct: 0,
        };
        const err = draftError(d);
        const per = previewCharge(fullPrice, s.installments, d.mode, d.manualPrice, d.surchargePct);
        const set = (patch: Partial<OptionDraft>) =>
          onChange(
            drafts.some((x) => x.paymentPlan === s.paymentPlan)
              ? drafts.map((x) => (x.paymentPlan === s.paymentPlan ? { ...x, ...patch } : x))
              : [...drafts, { ...d, ...patch }],
          );
        return (
          <div key={s.paymentPlan} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="text-sm sm:text-base font-extrabold text-gray-900">
                  {SPLIT_LABEL[s.paymentPlan]} <span className="font-semibold text-gray-400">× {s.installments}</span>
                </div>
                <div className="text-xs sm:text-sm text-gray-400">{s.hint}</div>
              </div>
              <div
                className="flex rounded-xl border border-gray-200 bg-white p-1 text-xs sm:text-sm font-bold shrink-0"
                role="group"
                aria-label={`${SPLIT_LABEL[s.paymentPlan]} pricing mode`}
              >
                <button
                  type="button"
                  onClick={() => set({ mode: 'manual' })}
                  aria-pressed={d.mode === 'manual'}
                  className={cn(
                    'px-3 py-1.5 rounded-lg transition-all min-h-[36px]',
                    d.mode === 'manual' ? cn(chipClass, 'text-white') : 'text-gray-500 hover:text-gray-900',
                  )}
                >
                  Set price
                </button>
                <button
                  type="button"
                  onClick={() => set({ mode: 'auto' })}
                  aria-pressed={d.mode === 'auto'}
                  className={cn(
                    'px-3 py-1.5 rounded-lg transition-all min-h-[36px]',
                    d.mode === 'auto' ? cn(chipClass, 'text-white') : 'text-gray-500 hover:text-gray-900',
                  )}
                >
                  Auto +%
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-gray-500">{d.mode === 'manual' ? '£' : '+'}</span>
              <input
                type="number"
                min={0}
                max={d.mode === 'manual' ? undefined : 100}
                step={d.mode === 'manual' ? '0.01' : '0.1'}
                value={d.mode === 'manual' ? d.manualPrice : d.surchargePct}
                onChange={(e) =>
                  set(d.mode === 'manual' ? { manualPrice: Number(e.target.value) } : { surchargePct: Number(e.target.value) })
                }
                aria-label={d.mode === 'manual' ? `${SPLIT_LABEL[s.paymentPlan]} price in pounds` : `${SPLIT_LABEL[s.paymentPlan]} surcharge percent`}
                className={cn(
                  'w-full bg-white border rounded-xl px-3 py-2.5 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 min-h-[48px]',
                  err ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200 focus:ring-orange-500/20 focus:border-orange-500',
                )}
              />
              <span className="text-xs sm:text-sm font-bold text-gray-400 shrink-0">
                {d.mode === 'manual' ? '/ pay' : '%'}
              </span>
            </div>
            {err ? (
              <p className="text-xs sm:text-sm font-semibold text-red-600">{err}</p>
            ) : (
              <p className="text-xs sm:text-sm font-semibold text-gray-600">
                Charges <span className="font-extrabold text-gray-900">£{per}</span> × {s.installments} ={' '}
                <span className="font-extrabold text-gray-900">£{Math.round(per * s.installments * 100) / 100} total</span>
                {d.mode === 'auto' && Number(d.surchargePct) > 0 && (
                  <span className="text-gray-400"> (base £{Math.round((fullPrice / s.installments) * 100) / 100} + {d.surchargePct}%)</span>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
