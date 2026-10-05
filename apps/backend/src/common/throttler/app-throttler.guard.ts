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

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
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

    // Public request: throttle by IP as a safety-net against scrapers/bots.
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
