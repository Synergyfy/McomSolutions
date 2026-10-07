/**
 * Shared referral helpers (?ref=CODE).
 *
 * Flow: every signup entry page persists `?ref=` to localStorage on mount
 * (survives OTP steps, reloads and payment redirects). Each register funnel
 * (authApi, businessApi, affiliate signup) merges the stored code into the
 * payload via `withReferralCode()` and clears it on success.
 */

export const REFERRAL_STORAGE_KEY = 'mcom_referral_code';
export const REFERRAL_QUERY_KEYS = ['ref', 'referral', 'referralCode'] as const;

const CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;

export function normalizeReferralCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return CODE_PATTERN.test(normalized) ? normalized : null;
}

export function getReferralCodeFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  for (const key of REFERRAL_QUERY_KEYS) {
    const normalized = normalizeReferralCode(searchParams.get(key));
    if (normalized) return normalized;
  }
  return null;
}

export function persistReferralCode(code: string | null | undefined): void {
  try {
    if (typeof window === 'undefined') return;
    const normalized = normalizeReferralCode(code);
    if (normalized) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
    }
  } catch {
    // Storage unavailable (private mode) — referral attribution is best-effort.
  }
}

/** Persist `?ref=` from the current URL search params. Returns the code (if any). */
export function persistReferralCodeFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  const code = getReferralCodeFromSearchParams(searchParams);
  persistReferralCode(code);
  return code;
}

export function getStoredReferralCode(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return normalizeReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Merge the stored referral code into a register payload (payload wins when
 * it already carries `referredByCode`).
 */
export function withReferralCode<T extends { referredByCode?: string }>(payload: T): T {
  if (payload.referredByCode) return payload;
  const stored = getStoredReferralCode();
  return stored ? { ...payload, referredByCode: stored } : payload;
}

export function buildReferralLink(code: string | null | undefined): string | null {
  if (!code) return null;
  if (typeof window === 'undefined') return `/register?ref=${code}`;
  return `${window.location.origin}/register?ref=${code}`;
}
