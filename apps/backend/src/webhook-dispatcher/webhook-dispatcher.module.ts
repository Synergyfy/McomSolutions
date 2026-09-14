import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [WebhookDispatcherService],
  exports: [WebhookDispatcherService],
})
export class WebhookDispatcherModule {}
