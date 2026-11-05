import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessAcquisitionService } from './business-acquisition.service';

/**
 * Isolated module so both the affiliate controllers and the business/auth
 * registration flows can persist attribution without creating a module cycle.
 */
@Module({
  imports: [PrismaModule],
  providers: [BusinessAcquisitionService],
  exports: [BusinessAcquisitionService],
})
export class BusinessAcquisitionModule {}
