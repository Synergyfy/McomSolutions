import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildReferralLink,
  getReferralCodeFromSearchParams,
  normalizeReferralCode,
  withReferralCode,
  REFERRAL_STORAGE_KEY,
} from './referral';

describe('referral helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('normalizeReferralCode', () => {
    it('uppercases valid codes', () => {
      expect(normalizeReferralCode('a1b2c3d4')).toBe('A1B2C3D4');
    });

    it('rejects blanks, short/long codes and symbols', () => {
      expect(normalizeReferralCode(null)).toBeNull();
      expect(normalizeReferralCode('')).toBeNull();
      expect(normalizeReferralCode('ABC')).toBeNull();
      expect(normalizeReferralCode('A'.repeat(13))).toBeNull();
      expect(normalizeReferralCode('AB-CD-12')).toBeNull();
    });
  });

  describe('getReferralCodeFromSearchParams', () => {
    it('reads ref, referral and referralCode keys', () => {
      expect(getReferralCodeFromSearchParams(new URLSearchParams('ref=a1b2c3d4'))).toBe('A1B2C3D4');
      expect(getReferralCodeFromSearchParams(new URLSearchParams('referral=a1b2c3d4'))).toBe('A1B2C3D4');
      expect(getReferralCodeFromSearchParams(new URLSearchParams('referralCode=a1b2c3d4'))).toBe('A1B2C3D4');
    });

    it('returns null when absent or invalid', () => {
      expect(getReferralCodeFromSearchParams(new URLSearchParams(''))).toBeNull();
      expect(getReferralCodeFromSearchParams(new URLSearchParams('ref=!!!'))).toBeNull();
    });
  });

  describe('withReferralCode', () => {
    it('merges the stored code into the payload', () => {
      localStorage.setItem(REFERRAL_STORAGE_KEY, 'A1B2C3D4');
      expect(withReferralCode({ email: 'a@b.c' })).toEqual({
        email: 'a@b.c',
        referredByCode: 'A1B2C3D4',
      });
    });

    it('prefers an explicit payload code', () => {
      localStorage.setItem(REFERRAL_STORAGE_KEY, 'A1B2C3D4');
      expect(withReferralCode({ referredByCode: 'Z9Y8X7W6' })).toEqual({
        referredByCode: 'Z9Y8X7W6',
      });
    });

    it('leaves the payload untouched when nothing is stored', () => {
      expect(withReferralCode({ email: 'a@b.c' })).toEqual({ email: 'a@b.c' });
    });
  });

  describe('buildReferralLink', () => {
    it('builds an absolute link from the current origin', () => {
      const link = buildReferralLink('A1B2C3D4');
      expect(link).toBe(`${window.location.origin}/register?ref=A1B2C3D4`);
    });

    it('returns null without a code', () => {
      expect(buildReferralLink(null)).toBeNull();
    });
  });
});
