import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { WalletModule } from '../wallet/wallet.module';
import { WebhookDispatcherModule } from '../webhook-dispatcher/webhook-dispatcher.module';
import { NotificationModule } from '../notification/notification.module';
import { ServiceConnectorsModule } from '../service-connectors/service-connectors.module';
import { PricingModule } from '../pricing/pricing.module';
import { RecurringService } from './recurring.service';
import { RenewalSchedulerService } from './renewal-scheduler.service';
import { RecurringController } from './recurring.controller';
import { RecurringAdminController } from './recurring-admin.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    WalletModule,
    WebhookDispatcherModule,
    NotificationModule,
    ServiceConnectorsModule,
    PricingModule,
  ],
  controllers: [RecurringController, RecurringAdminController],
  providers: [RecurringService, RenewalSchedulerService],
  exports: [RecurringService],
})
export class RecurringModule {}
