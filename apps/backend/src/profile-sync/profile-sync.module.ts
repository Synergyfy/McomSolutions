import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookDispatcherModule } from '../webhook-dispatcher/webhook-dispatcher.module';
import { ProfileSyncService } from './profile-sync.service';

/**
 * Central → app profile synchronization. Kept in its own module so Auth,
 * Business and Customer services can publish profile events without importing
 * each other (avoids circular dependencies).
 */
@Module({
  imports: [PrismaModule, WebhookDispatcherModule],
  providers: [ProfileSyncService],
  exports: [ProfileSyncService],
})
export class ProfileSyncModule {}
