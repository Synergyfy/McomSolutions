import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TASK_EVENT_QUEUE } from '../queue/queue.constants';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: TASK_EVENT_QUEUE }),
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
