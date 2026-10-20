import type { CouponDiscountType } from '../services/admin/types';

export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export interface CouponFormValues {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  appliesToAllMemberships: boolean;
  membershipPlanIds: string[];
  maxUses: string;
  maxUsesPerUser: string;
  validFrom: string;
  expiresAt: string;
  isActive: boolean;
  lockedToUserId: string;
}

export type CouponFormErrors = Partial<Record<keyof CouponFormValues, string>>;

export function toDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

export function defaultCouponForm(): CouponFormValues {
  return {
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '10',
    appliesToAllMemberships: true,
    membershipPlanIds: [],
    maxUses: '',
    maxUsesPerUser: '1',
    validFrom: toDateTimeLocal(new Date().toISOString()),
    expiresAt: '',
    isActive: true,
    lockedToUserId: '',
  };
}

export function generateCouponCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `MCOM-${suffix}`;
}

export function validateCouponForm(values: CouponFormValues): CouponFormErrors {
  const errors: CouponFormErrors = {};
  const code = values.code.trim().toUpperCase();
  if (!code) {
    errors.code = 'Enter a coupon code.';
  } else if (!COUPON_CODE_PATTERN.test(code)) {
    errors.code = 'Use 3–40 letters, numbers, hyphens or underscores.';
  }

  const value = Number(values.discountValue);
  if (!values.discountValue.trim() || !Number.isFinite(value) || value <= 0) {
    errors.discountValue = 'Enter a discount greater than zero.';
  } else if (values.discountType === 'PERCENTAGE' && value >= 100) {
    errors.discountValue = 'Percentage discounts must be between 1% and 99%.';
  } else if (values.discountType === 'FIXED' && value > 100000) {
    errors.discountValue = 'Fixed discount is too large.';
  }

  if (!values.appliesToAllMemberships && values.membershipPlanIds.length === 0) {
    errors.membershipPlanIds = 'Select at least one membership plan.';
  }

  const maxUses = values.maxUses.trim() === '' ? null : Number(values.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    errors.maxUses = 'Total uses must be a whole number of at least 1, or leave it blank.';
  }
  const perUser = values.maxUsesPerUser.trim() === '' ? null : Number(values.maxUsesPerUser);
  if (perUser !== null && (!Number.isInteger(perUser) || perUser < 1)) {
    errors.maxUsesPerUser = 'Per-user uses must be a whole number of at least 1, or leave it blank.';
  }
  if (maxUses !== null && perUser !== null && perUser > maxUses) {
    errors.maxUsesPerUser = 'Per-user limit cannot exceed the total usage limit.';
  }

  const validFrom = values.validFrom ? new Date(values.validFrom) : new Date();
  if (Number.isNaN(validFrom.getTime())) {
    errors.validFrom = 'Choose a valid start date.';
  }
  if (values.expiresAt) {
    const expiresAt = new Date(values.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      errors.expiresAt = 'Choose a valid expiry date.';
    } else if (expiresAt <= validFrom) {
      errors.expiresAt = 'Expiry must be after the valid-from date.';
    }
  }

  if (values.description.length > 250) {
    errors.description = 'Description must be 250 characters or fewer.';
  }

  return errors;
}

export function hasCouponFormErrors(errors: CouponFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
