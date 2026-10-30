import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceIdentityModule } from '../service-identity/service-identity.module';
import { PartnerFeatureGuard } from './partner-feature.guard';
import { ServiceAuthGuard } from './service-auth.guard';
import { ServiceScopesGuard } from './service-scopes.guard';

/**
 * Reusable inbound half of the ecosystem service mesh. Exported guards let any
 * module protect a route with `@UseGuards(ServiceAuthGuard, ServiceScopesGuard)`.
 */
@Module({
  imports: [ConfigModule, PrismaModule, ServiceIdentityModule],
  providers: [ServiceAuthGuard, ServiceScopesGuard, PartnerFeatureGuard],
  exports: [
    ServiceIdentityModule,
    ServiceAuthGuard,
    ServiceScopesGuard,
    PartnerFeatureGuard,
  ],
})
export class MeshInboundModule {}
