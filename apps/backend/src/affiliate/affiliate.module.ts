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
import { AffiliateBusinessAcquisitionController } from './affiliate-business-acquisition.controller';
import { AffiliateBusinessAcquisitionAdminController } from './affiliate-business-acquisition-admin.controller';
import { BusinessAcquisitionModule } from './business-acquisition.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AffiliateApiKeyGuard } from './guards/affiliate-api-key.guard';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    ChatModule,
    QueueModule,
    GeographyModule,
    TaskModule,
    WalletModule,
    BusinessAcquisitionModule,
    ReferralsModule,
  ],
  controllers: [
    AffiliateBusinessController,
    AffiliateAdminController,
    AffiliateInboundController,
    AffiliateBusinessAcquisitionController,
    AffiliateBusinessAcquisitionAdminController,
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
