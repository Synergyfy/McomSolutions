import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SsoClient } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceKeyService } from './keys/service-key.service';
import { isPeerAllowed } from './policy.util';

export interface ServiceTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
  issued_token_type: string;
}

interface SignedToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

/**
 * Issues short-lived ecosystem service tokens (RS256) that registered app
 * backends present to one another. Verification happens offline at the
 * receiving app via JWKS — MCOM is never in the request path.
 *
 *  - `client_credentials`: pure service-to-service (sub = caller clientId).
 *  - token exchange (RFC 8693): user-bound delegation (sub = userId,
 *    act.sub = caller clientId).
 */
@Injectable()
export class ServiceTokenService {
  private readonly logger = new Logger(ServiceTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ServiceKeyService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueClientCredentialsToken(
    client: SsoClient,
    requestedScopes: string[],
    audience?: string,
  ): Promise<ServiceTokenResponse> {
    this.assertServiceEnabled(client);

    const scopes = this.resolveScopes(client, requestedScopes);
    const aud = await this.resolveAudience(client, audience);
    const ttl = this.keys.getTtlSeconds();

    const signed = this.sign(
      {
        sub: client.clientId,
        aud,
        scope: scopes.join(' '),
        typ: 'service',
      },
      ttl,
    );

    await this.audit({
      jti: signed.jti,
      tokenType: 'service',
      clientId: client.clientId,
      subject: null,
      audience: aud,
      scopes,
      expiresAt: signed.expiresAt,
    });

    return this.toResponse(signed.token, ttl, scopes);
  }

  /**
   * RFC 8693 token exchange. The caller (already authenticated via
   * SsoClientGuard) presents a user's SSO access token; MCOM validates it and
   * re-issues a delegated token scoped to the target app.
   */
  async exchangeUserToken(
    client: SsoClient,
    subjectToken: string,
    audience?: string,
    requestedScopes: string[] = [],
  ): Promise<ServiceTokenResponse> {
    this.assertServiceEnabled(client);

    if (!subjectToken || typeof subjectToken !== 'string') {
      throw new BadRequestException('subject_token is required');
    }

    const user = await this.verifySubjectToken(subjectToken);

    const scopes = this.resolveScopes(client, requestedScopes);
    const aud = await this.resolveAudience(client, audience);
    const ttl = this.keys.getTtlSeconds();

    const signed = this.sign(
      {
        sub: user.id,
        aud,
        scope: scopes.join(' '),
        typ: 'delegated',
        act: { sub: client.clientId },
        email: user.email,
        role: user.role,
        businessId: user.businessId,
      },
      ttl,
    );

    await this.audit({
      jti: signed.jti,
      tokenType: 'delegated',
      clientId: client.clientId,
      subject: user.id,
      audience: aud,
      scopes,
      expiresAt: signed.expiresAt,
    });

    return this.toResponse(signed.token, ttl, scopes);
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private assertServiceEnabled(client: SsoClient): void {
    if (!client.isActive) {
      throw new UnauthorizedException('Client is inactive');
    }
    if (!client.serviceEnabled) {
      throw new ForbiddenException(
        `Service-to-service access is disabled for "${client.clientId}". Enable it in the MCOM Console.`,
      );
    }
  }

  private async resolveAudience(client: SsoClient, audience?: string): Promise<string> {
    const target = (audience ?? '').trim();
    if (!target || target === 'mcom-ecosystem') {
      return 'mcom-ecosystem';
    }

    const targetClient = await this.prisma.ssoClient.findFirst({
      where: {
        isActive: true,
        serviceEnabled: true,
        OR: [{ clientId: target }, { platformSlug: target }],
      },
      select: { clientId: true, platformSlug: true },
    });

    if (!targetClient) {
      throw new BadRequestException(`Unknown or inactive target audience "${target}"`);
    }
    if (targetClient.clientId === client.clientId) {
      throw new BadRequestException('An app cannot request a token for itself');
    }

    const allowed = client.allowedAudiences ?? [];
    const egressAllowed =
      isPeerAllowed(allowed, targetClient.clientId) ||
      (targetClient.platformSlug ? isPeerAllowed(allowed, targetClient.platformSlug) : false);
    if (!egressAllowed) {
      throw new ForbiddenException(
        `Client "${client.clientId}" is not permitted to call "${targetClient.clientId}". ` +
          `Configure its allowed audiences in the MCOM Console.`,
      );
    }

    return targetClient.clientId;
  }

  private resolveScopes(client: SsoClient, requested: string[]): string[] {
    const allowed = client.serviceScopes ?? [];
    if (requested.length === 0) {
      return allowed;
    }
    const invalid = requested.filter((s) => !allowed.includes(s));
    if (invalid.length > 0) {
      throw new ForbiddenException(
        `Requested scope(s) not permitted for "${client.clientId}": ${invalid.join(', ')}`,
      );
    }
    return requested;
  }

  private async verifySubjectToken(
    subjectToken: string,
  ): Promise<{ id: string; email: string; role: string; businessId: string | null }> {
    const ssoSecret = this.config.get<string>('SSO_JWT_SECRET');
    if (!ssoSecret) {
      throw new UnauthorizedException('SSO token verification is not configured');
    }

    let payload: { sub?: string; email?: string; role?: string; businessId?: string | null };
    try {
      payload = await this.jwt.verifyAsync(subjectToken, { secret: ssoSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired subject_token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('subject_token has no subject');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        businessProfile: { select: { id: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Subject user not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessProfile?.id ?? null,
    };
  }

  private sign(
    claims: Record<string, unknown>,
    ttlSeconds: number,
  ): SignedToken {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttlSeconds;
    const jti = crypto.randomUUID();

    const payload = {
      iss: this.keys.getIssuer(),
      iat: now,
      jti,
      ...claims,
    };

    // The shared JwtModule injects `signOptions.expiresIn`; jsonwebtoken throws
    // when a payload already carries `exp` and `expiresIn` is also supplied.
    // So `exp` is intentionally omitted here and the service-token TTL is passed
    // explicitly (overriding the module default) instead.
    const token = this.jwt.sign(payload, {
      algorithm: 'RS256',
      keyid: this.keys.getKid(),
      secret: this.keys.getPrivateKey(),
      expiresIn: ttlSeconds,
    });

    return { token, jti, expiresAt: new Date(exp * 1000) };
  }

  private toResponse(
    token: string,
    ttlSeconds: number,
    scopes: string[],
  ): ServiceTokenResponse {
    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: ttlSeconds,
      scope: scopes.join(' '),
      issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    };
  }

  private async audit(entry: {
    jti: string;
    tokenType: 'service' | 'delegated';
    clientId: string;
    subject: string | null;
    audience: string;
    scopes: string[];
    expiresAt: Date;
  }): Promise<void> {
    try {
      await this.prisma.serviceTokenAudit.create({
        data: {
          jti: entry.jti,
          tokenType: entry.tokenType,
          clientId: entry.clientId,
          subject: entry.subject,
          audience: entry.audience,
          scopes: entry.scopes,
          expiresAt: entry.expiresAt,
        },
      });
    } catch (err) {
      // Audit is best-effort — never block token issuance on a log write.
      this.logger.warn(`Failed to write service token audit: ${(err as Error).message}`);
    }
  }
}
