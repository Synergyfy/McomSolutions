import { Module } from '@nestjs/common';
import { DataSharingController } from './data-sharing.controller';
import { DataSharingService } from './data-sharing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DataSharingController],
  providers: [DataSharingService],
  exports: [DataSharingService],
})
export class DataSharingModule {}
