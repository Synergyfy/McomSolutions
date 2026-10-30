import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { CouponModule } from '../coupon/coupon.module';
import { EcosystemEventsModule } from '../ecosystem-events/ecosystem-events.module';
import { MeshInboundModule } from '../mesh-inbound/mesh-inbound.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerAuditService } from './partner-audit.service';
import { PartnerCatalogController } from './partner-catalog.controller';
import { PartnerCatalogService } from './partner-catalog.service';
import { PartnerCouponService } from './partner-coupon.service';
import { PartnerCouponsController } from './partner-coupons.controller';
import { PartnerGrantService } from './partner-grant.service';
import { PartnerGrantsController } from './partner-grants.controller';
import { PartnerRecipientService } from './partner-recipient.service';
import { PartnerUsersController } from './partner-users.controller';

/**
 * MCOM Rewards partner surface.
 *
 * Ingress is deny-by-default: every route verifies an RS256 mesh token offline,
 * enforces scope + feature flags, and derives the caller from the token. The
 * surface is deliberately narrow — catalogue reads, recipient resolution,
 * grants/access codes, and Central coupons.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    MeshInboundModule,
    AuthModule,
    CouponModule,
    EcosystemEventsModule,
    PricingModule,
    AccessModule,
  ],
  controllers: [
    PartnerCatalogController,
    PartnerUsersController,
    PartnerGrantsController,
    PartnerCouponsController,
    PartnerAdminController,
  ],
  providers: [
    PartnerCatalogService,
    PartnerRecipientService,
    PartnerGrantService,
    PartnerCouponService,
    PartnerAuditService,
  ],
  exports: [PartnerGrantService, PartnerAuditService],
})
export class PartnerModule {}
