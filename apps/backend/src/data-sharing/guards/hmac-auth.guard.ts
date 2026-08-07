import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA256 Service-to-Service Authentication Guard
 *
 * Validates that inbound requests from MCOM platform services are
 * signed with the correct shared secret for their service ID.
 * Zero database queries — secrets are read from environment variables.
 *
 * Required headers:
 *   X-Service-Id  : e.g. "mcom-rewards"
 *   X-Timestamp   : Unix timestamp (seconds) when the request was created
 *   X-Signature   : HMAC-SHA256(serviceId + ":" + timestamp, sharedSecret) as hex
 *
 * Secret resolution (in priority order):
 *   1. Per-service env var: MCOM_{SERVICE_ID_UPPER}_SECRET (e.g. MCOM_MALL_SECRET)
 *   2. Shared fallback: SSO_API_SECRET (all services use the same secret)
 *
 * Replay protection: requests older than 5 minutes are rejected.
 */

/** Map of allowed service IDs to their env-var key names for per-service secrets */
const SERVICE_SECRET_MAP: Record<string, string> = {
  'mcom-rewards': 'MCOM_REWARDS_SECRET',
  'mcom-spin': 'MCOM_SPIN_SECRET',
  'mcom-mall': 'MCOM_MALL_SECRET',
  'mcom-audit': 'MCOM_AUDIT_SECRET',
  'mcom-expo': 'MCOM_EXPO_SECRET',
};

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

@Injectable()
export class HmacAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const serviceId: string | undefined = request.headers['x-service-id'];
    const timestamp: string | undefined = request.headers['x-timestamp'];
    const signature: string | undefined = request.headers['x-signature'];

    if (!serviceId || !timestamp || !signature) {
      throw new UnauthorizedException(
        'Missing required headers: X-Service-Id, X-Timestamp, X-Signature',
      );
    }

    // Validate service ID is known
    const envKey = SERVICE_SECRET_MAP[serviceId];
    if (!envKey) {
      throw new UnauthorizedException(`Unknown service ID: ${serviceId}`);
    }

    // Validate timestamp to prevent replay attacks
    const nowSeconds = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (
      isNaN(requestTime) ||
      Math.abs(nowSeconds - requestTime) > REPLAY_WINDOW_SECONDS
    ) {
      throw new UnauthorizedException(
        'Request timestamp is expired or invalid. Ensure clocks are in sync.',
      );
    }

    // Resolve the shared secret
    // Priority: per-service env var > shared SSO_API_SECRET fallback
    let secret = process.env[envKey];
    if (!secret) {
      secret = process.env['SSO_API_SECRET'];
    }
    if (!secret) {
      throw new UnauthorizedException(
        `Service secret not configured for: ${serviceId}. Set SSO_API_SECRET or ${envKey}.`,
      );
    }

    // Recompute the expected HMAC signature
    const message = `${serviceId}:${timestamp}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');

    if (
      expectedBuf.length !== receivedBuf.length ||
      !timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    // Attach service identity to request for downstream use / logging
    request.serviceClient = { serviceId, name: serviceId };

    return true;
  }
}
