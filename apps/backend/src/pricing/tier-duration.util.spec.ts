import {
  isLeapYear,
  spansLeapDay,
  normalizeTier,
  getTierDurationDays,
  calculateTierExpiry,
} from './tier-duration.util';

describe('tier-duration.util', () => {
  describe('isLeapYear', () => {
    it('correctly identifies leap years and non-leap years', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2028)).toBe(true);
      expect(isLeapYear(2000)).toBe(true); // Century divisible by 400
      expect(isLeapYear(1900)).toBe(false); // Century not divisible by 400
    });
  });

  describe('normalizeTier', () => {
    it('normalizes various tier formats', () => {
      expect(normalizeTier('standard')).toBe('Standard');
      expect(normalizeTier('Normal')).toBe('Standard');
      expect(normalizeTier('Standard (90 Days)')).toBe('Standard');
      expect(normalizeTier('pro')).toBe('Pro');
      expect(normalizeTier('Pro+')).toBe('Pro+');
      expect(normalizeTier('pro_plus')).toBe('Pro+');
      expect(normalizeTier('proplus')).toBe('Pro+');
    });
  });

  describe('getTierDurationDays', () => {
    it('returns 90 days for Standard tier', () => {
      expect(getTierDurationDays('Standard')).toBe(90);
    });

    it('returns 180 days for Pro tier', () => {
      expect(getTierDurationDays('Pro')).toBe(180);
    });

    it('returns 365 days for Pro+ tier in a standard year', () => {
      // 2026 is non-leap, 2027 is non-leap
      const start = new Date(Date.UTC(2026, 5, 1));
      expect(getTierDurationDays('Pro+', start)).toBe(365);
    });

    it('returns 366 days for Pro+ tier spanning February 29th of a leap year', () => {
      // Starting in October 2027 spans Feb 29, 2028
      const start = new Date(Date.UTC(2027, 9, 1));
      expect(getTierDurationDays('Pro+', start)).toBe(366);
    });
  });

  describe('calculateTierExpiry', () => {
    it('calculates 90 days ahead for Standard', () => {
      const start = new Date(Date.UTC(2026, 8, 14)); // Sept 14, 2026
      const expiry = calculateTierExpiry('Standard', start);
      const diffMs = expiry.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });

    it('calculates 180 days ahead for Pro', () => {
      const start = new Date(Date.UTC(2026, 8, 14)); // Sept 14, 2026
      const expiry = calculateTierExpiry('Pro', start);
      const diffMs = expiry.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(180);
    });

    it('calculates 1 full year ahead for Pro+ cleanly handling leap years', () => {
      const start = new Date(Date.UTC(2028, 1, 29)); // Feb 29, 2028 (leap year)
      const expiry = calculateTierExpiry('Pro+', start);
      expect(expiry.getUTCFullYear()).toBe(2029);
      expect(expiry.getUTCMonth()).toBe(1); // February
      expect(expiry.getUTCDate()).toBe(28); // Rolled to Feb 28 in 2029
    });
  });
});
