import { Module } from '@nestjs/common';
import { DataSharingController } from './data-sharing.controller';
import { DataSharingService } from './data-sharing.service';
import { HmacAuthGuard } from './guards/hmac-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DataSharingController],
  providers: [DataSharingService, HmacAuthGuard],
  exports: [DataSharingService],
})
export class DataSharingModule {}
