import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { CatalogController } from './catalog.controller';
import { AuthModule } from '../auth/auth.module';
import { TASK_EVENT_QUEUE } from '../queue/queue.constants';
import { GeographyModule } from '../geography/geography.module';
import { BusinessAcquisitionModule } from '../affiliate/business-acquisition.module';

@Module({
  imports: [
    AuthModule,
    GeographyModule,
    BusinessAcquisitionModule,
    BullModule.registerQueue({
      name: TASK_EVENT_QUEUE,
    }),
  ],
  controllers: [BusinessController, CatalogController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
