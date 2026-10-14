import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SsoUserGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const ssoSecret = this.configService.get<string>('SSO_JWT_SECRET');

    if (!ssoSecret) {
      throw new UnauthorizedException('SSO_JWT_SECRET is not configured');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: ssoSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired SSO token');
    }

    const userId = payload.sub || payload.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload: missing subject');
    }

    // Verify user exists and is active
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
        businessProfile: { select: { id: true, businessName: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account deactivated');
    }

    if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {
      throw new UnauthorizedException('Session revoked. Please log in again.');
    }

    // Attach normalized user object to request
    request.user = {
      userId: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      name: payload.name || user.businessProfile?.businessName || user.email.split('@')[0],
      businessId: user.businessProfile?.id || payload.businessId || null,
      scopes: payload.scopes || [],
    };

    return true;
  }
}
