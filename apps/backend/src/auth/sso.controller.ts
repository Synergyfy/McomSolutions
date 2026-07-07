import { Controller, Get, Query, UnauthorizedException, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * SSO Controller – issues short‑lived JWTs for partner SSO.
 * Used by the Mcom Partner card to obtain a token that the affiliate
 * backend can validate and JIT provision.
 */
@Controller('auth')
export class SsoController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get('sso-token')
  async getSsoToken(@Query('role') role: string, @Req() req: Request) {
    // Require authentication – the request should contain user info from a guard
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const payload = {
      sub: user.id,
      email: user.email,
      role: role || user.role,
    };
    const secret = this.configService.get<string>('SSO_JWT_SECRET');
    const token = this.jwtService.sign(payload, {
      secret,
      expiresIn: '5m',
      algorithm: 'HS256',
    });
    return { ssoToken: token };
  }
}
