import { BadRequestException } from '@nestjs/common';
import { MembershipPaymentPlan, PaymentPriceMode, PlanTier } from '@prisma/client';
import {
  allowedSplit,
  normalizePaymentPlan,
  normalizePlanTier,
  planTierDisplay,
  resolveOptionPrice,
  round2,
} from './payment-option.util';

describe('payment-option.util', () => {
  describe('normalizePlanTier', () => {
    it.each([
      ['Standard', PlanTier.Standard],
      ['Normal', PlanTier.Standard],
      ['standard', PlanTier.Standard],
      ['Pro', PlanTier.Pro],
      ['Pro+', PlanTier.ProPlus],
      ['proplus', PlanTier.ProPlus],
      ['Pro Plus', PlanTier.ProPlus],
      ['', PlanTier.Standard],
    ])('maps %p to %p', (raw, expected) => {
      expect(normalizePlanTier(raw)).toBe(expected);
    });
  });

  describe('normalizePaymentPlan', () => {
    it.each([
      ['full', MembershipPaymentPlan.full],
      ['', MembershipPaymentPlan.full],
      ['monthly', MembershipPaymentPlan.monthly],
      ['quarterly', MembershipPaymentPlan.quarterly],
      ['halfYearly', MembershipPaymentPlan.halfYearly],
      ['half_yearly', MembershipPaymentPlan.halfYearly],
    ])('maps %p to %p', (raw, expected) => {
      expect(normalizePaymentPlan(raw)).toBe(expected);
    });
  });

  describe('allowedSplit', () => {
    it('allows monthly+quarterly+halfYearly only on their tiers', () => {
      expect(allowedSplit('Standard', MembershipPaymentPlan.monthly)?.installments).toBe(3);
      expect(allowedSplit('Standard', MembershipPaymentPlan.quarterly)).toBeUndefined();
      expect(allowedSplit('Standard', MembershipPaymentPlan.halfYearly)).toBeUndefined();
      expect(allowedSplit('Pro', MembershipPaymentPlan.quarterly)?.installments).toBe(2);
      expect(allowedSplit('Pro', MembershipPaymentPlan.monthly)?.installments).toBe(6);
      expect(allowedSplit('Pro', MembershipPaymentPlan.halfYearly)).toBeUndefined();
      expect(allowedSplit('ProPlus', MembershipPaymentPlan.halfYearly)?.installments).toBe(2);
      expect(allowedSplit('ProPlus', MembershipPaymentPlan.quarterly)?.installments).toBe(4);
      expect(allowedSplit('ProPlus', MembershipPaymentPlan.monthly)?.installments).toBe(12);
    });
  });

  describe('resolveOptionPrice', () => {
    it('auto: divides the full price and adds the surcharge per instalment', () => {
      // £90 over 3 months + 2% => £30.60 each, £91.80 total
      expect(
        resolveOptionPrice(90, 3, PaymentPriceMode.auto, null, 2),
      ).toEqual({ perChargePrice: 30.6, totalPrice: 91.8 });
    });

    it('auto: 0% surcharge splits evenly', () => {
      expect(
        resolveOptionPrice(180, 2, PaymentPriceMode.auto, null, 0),
      ).toEqual({ perChargePrice: 90, totalPrice: 180 });
    });

    it('auto: defaults a missing surcharge to 0', () => {
      expect(
        resolveOptionPrice(100, 4, PaymentPriceMode.auto, null, undefined),
      ).toEqual({ perChargePrice: 25, totalPrice: 100 });
    });

    it('manual: uses the admin-set price', () => {
      expect(
        resolveOptionPrice(90, 3, PaymentPriceMode.manual, 35, undefined),
      ).toEqual({ perChargePrice: 35, totalPrice: 105 });
    });

    it('rejects negative prices and out-of-range surcharges in plain language', () => {
      expect(() => resolveOptionPrice(-5, 3, PaymentPriceMode.auto, null, 0)).toThrow(BadRequestException);
      expect(() => resolveOptionPrice(90, 3, PaymentPriceMode.manual, -1, undefined)).toThrow(
        'Price cannot be negative.',
      );
      expect(() => resolveOptionPrice(90, 3, PaymentPriceMode.manual, undefined, undefined)).toThrow(
        'Please enter a price for the manual payment option.',
      );
      expect(() => resolveOptionPrice(90, 3, PaymentPriceMode.auto, null, 101)).toThrow(
        'Surcharge must be between 0% and 100%.',
      );
    });
  });

  describe('round2 / planTierDisplay', () => {
    it('rounds half-pence up like Postgres ROUND(numeric, 2)', () => {
      expect(round2(116.666)).toBe(116.67);
      expect(round2(8.5)).toBe(8.5);
    });

    it('renders ProPlus as Pro+', () => {
      expect(planTierDisplay(PlanTier.ProPlus)).toBe('Pro+');
    });
  });
});
