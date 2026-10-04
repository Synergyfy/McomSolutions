import * as crypto from 'crypto';

/** OTP purposes share one Redis scheme — email verification and password reset. */
export type OtpPurpose = 'OTP' | 'PASSWORD_RESET';

/** Stored Redis payload — only the HMAC hash, never the plaintext code. */
export interface OtpRecord {
  h: string;
  attempts: number;
}

/** 10-minute code validity. */
export const OTP_TTL_SECONDS = 600;
/** 60-second resend cooldown per email+purpose. */
export const OTP_COOLDOWN_SECONDS = 60;
/** Max wrong attempts before the code is burned. */
export const OTP_MAX_ATTEMPTS = 5;

export function normalizeOtpEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function otpKey(purpose: OtpPurpose, email: string): string {
  return `otp:${purpose}:${normalizeOtpEmail(email)}`;
}

export function otpCooldownKey(purpose: OtpPurpose, email: string): string {
  return `otp:cooldown:${purpose}:${normalizeOtpEmail(email)}`;
}

/**
 * HMAC-SHA256 of the 6-digit code with a server-side pepper.
 * Plain SHA-256 of a 6-digit code is brute-forceable (1M combos) if the
 * cache dumps — the pepper makes offline brute force infeasible.
 */
export function hashOtp(code: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(code, 'utf8').digest('hex');
}

/** Constant-time comparison to avoid leaking prefix matches via timing. */
export function verifyOtpHash(candidateCode: string, expectedHash: string, pepper: string): boolean {
  const candidateHash = hashOtp(candidateCode, pepper);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
