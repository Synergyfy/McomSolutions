import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || 'mcom_sso_default_secret_key_123!';
    const ssoJwtSecret = configService.get<string>('SSO_JWT_SECRET') || 'default-sso-jwt-secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (_req: any, rawJwtToken: any, done: (err: any, secret?: string) => void) => {
        if (!rawJwtToken) {
          return done(null, jwtSecret);
        }
        // Try verifying with JWT_SECRET first; if that fails, try SSO_JWT_SECRET
        try {
          jwt.verify(rawJwtToken, jwtSecret);
          return done(null, jwtSecret);
        } catch {
          try {
            jwt.verify(rawJwtToken, ssoJwtSecret);
            return done(null, ssoJwtSecret);
          } catch {
            // If both fail, let Passport report the standard invalid signature error with jwtSecret
            return done(null, jwtSecret);
          }
        }
      },
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub || payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      businessId: payload.businessId,
    };
  }
}
