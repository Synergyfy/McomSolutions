import { describe, expect, it } from 'vitest';
import {
  defaultCouponForm,
  generateCouponCode,
  hasCouponFormErrors,
  toDateTimeLocal,
  validateCouponForm,
  type CouponFormValues,
} from './couponValidation';

function form(overrides: Partial<CouponFormValues> = {}): CouponFormValues {
  return { ...defaultCouponForm(), ...overrides };
}

describe('couponValidation', () => {
  it('accepts a valid percentage coupon', () => {
    expect(validateCouponForm(form({ code: 'MCOM-20OFF' }))).toEqual({});
  });

  it('rejects an invalid code', () => {
    const errors = validateCouponForm(form({ code: 'a' }));
    expect(errors.code).toBeDefined();
  });

  it('rejects 100 percent discounts', () => {
    const errors = validateCouponForm(form({ code: 'MCOM-ALL', discountValue: '100' }));
    expect(errors.discountValue).toContain('99%');
  });

  it('requires at least one enabled scope', () => {
    const errors = validateCouponForm(
      form({ code: 'MCOM-GOLD', appliesToAllMemberships: false }),
    );
    expect(errors.scope).toBeDefined();
  });

  it('ignores a scope that is toggled off', () => {
    const errors = validateCouponForm(
      form({
        code: 'MCOM-NOMEMBERSHIP',
        membershipScopeEnabled: false,
        appliesToAllMemberships: true,
      }),
    );
    expect(errors.scope).toBeDefined();
  });

  it('accepts an access-only coupon', () => {
    const errors = validateCouponForm(
      form({
        code: 'MCOM-ACCESS',
        membershipScopeEnabled: false,
        accessScopeEnabled: true,
        appliesToAllAccess: false,
        accessPlanIds: ['access-plan-1'],
      }),
    );
    expect(errors.scope).toBeUndefined();
  });

  it('accepts a membership-only coupon with access toggled off', () => {
    const errors = validateCouponForm(
      form({ code: 'MCOM-MEMBER', membershipScopeEnabled: true }),
    );
    expect(errors.scope).toBeUndefined();
  });

  it('accepts an all-access coupon without membership plans', () => {
    const errors = validateCouponForm(
      form({
        code: 'MCOM-ALLACCESS',
        appliesToAllMemberships: false,
        accessScopeEnabled: true,
        appliesToAllAccess: true,
      }),
    );
    expect(errors.scope).toBeUndefined();
  });

  it('rejects an expiry before the valid-from date', () => {
    const errors = validateCouponForm(
      form({
        code: 'MCOM-DATE',
        validFrom: '2026-12-10T10:00',
        expiresAt: '2026-12-01T10:00',
      }),
    );
    expect(errors.expiresAt).toBeDefined();
  });

  it('rejects a per-user cap above the total cap', () => {
    const errors = validateCouponForm(
      form({ code: 'MCOM-LIMIT', maxUses: '2', maxUsesPerUser: '3' }),
    );
    expect(errors.maxUsesPerUser).toBeDefined();
  });

  it('generates a valid uppercase code', () => {
    const code = generateCouponCode();
    expect(code).toMatch(/^MCOM-[A-Z2-9]{8}$/);
    expect(validateCouponForm(form({ code }))).toEqual({});
  });

  it('hasCouponFormErrors reflects the error map', () => {
    expect(hasCouponFormErrors({})).toBe(false);
    expect(hasCouponFormErrors({ code: 'bad' })).toBe(true);
  });

  it('formats an ISO date for datetime-local input', () => {
    expect(toDateTimeLocal('2026-10-21T09:30:00.000Z')).toMatch(/^2026-10-21T/);
  });
});
