import type { CouponDiscountType } from '../services/admin/types';

export interface CouponDiscountPreview {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Display-only mirror of the server discount rule. The server remains the
 * source of truth; this keeps the "Choose how to pay" cards in sync while the
 * user switches between outright and instalment options.
 */
export function previewCouponDiscount(
  amount: number,
  discountType: CouponDiscountType,
  discountValue: number,
): CouponDiscountPreview {
  const originalAmount = roundMoney(Math.max(0, amount));
  const raw =
    discountType === 'PERCENTAGE'
      ? (originalAmount * discountValue) / 100
      : discountValue;
  const discountAmount = roundMoney(Math.min(originalAmount, Math.max(0, raw)));
  return {
    originalAmount,
    discountAmount,
    finalAmount: roundMoney(Math.max(0, originalAmount - discountAmount)),
  };
}

export interface CouponPricedOption {
  perChargePrice: number;
  totalPrice: number;
}

export type CouponPricedOptionResult<T extends CouponPricedOption> = T & {
  perChargePrice: number;
  totalPrice: number;
  originalPerChargePrice: number;
  originalTotalPrice: number;
  couponDiscount: number;
};

/**
 * Discounts one payment option for display. The coupon applies to the charge
 * being made today, so only that slice is removed from the contract total.
 */
export function priceOptionWithCoupon<T extends CouponPricedOption>(
  option: T,
  coupon: { discountType: CouponDiscountType; discountValue: number },
): CouponPricedOptionResult<T> {
  const charge = previewCouponDiscount(
    Number(option.perChargePrice),
    coupon.discountType,
    Number(coupon.discountValue),
  );
  return {
    ...option,
    perChargePrice: charge.finalAmount,
    totalPrice: Math.max(0, roundMoney(Number(option.totalPrice) - charge.discountAmount)),
    originalPerChargePrice: Number(option.perChargePrice),
    originalTotalPrice: Number(option.totalPrice),
    couponDiscount: charge.discountAmount,
  };
}
