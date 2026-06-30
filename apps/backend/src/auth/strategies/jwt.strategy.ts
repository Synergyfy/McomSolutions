import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'mcom_sso_default_secret_key_123!',
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
