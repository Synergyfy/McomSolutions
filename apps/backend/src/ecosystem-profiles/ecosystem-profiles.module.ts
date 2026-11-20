import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MeshInboundModule } from '../mesh-inbound/mesh-inbound.module';
import { EcosystemProfilesController } from './ecosystem-profiles.controller';
import { EcosystemProfilesService } from './ecosystem-profiles.service';

/**
 * Inbound B2B profile reads for ecosystem apps. Separate from the
 * `ProfileSyncModule` publisher so Auth can publish events without a circular
 * dependency (this module imports Auth for the canonical SSO payload).
 */
@Module({
  imports: [PrismaModule, AuthModule, MeshInboundModule],
  controllers: [EcosystemProfilesController],
  providers: [EcosystemProfilesService],
})
export class EcosystemProfilesModule {}
