import { Module } from '@nestjs/common';
import { MeshInboundModule } from '../mesh-inbound/mesh-inbound.module';
import { EcosystemMediaController } from './ecosystem-media.controller';

/**
 * Mesh-authenticated reads of Central-hosted uploads for ecosystem apps.
 * Kept separate from `EcosystemProfilesModule` so media handling (streaming,
 * caching headers, path sanitisation) stays isolated.
 */
@Module({
  imports: [MeshInboundModule],
  controllers: [EcosystemMediaController],
})
export class EcosystemMediaModule {}
