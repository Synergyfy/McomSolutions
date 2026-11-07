import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { ReferralConfigPublicController } from './referral-config-public.controller';
import { ReferralAdminController } from './referral-admin.controller';
import { ReferralConfigService } from './referral-config.service';
import { ReferralCommissionService } from './referral-commission.service';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [
    ReferralsController,
    ReferralConfigPublicController,
    ReferralAdminController,
  ],
  providers: [
    ReferralsService,
    ReferralConfigService,
    ReferralCommissionService,
  ],
  exports: [
    ReferralsService,
    ReferralConfigService,
    ReferralCommissionService,
  ],
})
export class ReferralsModule {}
