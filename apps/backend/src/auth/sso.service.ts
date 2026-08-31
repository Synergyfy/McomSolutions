import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { calculatePermissions } from '../data-sharing/permissions.util';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SsoService {
  private readonly memCache = new Map<string, { data: any; exp: number }>();
  private static readonly MEM_TTL_MS = 30_000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getSsoJwtSecret(): string {
    const secret =
      this.configService.get<string>('SSO_JWT_SECRET') ||
      this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('SSO_JWT_SECRET or JWT_SECRET must be configured (no hardcoded fallback).');
    }
    return secret;
  }

  generateToken(payload: Record<string, any>): string {
    const secret = this.getSsoJwtSecret();
    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '5m',
      algorithm: 'HS256',
    });
  }

  async generateAuthCode(userId: string, clientId: string, redirectUri: string, scopes: string[]): Promise<string> {
    const client = await this.prisma.ssoClient.findUnique({
      where: { clientId },
    });

    if (!client) {
      throw new BadRequestException('Client not found');
    }

    const normalizedRedirectUri = redirectUri.trim().replace(/\/$/, '');
    const isAllowed = client.redirectUris.some(uri => uri.trim().replace(/\/$/, '') === normalizedRedirectUri);

    if (!isAllowed) {
      throw new BadRequestException('Redirect URI not allowed for this client');
    }

    const code = crypto.randomBytes(32).toString('hex');
    const codeTtl = parseInt(this.configService.get<string>('SSO_CODE_TTL_SECONDS') || '300', 10);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + codeTtl);

    await this.prisma.ssoAuthCode.create({
      data: {
        code,
        userId,
        clientId: client.id,
        redirectUri,
        scopes,
        expiresAt,
      },
    });

    return code;
  }

  async exchangeCodeForTokens(code: string, clientId: string, redirectUri: string) {
    const authCode = await this.prisma.ssoAuthCode.findUnique({
      where: { code },
      include: { client: true },
    });

    if (!authCode) {
      throw new UnauthorizedException('Invalid authorization code');
    }

    if (authCode.used) {
      throw new UnauthorizedException('Authorization code has already been used');
    }

    if (authCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Authorization code has expired');
    }

    if (authCode.client.clientId !== clientId) {
      throw new UnauthorizedException('Client mismatch');
    }

    if (authCode.redirectUri !== redirectUri) {
      throw new UnauthorizedException('Redirect URI mismatch');
    }

    // Atomically mark code as used to prevent race conditions on concurrent requests
    const updateResult = await this.prisma.ssoAuthCode.updateMany({
      where: { code, used: false },
      data: { used: true },
    });

    if (updateResult.count === 0) {
      throw new UnauthorizedException('Authorization code has already been used');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authCode.userId },
      include: { businessProfile: { include: { packages: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate tokens
    const jwtSecret = this.getSsoJwtSecret();
    const accessTokenTtl = this.configService.get<string>('SSO_ACCESS_TOKEN_TTL') || '3600';
    const refreshTokenTtl = this.configService.get<string>('SSO_REFRESH_TOKEN_TTL') || '604800';

    const name = user.businessProfile?.businessName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];

    const accessPayload = {
      jti: crypto.randomUUID(),
      sub: user.id,
      email: user.email,
      role: user.role,
      name,
      businessId: user.businessProfile?.id || null,
      scopes: authCode.scopes,
    };

    const refreshPayload = {
      jti: crypto.randomUUID(),
      sub: user.id,
      email: user.email,
      role: user.role,
      name,
      businessId: user.businessProfile?.id || null,
      scopes: authCode.scopes,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: jwtSecret,
      expiresIn: parseInt(accessTokenTtl, 10),
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: jwtSecret,
      expiresIn: parseInt(refreshTokenTtl, 10),
    });

    // Save SSO Session in DB
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setSeconds(sessionExpiresAt.getSeconds() + parseInt(refreshTokenTtl, 10));

    await this.prisma.ssoSession.create({
      data: {
        userId: user.id,
        clientId: authCode.client.id,
        accessToken,
        refreshToken,
        expiresAt: sessionExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(accessTokenTtl, 10),
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        businessProfile: user.businessProfile
          ? {
              id: user.businessProfile.id,
              businessName: user.businessProfile.businessName,
              membershipLevel: user.businessProfile.membershipLevel,
              membershipStatus: user.businessProfile.membershipStatus,
            }
          : null,
      },
    };
  }

  async refreshSsoToken(refreshToken: string) {
    const session = await this.prisma.ssoSession.findUnique({
      where: { refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.ssoSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const jwtSecret = this.getSsoJwtSecret();
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, { secret: jwtSecret });
    } catch (e) {
      await this.prisma.ssoSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { businessProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const name = user.businessProfile?.businessName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
    const newPayload = {
      jti: crypto.randomUUID(),
      sub: user.id,
      email: user.email,
      role: user.role,
      name,
      businessId: user.businessProfile?.id || null,
      scopes: payload.scopes,
    };

    const accessTokenTtl = this.configService.get<string>('SSO_ACCESS_TOKEN_TTL') || '3600';
    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: jwtSecret,
      expiresIn: parseInt(accessTokenTtl, 10),
    });

    // Update session
    await this.prisma.ssoSession.update({
      where: { id: session.id },
      data: { accessToken: newAccessToken },
    });

    return {
      accessToken: newAccessToken,
      expiresIn: parseInt(accessTokenTtl, 10),
      tokenType: 'Bearer',
    };
  }

  async logout(accessToken: string) {
    const session = await this.prisma.ssoSession.findUnique({
      where: { accessToken },
    });

    if (session) {
      await this.prisma.ssoSession.delete({
        where: { id: session.id },
      });
    }
    return { success: true };
  }

  async getUserInfoFromToken(accessToken: string) {
    const jwtSecret = this.getSsoJwtSecret();
    let payload: any;
    try {
      payload = this.jwtService.verify(accessToken, { secret: jwtSecret });
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { businessProfile: { include: { packages: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const name = user.businessProfile?.businessName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];

    const membershipLevel = user.businessProfile?.membershipLevel || 'Bronze';
    const membershipStatus = user.businessProfile?.membershipStatus || 'active';
    const packages = user.businessProfile?.packages ?? [];
    const permissions = calculatePermissions(
      user.role,
      membershipLevel,
      membershipStatus,
      packages,
    );

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      name,
      businessId: user.businessProfile?.id || null,
      membershipLevel,
      membershipTier: user.businessProfile?.membershipTier || 'Normal',
      membershipStatus,
      phone: user.businessProfile?.phone || null,
      address: user.businessProfile?.address || null,
      postcode: user.businessProfile?.postcode || null,
      packages: packages.map(pkg => ({
        platform: pkg.platform,
        packageName: pkg.packageName,
        status: pkg.status,
        limits: pkg.limits,
      })),
      permissions,
    };
  }

  async getClientByClientId(clientId: string) {
    // L1: in-memory cache (fastest, no network)
    const mem = this.memCache.get(clientId);
    if (mem && mem.exp > Date.now()) {
      return mem.data;
    }

    // L2: Redis cache (shared across instances)
    const cacheKey = `sso_client:${clientId}`;
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      this.memCache.set(clientId, { data: cached, exp: Date.now() + SsoService.MEM_TTL_MS });
      return cached;
    }

    // L3: PostgreSQL (source of truth)
    const client = await this.prisma.ssoClient.findUnique({
      where: { clientId },
    });

    if (client) {
      // Cache client object in Redis for 5 minutes (300s) and L1 for 30s
      await this.redisService.set(cacheKey, client, 300);
      this.memCache.set(clientId, { data: client, exp: Date.now() + SsoService.MEM_TTL_MS });
    }

    return client;
  }

  async invalidateMemCache(clientId?: string) {
    if (clientId) {
      this.memCache.delete(clientId);
    } else {
      this.memCache.clear();
    }
  }

  /**
   * Flattens `corsOrigins` from all active SsoClient records.
   * Redis-cached under `cors:all_origins` (60s TTL) — used by main.ts CORS bootstrap
   * and the 60s polling refresh.
   */
  async getAllCorsOrigins(): Promise<string[]> {
    const cacheKey = 'cors:all_origins';
    const cached = await this.redisService.get<string[]>(cacheKey);
    if (cached) return cached;

    const clients = await this.prisma.ssoClient.findMany({
      where: { isActive: true },
      select: { corsOrigins: true },
    });

    const origins = [...new Set(clients.flatMap((c) => c.corsOrigins ?? []))];
    await this.redisService.set(cacheKey, origins, 60);
    return origins;
  }

  /** Invalidates the CORS origin cache whenever a console write changes origins. */
  async invalidateCorsCache(): Promise<void> {
    await this.redisService.del('cors:all_origins');
  }

  async registerClient(data: any) {
    const salt = await bcrypt.genSalt();
    const clientSecret = await bcrypt.hash(data.clientSecret, salt);

    const created = await this.prisma.ssoClient.create({
      data: {
        clientId: data.clientId,
        clientSecret,
        name: data.name,
        redirectUris: data.redirectUris,
        scopes: data.scopes || ['profile', 'email'],
        logoUrl: data.logoUrl || null,
        apiKey: data.apiKey || `api_key_${crypto.randomBytes(16).toString('hex')}`,
      },
    });

    await this.redisService.del(`sso_client:${data.clientId}`);
    this.memCache.delete(data.clientId);
    return created;
  }

  async listClients() {
    return this.prisma.ssoClient.findMany({
      select: {
        id: true,
        clientId: true,
        name: true,
        redirectUris: true,
        scopes: true,
        logoUrl: true,
        apiKey: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateClient(clientId: string, data: { redirectUris?: string[]; name?: string; isActive?: boolean }) {
    const client = await this.prisma.ssoClient.findUnique({ where: { clientId } });
    if (!client) {
      throw new BadRequestException('Client not found');
    }
    const updated = await this.prisma.ssoClient.update({
      where: { clientId },
      data,
    });

    // Invalidate Redis cache instantly on update
    await this.redisService.del(`sso_client:${clientId}`);
    this.memCache.delete(clientId);
    return updated;
  }

  async clearClientCache(clientId?: string) {
    if (clientId) {
      await this.redisService.del(`sso_client:${clientId}`);
      this.memCache.delete(clientId);
    } else {
      await this.redisService.delPattern('sso_client:*');
      this.memCache.clear();
    }
    return { success: true, message: 'SSO Client cache invalidated' };
  }
}
