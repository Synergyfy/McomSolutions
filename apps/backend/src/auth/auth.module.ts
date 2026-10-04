import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { GoogleOAuthService } from './google-oauth.service';
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required (no hardcoded fallback).');
        }
        // Phase 3 (G4): spec access TTL is 15m. JWT_ACCESS_TTL may override
        // (accepts "15m", "1h", "900"); default is 15m with no code change.
        const { accessTtlSeconds } = await import('./refresh-session.util');
        return {
          secret,
          signOptions: { expiresIn: accessTtlSeconds() },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, SsoController],
  providers: [AuthService, LocalStrategy, JwtStrategy, SsoService, GoogleOAuthService],
  exports: [AuthService, SsoService, GoogleOAuthService],
})
export class AuthModule {}
