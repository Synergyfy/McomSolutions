/**
 * Tier Duration & Leap-Year Calculation Utilities
 * 
 * Sub-tier durations:
 * - Standard: 90 days from activation
 * - Pro: 180 days from activation
 * - Pro+: 1 calendar year (Annually), strictly accounting for leap years
 *   (e.g., if the 1-year interval spans February 29th, the duration is 366 days; otherwise 365 days).
 */

export type TierType = 'Standard' | 'Pro' | 'Pro+';

/**
 * Checks whether a given Gregorian calendar year is a leap year.
 * Rule: Divisible by 4, but not by 100 unless also divisible by 400.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Checks whether the one-year interval [startDate, startDate + 1 year) contains February 29th.
 */
export function spansLeapDay(startDate: Date): boolean {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setFullYear(end.getFullYear() + 1);

  // Check the start year if started before or on Feb 29
  const startYear = start.getFullYear();
  if (isLeapYear(startYear)) {
    const leapDayStartYear = new Date(Date.UTC(startYear, 1, 29));
    if (start.getTime() <= leapDayStartYear.getTime() && end.getTime() > leapDayStartYear.getTime()) {
      return true;
    }
  }

  // Check the end year if end extends past Feb 29
  const endYear = end.getFullYear();
  if (isLeapYear(endYear)) {
    const leapDayEndYear = new Date(Date.UTC(endYear, 1, 29));
    if (start.getTime() <= leapDayEndYear.getTime() && end.getTime() >= leapDayEndYear.getTime()) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes any incoming tier identifier to the canonical representation:
 * 'Standard', 'Pro', or 'Pro+'
 */
export function normalizeTier(rawTier: string): TierType {
  const t = (rawTier || '').trim().toLowerCase().replace(/[^a-z0-9+]/g, '');
  if (t === 'pro') return 'Pro';
  if (t.includes('plus') || t.includes('+') || t === 'proplus') return 'Pro+';
  return 'Standard';
}

/**
 * Computes the duration in calendar days for a given tier.
 * Standard: 90 days
 * Pro: 180 days
 * Pro+: 366 days if leap day is spanned, otherwise 365 days
 */
export function getTierDurationDays(tier: string, startDate: Date = new Date()): number {
  const canonical = normalizeTier(tier);
  switch (canonical) {
    case 'Standard':
      return 90;
    case 'Pro':
      return 180;
    case 'Pro+':
      return spansLeapDay(startDate) ? 366 : 365;
  }
}

/**
 * Calculates the exact expiry timestamp (UTC) for a subscription tier from a start date.
 * - Standard: startDate + 90 calendar days
 * - Pro: startDate + 180 calendar days
 * - Pro+: Exactly 1 full calendar year ahead, handling Feb 29 rollbacks cleanly
 */
export function calculateTierExpiry(tier: string, startDate: Date = new Date()): Date {
  const canonical = normalizeTier(tier);
  const expiry = new Date(startDate.getTime());

  if (canonical === 'Standard') {
    expiry.setUTCDate(expiry.getUTCDate() + 90);
    return expiry;
  }

  if (canonical === 'Pro') {
    expiry.setUTCDate(expiry.getUTCDate() + 180);
    return expiry;
  }

  // Pro+ (Annual, leap year aware)
  const currentYear = expiry.getUTCFullYear();
  const currentMonth = expiry.getUTCMonth();
  const currentDay = expiry.getUTCDate();

  expiry.setUTCFullYear(currentYear + 1);

  // If start was leap day (Feb 29) and next year is not a leap year, roll to Feb 28
  if (currentMonth === 1 && currentDay === 29 && expiry.getUTCMonth() !== 1) {
    expiry.setUTCMonth(1, 28);
  }

  return expiry;
}
