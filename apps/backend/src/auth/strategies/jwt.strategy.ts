import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required (no hardcoded fallback).');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Phase 3: regular API tokens verify against JWT_SECRET only.
      // SSO tokens (SSO_JWT_SECRET) are no longer accepted here.
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    const userId = payload.sub || payload.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid token');
    }
    // Phase 3: stateful validation — deleted users stay locked out,
    // role-change/ban/password-reset (tokenVersion bump) kills outstanding
    // access, and logged-out access jtis are rejected until they expire.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
        businessProfile: { select: { id: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {
      throw new UnauthorizedException('Session revoked. Please log in again.');
    }
    if (payload.jti) {
      const revoked = await this.prisma.refreshSession.findFirst({
        where: { accessJti: payload.jti, revokedAt: { not: null } },
        select: { id: true },
      });
      if (revoked) {
        throw new UnauthorizedException('Session expired. Please log in again.');
      }
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: payload.name,
      businessId: payload.businessId ?? user.businessProfile?.id ?? null,
    };
  }
}
