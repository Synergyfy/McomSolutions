import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/throttler/app-throttler.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { PricingModule } from './pricing/pricing.module';
import { PaymentModule } from './payment/payment.module';
import { IntegrationModule } from './integration/integration.module';
import { NotificationModule } from './notification/notification.module';
import { DataSharingModule } from './data-sharing/data-sharing.module';
import { AdminModule } from './admin/admin.module';
import { ProgrammeModule } from './programme/programme.module';
import { CampaignModule } from './campaign/campaign.module';
import { ServiceConnectorsModule } from './service-connectors/service-connectors.module';
import { ConsoleModule } from './console/console.module';
import { WalletModule } from './wallet/wallet.module';
import { WebhookDispatcherModule } from './webhook-dispatcher/webhook-dispatcher.module';
import { QueueModule } from './queue/queue.module';
import { TaskModule } from './task/task.module';
import { ReferralsModule } from './referrals/referrals.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';

import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';

/**
 * Fail-fast environment validation. Runs before the app bootstraps so a
 * misconfigured deployment errors loudly instead of silently using a fallback.
 */
function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';

  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (isProduction) {
    // Phase 3: SSO audience uses its own secret — production fails closed.
    const prodRequired = ['SSO_API_SECRET', 'CONSOLE_ENCRYPTION_KEY', 'SSO_JWT_SECRET', 'OTP_PEPPER'];
    const prodMissing = prodRequired.filter((key) => !config[key]);
    if (prodMissing.length > 0) {
      throw new Error(
        `Missing required environment variables in production: ${prodMissing.join(', ')}`,
      );
    }
  }

  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Global rate limiter — registered ONCE here. Per-route @Throttle()
    // overrides live in the controllers (Console, Wallet partner/admin).
    // Phase 3 (G4): Redis-backed storage so budgets hold across instances
    // (in-memory fallback inside the storage when Redis is down).
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        // Global safety-net: 300 req/min per user (authenticated) or per IP
        // (public). Sensitive routes override this with their own @Throttle().
        throttlers: [{ ttl: 60000, limit: 300, blockDuration: 60000 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    BusinessModule,
    PricingModule,
    PaymentModule,
    IntegrationModule,
    NotificationModule,
    DataSharingModule,
    AdminModule,
    ProgrammeModule,
    CampaignModule,
    ServiceConnectorsModule,
    ConsoleModule,
    WalletModule,
    WebhookDispatcherModule,
    QueueModule,
    TaskModule,
    ReferralsModule,
  ],
  controllers: [],
  // Global throttler: AppThrottlerGuard keys by userId for authenticated
  // requests (each user gets their own 300 req/min budget) and by IP for
  // public ones. Per-route @Throttle() on sensitive endpoints (auth, console,
  // wallet) still apply their own stricter limits on top of this.
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
