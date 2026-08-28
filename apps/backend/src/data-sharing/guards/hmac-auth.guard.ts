import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SsoService } from '../../auth/sso.service';
import { decrypt } from '../../console/crypto.util';
import { verifyHmac } from '../hmac.util';

/**
 * HMAC Service-to-Service Authentication Guard
 *
 * Supports two signing schemes, resolved by header:
 *
 * 1) LEGACY SCHEME (unchanged — backward compatibility is non-negotiable):
 *    Headers: X-Service-Id, X-Timestamp, X-Signature
 *    Message: HMAC-SHA256(serviceId:timestamp, secret)
 *    Secret:  per-service env var (MCOM_{SERVICE_ID_UPPER}_SECRET) → SSO_API_SECRET
 *
 * 2) NEW SCHEME (Console-registered apps — additive):
 *    Headers: X-Mcom-Client-ID, X-Mcom-Signature: sha256=<hmac-hex>
 *    Message: HMAC-SHA256(requestBody, secret)
 *    Secret:  3-tier fallback
 *      Tier 1 — per-client `hmacSecret` from DB (encrypted at rest)
 *      Tier 2 — per-service env var MCOM_{CLIENT_ID_UPPER}_SECRET
 *      Tier 3 — global SSO_API_SECRET
 *    Existing callers WITHOUT X-Mcom-Client-ID skip Tiers 1/2 and behave exactly
 *    as before (legacy scheme).
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
  constructor(
    private readonly ssoService: SsoService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const clientId: string | undefined = request.headers['x-mcom-client-id'];

    // ─── NEW SCHEME: X-Mcom-Client-ID present ────────────────────────────────
    if (clientId) {
      return this.verifyNewScheme(request, clientId);
    }

    // ─── LEGACY SCHEME: preserved byte-for-byte ──────────────────────────────
    return this.verifyLegacyScheme(request);
  }

  // ─── NEW SCHEME (Console-registered apps) ──────────────────────────────────

  private async verifyNewScheme(request: any, clientId: string): Promise<boolean> {
    const signature: string | undefined = request.headers['x-mcom-signature'];
    if (!signature) {
      throw new UnauthorizedException('Missing required header: X-Mcom-Signature');
    }

    const secret = await this.resolveSecret(clientId);
    const body = this.rawBody(request);

    if (!verifyHmac(body, signature, secret)) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    request.serviceClient = { serviceId: clientId, name: clientId };
    return true;
  }

  private async resolveSecret(clientId: string): Promise<string> {
    // Tier 1: per-client secret from DB (new apps registered via Console)
    const client = await this.ssoService.getClientByClientId(clientId);
    if (client?.hmacSecret) {
      try {
        const key = this.configService.get<string>('CONSOLE_ENCRYPTION_KEY');
        if (key) {
          return decrypt(client.hmacSecret, key);
        }
      } catch {
        // fall through to env/global tiers if decryption fails
      }
    }

    // Tier 2: per-service env var (existing apps: MCOM_MALL_SECRET, etc.)
    const envKey = `MCOM_${clientId.replace(/-/g, '_').toUpperCase()}_SECRET`;
    const envSecret = this.configService.get<string>(envKey);
    if (envSecret) {
      return envSecret;
    }

    // Tier 3: global shared secret (original fallback — unchanged)
    const globalSecret = this.configService.get<string>('SSO_API_SECRET');
    if (!globalSecret) {
      throw new UnauthorizedException(
        `No HMAC secret configured for client "${clientId}". Set SSO_API_SECRET or ${envKey}.`,
      );
    }
    return globalSecret;
  }

  private rawBody(request: any): string | Buffer {
    if (request.rawBody && request.rawBody.length > 0) {
      return request.rawBody;
    }
    // Fallback when rawBody is unavailable (e.g. unit tests without rawBody enabled)
    if (request.body !== undefined && request.body !== null) {
      return typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }
    return '';
  }

  // ─── LEGACY SCHEME (unchanged) ─────────────────────────────────────────────

  private verifyLegacyScheme(request: any): boolean {
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