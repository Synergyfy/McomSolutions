import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GeographyModule } from '../geography/geography.module';
import { MeshInboundModule } from '../mesh-inbound/mesh-inbound.module';

import { LocalAffiliateService } from './local-affiliate.service';
import { AffiliateCatalogueService } from './affiliate-catalogue.service';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { AffiliateConversionService } from './affiliate-conversion.service';
import { AffiliateRewardService } from './affiliate-reward.service';
import { AffiliateRedemptionService } from './affiliate-redemption.service';
import { AffiliateAdminService } from './affiliate-admin.service';

import { LocalAffiliateController } from './local-affiliate.controller';
import { AffiliateOfferController } from './affiliate-offer.controller';
import { LocalAffiliatePublicController } from './local-affiliate-public.controller';
import { AffiliateRedemptionController } from './affiliate-redemption.controller';
import { AffiliatePartnerController } from './affiliate-partner.controller';
import { AffiliateAdminController } from './affiliate-admin.controller';
import { LocalAffiliateJobs } from './local-affiliate.jobs';

/**
 * Local Affiliate (consumer affiliate programme).
 *
 * Deliberately separate from `AffiliateModule`, which is the 247GBS Affiliates
 * agency domain (tasks, projects, settlements for AGENT / CONSULTANT /
 * ACCOUNT_MANAGER). Nothing here touches that module, `isAffiliate`, or the
 * referral programme.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    GeographyModule,
    MeshInboundModule,
    ScheduleModule,
  ],
  controllers: [
    LocalAffiliateController,
    AffiliateOfferController,
    LocalAffiliatePublicController,
    AffiliateRedemptionController,
    AffiliatePartnerController,
    AffiliateAdminController,
  ],
  providers: [
    LocalAffiliateService,
    AffiliateCatalogueService,
    AffiliateTrackingService,
    AffiliateConversionService,
    AffiliateRewardService,
    AffiliateRedemptionService,
    AffiliateAdminService,
    LocalAffiliateJobs,
  ],
  exports: [
    LocalAffiliateService,
    AffiliateCatalogueService,
    AffiliateRewardService,
    AffiliateConversionService,
    AffiliateRedemptionService,
  ],
})
export class LocalAffiliateModule {}
