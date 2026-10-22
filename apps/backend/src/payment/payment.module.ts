import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PricingModule } from '../pricing/pricing.module';
import { CouponModule } from '../coupon/coupon.module';
import { AccessModule } from '../access/access.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceConnectorsModule } from '../service-connectors/service-connectors.module';
import { WebhookDispatcherModule } from '../webhook-dispatcher/webhook-dispatcher.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PricingModule, CouponModule, AccessModule, PrismaModule, ServiceConnectorsModule, WebhookDispatcherModule, AuthModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}

