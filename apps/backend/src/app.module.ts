import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { LoggingMiddleware } from './common/middleware/logging.middleware';

import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Global rate limiter — registered ONCE here. Per-route @Throttle()
    // overrides live in the controllers (Console, Wallet partner/admin).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
