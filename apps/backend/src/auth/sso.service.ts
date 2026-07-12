import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SsoService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  generateToken(payload: Record<string, any>): string {
    const secret = this.configService.get<string>('SSO_JWT_SECRET') || 'default-sso-jwt-secret';
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

    if (!client.redirectUris.includes(redirectUri)) {
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

    // Mark code as used immediately to prevent reuse (OAuth specification)
    await this.prisma.ssoAuthCode.update({
      where: { code },
      data: { used: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: authCode.userId },
      include: { businessProfile: { include: { packages: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate tokens
    const jwtSecret = this.configService.get<string>('SSO_JWT_SECRET') || 'default-sso-jwt-secret';
    const accessTokenTtl = this.configService.get<string>('SSO_ACCESS_TOKEN_TTL') || '3600';
    const refreshTokenTtl = this.configService.get<string>('SSO_REFRESH_TOKEN_TTL') || '604800';

    const name = user.businessProfile?.businessName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name,
      businessId: user.businessProfile?.id || null,
      scopes: authCode.scopes,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: parseInt(accessTokenTtl, 10),
    });

    const refreshToken = this.jwtService.sign(payload, {
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

    const jwtSecret = this.configService.get<string>('SSO_JWT_SECRET') || 'default-sso-jwt-secret';
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
    const jwtSecret = this.configService.get<string>('SSO_JWT_SECRET') || 'default-sso-jwt-secret';
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

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      name,
      businessId: user.businessProfile?.id || null,
      membershipLevel: user.businessProfile?.membershipLevel || 'Bronze',
      membershipTier: user.businessProfile?.membershipTier || 'Normal',
      membershipStatus: user.businessProfile?.membershipStatus || 'active',
      phone: user.businessProfile?.phone || null,
      address: user.businessProfile?.address || null,
      postcode: user.businessProfile?.postcode || null,
      packages: user.businessProfile?.packages.map(pkg => ({
        platform: pkg.platform,
        packageName: pkg.packageName,
        status: pkg.status,
        limits: pkg.limits,
      })) || [],
    };
  }

  async getClientByClientId(clientId: string) {
    return this.prisma.ssoClient.findUnique({
      where: { clientId },
    });
  }

  async registerClient(data: any) {
    const salt = await bcrypt.genSalt();
    const clientSecret = await bcrypt.hash(data.clientSecret, salt);

    return this.prisma.ssoClient.create({
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
}
