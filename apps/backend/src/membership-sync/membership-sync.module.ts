import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookDispatcherModule } from '../webhook-dispatcher/webhook-dispatcher.module';
import { MembershipSyncService } from './membership-sync.service';

/**
 * Central → app membership synchronization. Kept separate from
 * ProfileSyncModule so Pricing can publish membership events without pulling
 * in the whole profile graph.
 */
@Module({
  imports: [PrismaModule, WebhookDispatcherModule],
  providers: [MembershipSyncService],
  exports: [MembershipSyncService],
})
export class MembershipSyncModule {}
