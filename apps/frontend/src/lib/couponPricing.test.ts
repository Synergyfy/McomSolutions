import { describe, expect, it } from 'vitest';
import { previewCouponDiscount, priceOptionWithCoupon } from './couponPricing';

describe('couponPricing', () => {
  it('previews a percentage discount', () => {
    expect(previewCouponDiscount(100, 'PERCENTAGE', 20)).toEqual({
      originalAmount: 100,
      discountAmount: 20,
      finalAmount: 80,
    });
  });

  it('caps a fixed discount at the amount due', () => {
    expect(previewCouponDiscount(30, 'FIXED', 50)).toEqual({
      originalAmount: 30,
      discountAmount: 30,
      finalAmount: 0,
    });
  });

  it('discounts today’s instalment and the contract total display', () => {
    const priced = priceOptionWithCoupon(
      {
        paymentPlan: 'monthly',
        installments: 3,
        mode: 'auto',
        perChargePrice: 30,
        totalPrice: 90,
        sliceDays: 30,
      },
      { discountType: 'FIXED', discountValue: 10 },
    );

    expect(priced.perChargePrice).toBe(20);
    expect(priced.originalPerChargePrice).toBe(30);
    expect(priced.totalPrice).toBe(80);
    expect(priced.originalTotalPrice).toBe(90);
    expect(priced.couponDiscount).toBe(10);
  });

  it('keeps full-payment totals consistent', () => {
    const priced = priceOptionWithCoupon(
      {
        paymentPlan: 'full',
        installments: 1,
        mode: 'manual',
        perChargePrice: 100,
        totalPrice: 100,
        sliceDays: 90,
      },
      { discountType: 'PERCENTAGE', discountValue: 25 },
    );

    expect(priced.perChargePrice).toBe(75);
    expect(priced.totalPrice).toBe(75);
  });
});
