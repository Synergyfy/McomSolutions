import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Tag, X } from 'lucide-react';
import { useValidateCoupon } from '../../services/pricing/hooks';
import type { CouponQuote } from '../../services/admin/types';
import { cn } from '../../lib/utils';

interface CouponCodeFieldProps {
  level: string;
  tier: string;
  billing: string;
  paymentPlan: string;
  applied: CouponQuote | null;
  onApplied: (quote: CouponQuote | null) => void;
  disabled?: boolean;
  className?: string;
}

export default function CouponCodeField({
  level,
  tier,
  billing,
  paymentPlan,
  applied,
  onApplied,
  disabled = false,
  className,
}: CouponCodeFieldProps) {
  const [code, setCode] = useState(applied?.coupon?.code ?? '');
  const [error, setError] = useState<string | null>(null);
  const validateCoupon = useValidateCoupon();
  const appliedRef = useRef(applied);
  const contextRef = useRef(`${level}|${tier}|${billing}|${paymentPlan}`);
  appliedRef.current = applied;

  const contextKey = `${level}|${tier}|${billing}|${paymentPlan}`;

  const applyCode = async (rawCode: string) => {
    const normalized = rawCode.trim().toUpperCase();
    if (!normalized) {
      setError('Enter a coupon code.');
      return;
    }
    setError(null);
    try {
      const quote = (await validateCoupon.mutateAsync({
        couponCode: normalized,
        level,
        tier,
        billing,
        paymentPlan,
      })) as CouponQuote;
      if (!quote?.coupon) {
        setError('This coupon code is not valid.');
        onApplied(null);
        return;
      }
      setCode(quote.coupon.code);
      onApplied(quote);
    } catch (err: any) {
      onApplied(null);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'This coupon code could not be applied.',
      );
    }
  };

  useEffect(() => {
    if (!appliedRef.current) return;
    if (contextRef.current === contextKey) return;
    contextRef.current = contextKey;
    const code = appliedRef.current.coupon.code;
    void applyCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void applyCode(code);
  };

  const remove = () => {
    setCode('');
    setError(null);
    onApplied(null);
  };

  if (applied?.coupon) {
    return (
      <div className={cn('rounded-xl border border-emerald-200 bg-emerald-50/70 p-3', className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-emerald-800 tracking-wide">
                  {applied.coupon.code}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  -£{Number(applied.discountAmount).toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                New total due today: <strong>£{Number(applied.finalAmount).toFixed(2)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={disabled || validateCoupon.isPending}
            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            aria-label="Remove coupon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {validateCoupon.isPending && (
          <p className="mt-2 text-[11px] text-emerald-700 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Rechecking coupon...
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              if (error) setError(null);
            }}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            placeholder="Coupon code"
            disabled={disabled || validateCoupon.isPending}
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold tracking-wide uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || validateCoupon.isPending || !code.trim()}
          className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {validateCoupon.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Apply
        </button>
      </form>
      {error && (
        <p className="mt-1.5 text-[11px] text-red-600 flex items-start gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}
