import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookProcessor } from './webhook.processor';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, ConfigModule, QueueModule],
  providers: [WebhookDispatcherService, WebhookProcessor],
  exports: [WebhookDispatcherService],
})
export class WebhookDispatcherModule {}
