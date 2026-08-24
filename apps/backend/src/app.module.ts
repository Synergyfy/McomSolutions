import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ServiceConnectorsModule } from './service-connectors/service-connectors.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';

import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
    ServiceConnectorsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
