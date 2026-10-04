import * as crypto from 'crypto';

/** SHA-256 hash for refresh-token storage (never persist plaintext). */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse a TTL env value into seconds. Accepts plain seconds ("900") or
 * suffixed durations ("15m", "1h", "7d"). Falls back to `fallbackSeconds`
 * on garbage input (fail-safe, never fail-open).
 */
export function parseTtlSeconds(raw: string | undefined, fallbackSeconds: number): number {
  if (!raw) return fallbackSeconds;
  const match = /^(-?\d+)\s*([smhd])?$/i.exec(raw.trim());
  if (!match) return fallbackSeconds;
  const value = parseInt(match[1], 10);
  if (!Number.isFinite(value) || value <= 0) return fallbackSeconds;
  const unit = (match[2] || 's').toLowerCase();
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return value * multiplier;
}

/** Access TTL in seconds. Spec target: 15m (900s) unless JWT_ACCESS_TTL overrides. */
export function accessTtlSeconds(env: Record<string, string | undefined> = process.env): number {
  return parseTtlSeconds(env.JWT_ACCESS_TTL, 900);
}

/** Refresh TTL in seconds (7 days). */
export function refreshTtlSeconds(env: Record<string, string | undefined> = process.env): number {
  return parseTtlSeconds(env.JWT_REFRESH_TTL, 7 * 86400);
}
