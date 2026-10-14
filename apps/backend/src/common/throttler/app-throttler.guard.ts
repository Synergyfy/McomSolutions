import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom throttler guard that scopes the rate-limit budget per **user** for
 * authenticated requests, and per **IP** for public/unauthenticated ones.
 *
 * Why: the default ThrottlerGuard keys everything by IP. When a frontend
 * makes 10–15 parallel requests on page load (all from the same IP), they
 * all consume the same bucket and trip the limit instantly — even though
 * they belong to a legitimate logged-in user.
 *
 * Strategy:
 *  - Authenticated request  → key = `user:<userId>` (from JWT sub, decoded
 *    without full verification — auth still happens via JwtAuthGuard later)
 *  - Public / unauthenticated → key = IP address (safety-net for abuse)
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader: string | undefined = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.cookies?.['mcom_session'] || req.cookies?.['access']);

    if (token && typeof token === 'string') {
      try {
        // Decode (no verification) — we only use this as a stable bucket key.
        // The cryptographic check still happens inside JwtAuthGuard.
        const payloadB64 = token.split('.')[1];
        if (payloadB64) {
          const payload = JSON.parse(
            Buffer.from(payloadB64, 'base64url').toString('utf8'),
          );
          const sub: string | undefined = payload?.sub;
          if (sub) return `user:${sub}`;
        }
      } catch {
        // Malformed token — fall through to IP.
      }
    }

    // Public request: extract real client IP behind Cloudflare or reverse proxies
    const cfConnectingIp = req.headers?.['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
      return cfConnectingIp.trim();
    }

    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
      const firstIp = xForwardedFor.split(',')[0].trim();
      if (firstIp) return firstIp;
    }

    // Fallback: Express req.ip (populated when trust proxy is active) or socket
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
