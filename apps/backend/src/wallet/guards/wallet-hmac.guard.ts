import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SsoService } from '../../auth/sso.service';
import { decrypt } from '../../console/crypto.util';
import { verifyHmac } from '../../data-sharing/hmac.util';

/**
 * HMAC guard for partner wallet endpoints (`/api/v1/wallet/partner`).
 *
 * Every Console-registered app with a Client ID automatically gains wallet
 * access — no separate enrollment list is required. The guard resolves the
 * calling app from the `X-Mcom-Client-ID` header, verifies the
 * `X-Mcom-Signature: sha256=<hmac-hex>` over the raw request body, and attaches
 * the full SsoClient record to `req.partnerClient` for platform attribution.
 *
 * Secret resolution (3 tiers, matching the existing data-sharing guard):
 *   Tier 1 — per-client `hmacSecret` from DB (AES-256-GCM encrypted at rest)
 *   Tier 2 — per-service env var `MCOM_{CLIENT_ID}_SECRET`
 *   Tier 3 — global `SSO_API_SECRET` fallback
 */
@Injectable()
export class WalletHmacGuard implements CanActivate {
  constructor(
    private readonly ssoService: SsoService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const clientId: string | undefined = request.headers['x-mcom-client-id'];
    const signature: string | undefined = request.headers['x-mcom-signature'];

    if (!clientId) {
      throw new UnauthorizedException('Missing required header: X-Mcom-Client-ID');
    }
    if (!signature) {
      throw new UnauthorizedException('Missing required header: X-Mcom-Signature');
    }

    const client = await this.ssoService.getClientByClientId(clientId);
    if (!client || !client.isActive) {
      throw new UnauthorizedException('Unknown or inactive client');
    }

    const secret = await this.resolveSecret(client);
    const body = this.rawBody(request);

    if (!verifyHmac(body, signature, secret)) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    request.partnerClient = client;
    return true;
  }

  private async resolveSecret(client: any): Promise<string> {
    if (client.hmacSecret) {
      try {
        const key = this.configService.get<string>('CONSOLE_ENCRYPTION_KEY');
        if (key) {
          return decrypt(client.hmacSecret, key);
        }
      } catch {
        // fall through to env/global tiers if decryption fails
      }
    }

    const envKey = `MCOM_${client.clientId.replace(/-/g, '_').toUpperCase()}_SECRET`;
    const envSecret = this.configService.get<string>(envKey);
    if (envSecret) {
      return envSecret;
    }

    const globalSecret = this.configService.get<string>('SSO_API_SECRET');
    if (!globalSecret) {
      throw new UnauthorizedException(
        `No HMAC secret configured for client "${client.clientId}". Set SSO_API_SECRET or ${envKey}.`,
      );
    }
    return globalSecret;
  }

  private rawBody(request: any): string | Buffer {
    if (request.rawBody && request.rawBody.length > 0) {
      return request.rawBody;
    }
    if (request.body !== undefined && request.body !== null) {
      return typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    }
    // GET requests carry no body — the HMAC is computed over an empty string.
    return '';
  }
}