import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TASK_EVENT_QUEUE } from '../queue/queue.constants';
import { CouponModule } from '../coupon/coupon.module';
import { EcosystemEventsModule } from '../ecosystem-events/ecosystem-events.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { BusinessAcquisitionModule } from '../affiliate/business-acquisition.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [
    CouponModule,
    EcosystemEventsModule,
    AffiliateModule,
    BusinessAcquisitionModule,
    BullModule.registerQueue({ name: TASK_EVENT_QUEUE }),
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
