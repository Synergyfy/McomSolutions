import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceKeyService } from '../service-identity/keys/service-key.service';
import { isPeerAllowed } from '../service-identity/policy.util';
import { ServiceCaller } from './service-caller.types';
import {
  parseScopes,
  MCOM_CENTRAL_CLIENT_ID,
  SERVICE_MESH_AUDIENCE,
  SERVICE_MESH_CONFIG,
} from './service-mesh.constants';

/**
 * Inbound mesh authentication (Central as a callee).
 *
 * Verifies an RS256 service token **offline** using Central's own public key
 * (the same keypair published at `/.well-known/jwks.json`), enforces
 * `iss = mcom-solutions` and `aud = mcom-central`, then checks the caller
 * against Central's deny-by-default `allowedCallers` ingress policy.
 *
 * Caller identity is derived exclusively from the token (`act.sub` for
 * delegated tokens, otherwise `sub`). Headers such as `X-Caller-Id` are never
 * trusted.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(ServiceAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ServiceKeyService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing service token');
    }

    const claims = this.verifyToken(token);
    const callerAppId = this.resolveCaller(claims);
    const scopes = parseScopes(claims);

    const act = claims['act'] as Record<string, unknown> | undefined;
    const delegated = Boolean(act && typeof act['sub'] === 'string' && act['sub']);

    const caller: ServiceCaller = {
      callerAppId,
      scopes,
      isDelegated: delegated,
      userId: delegated ? String(claims['sub']) : undefined,
      email: typeof claims['email'] === 'string' ? claims['email'] : undefined,
      role: typeof claims['role'] === 'string' ? claims['role'] : undefined,
      businessId:
        typeof claims['businessId'] === 'string' ? claims['businessId'] : undefined,
      claims,
    };

    await this.assertCallerAllowed(callerAppId);

    req.serviceCaller = caller;
    return true;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private extractBearer(req: Request): string | null {
    const header = req.headers?.authorization;
    if (!header || typeof header !== 'string') return null;
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
  }

  private verifyToken(token: string): Record<string, unknown> {
    const issuer = this.keys.getIssuer();
    const audience =
      this.config.get<string>(SERVICE_MESH_CONFIG.audience) || SERVICE_MESH_AUDIENCE;

    let payload: unknown;
    try {
      payload = verify(token, this.keys.getPublicKey(), {
        algorithms: ['RS256'],
        issuer,
        audience,
      });
    } catch (err) {
      // Never leak token contents or library internals to the caller.
      const reason = (err as Error)?.name === 'TokenExpiredError' ? 'expired' : 'invalid';
      this.logger.warn(`Rejected inbound service token (${reason})`);
      throw new UnauthorizedException('Invalid or expired service token');
    }

    if (!payload || typeof payload !== 'object') {
      throw new UnauthorizedException('Invalid service token payload');
    }
    const claims = payload as Record<string, unknown>;
    if (typeof claims['sub'] !== 'string' || !claims['sub']) {
      throw new UnauthorizedException('Service token has no subject');
    }
    return claims;
  }

  private resolveCaller(claims: Record<string, unknown>): string {
    const act = claims['act'] as Record<string, unknown> | undefined;
    const actor = act && typeof act['sub'] === 'string' ? act['sub'] : null;
    const caller = actor || (claims['sub'] as string);
    if (!caller || typeof caller !== 'string') {
      throw new UnauthorizedException('Service token has no caller identity');
    }
    return caller;
  }

  private async assertCallerAllowed(callerAppId: string): Promise<void> {
    const client = await this.prisma.ssoClient.findFirst({
      where: {
        isActive: true,
        OR: [{ clientId: callerAppId }, { platformSlug: callerAppId }],
      },
      select: {
        clientId: true,
        platformSlug: true,
        serviceEnabled: true,
      },
    });

    if (!client || !client.serviceEnabled) {
      this.deny(callerAppId, 'caller is not an enabled service peer');
    }

    // Ingress policy belongs to THIS service (Central), not the caller.
    const selfClientId =
      this.config.get<string>('MCOM_CLIENT_ID') || MCOM_CENTRAL_CLIENT_ID;
    const self = await this.prisma.ssoClient.findFirst({
      where: {
        OR: [{ clientId: selfClientId }, { platformSlug: selfClientId }],
      },
      select: { allowedCallers: true },
    });

    const allowed = self
      ? self.allowedCallers ?? []
      : (this.config.get<string>(SERVICE_MESH_CONFIG.allowedCallers) || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);

    const permitted =
      isPeerAllowed(allowed, client.clientId) ||
      (client.platformSlug ? isPeerAllowed(allowed, client.platformSlug) : false);

    if (!permitted) {
      this.deny(callerAppId, 'caller not in allowedCallers');
    }
  }

  private deny(callerAppId: string, reason: string): never {
    this.logger.warn(`Denied inbound mesh caller "${callerAppId}": ${reason}`);
    throw new ForbiddenException('Caller not permitted to call this service');
  }
}
