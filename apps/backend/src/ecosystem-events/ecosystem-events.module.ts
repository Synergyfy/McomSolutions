import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookDispatcherModule } from '../webhook-dispatcher/webhook-dispatcher.module';
import { EcosystemEventsService } from './ecosystem-events.service';

/**
 * Central → partner lifecycle events. Kept in its own module so Pricing,
 * Access and Coupon can emit without importing the partner API module
 * (avoids a circular dependency).
 */
@Module({
  imports: [ConfigModule, PrismaModule, WebhookDispatcherModule],
  providers: [EcosystemEventsService],
  exports: [EcosystemEventsService],
})
export class EcosystemEventsModule {}
