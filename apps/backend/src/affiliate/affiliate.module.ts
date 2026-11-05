import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../common/mail/mail.module';
import { ChatModule } from '../chat/chat.module';
import { QueueModule } from '../queue/queue.module';
import { GeographyModule } from '../geography/geography.module';
import { TaskModule } from '../task/task.module';
import { WalletModule } from '../wallet/wallet.module';
import { AffiliateDirectoryService } from './affiliate-directory.service';
import { AffiliateReputationService } from './affiliate-reputation.service';
import { AffiliateClientService } from './affiliate-client.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import { AffiliateSettlementService } from './affiliate-settlement.service';
import { AffiliateTaskQuotaService } from './affiliate-task-quota.service';
import { AffiliateTaskService } from './affiliate-task.service';
import { AffiliateTaskProcessor } from './affiliate-task.processor';
import { AffiliateBusinessController } from './affiliate-business.controller';
import { AffiliateAdminController } from './affiliate-admin.controller';
import { AffiliateInboundController } from './affiliate-inbound.controller';
import { AffiliateApiKeyGuard } from './guards/affiliate-api-key.guard';

@Module({
  imports: [PrismaModule, MailModule, ChatModule, QueueModule, GeographyModule, TaskModule, WalletModule],
  controllers: [
    AffiliateBusinessController,
    AffiliateAdminController,
    AffiliateInboundController,
  ],
  providers: [
    AffiliateApiKeyGuard,
    AffiliateDirectoryService,
    AffiliateReputationService,
    AffiliateClientService,
    AccountManagerAssignmentService,
    AffiliateSettlementService,
    AffiliateTaskQuotaService,
    AffiliateTaskService,
    AffiliateTaskProcessor,
  ],
  exports: [
    AffiliateDirectoryService,
    AffiliateReputationService,
    AffiliateClientService,
    AccountManagerAssignmentService,
    AffiliateSettlementService,
    AffiliateTaskQuotaService,
    AffiliateTaskService,
  ],
})
export class AffiliateModule {}
