import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required (no hardcoded fallback).');
    }
    const ssoJwtSecret = configService.get<string>('SSO_JWT_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (_req: any, rawJwtToken: any, done: (err: any, secret?: string) => void) => {
        if (!rawJwtToken) {
          return done(null, jwtSecret);
        }
        // Try verifying with JWT_SECRET first; if that fails and SSO_JWT_SECRET is
        // configured, try it. If both fail, let Passport report the standard invalid
        // signature error with jwtSecret.
        try {
          jwt.verify(rawJwtToken, jwtSecret);
          return done(null, jwtSecret);
        } catch {
          if (ssoJwtSecret) {
            try {
              jwt.verify(rawJwtToken, ssoJwtSecret);
              return done(null, ssoJwtSecret);
            } catch {
              return done(null, jwtSecret);
            }
          }
          return done(null, jwtSecret);
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
