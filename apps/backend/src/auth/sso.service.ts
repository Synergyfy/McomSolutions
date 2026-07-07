import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Service that creates short‑lived JWTs for SSO flows.
 * It is reused by both the Mall and Partner SSO controllers.
 */
@Injectable()
export class SsoService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generates a JWT containing the supplied payload.
   * @param payload Minimal claims (sub, email, role, etc.)
   */
  generateToken(payload: Record<string, any>): string {
    const secret = this.configService.get<string>('SSO_JWT_SECRET');
    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '5m', // 5 minutes – same as existing Mall flow
      algorithm: 'HS256',
    });
  }
}
