import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServiceKeyService } from './keys/service-key.service';
import { ServiceTokenService } from './service-token.service';
import { ServiceTokenController } from './service-token.controller';
import { JwksController } from './jwks.controller';
import { EcosystemService } from './ecosystem.service';
import { EcosystemController } from './ecosystem.controller';

/**
 * Ecosystem service-to-service identity (M2M).
 *
 * Control plane only: issues short-lived RS256 service tokens, publishes the
 * public JWKS + service registry. Registered app backends then talk to each
 * other directly — requests never transit MCOM.
 */
@Module({
  imports: [AuthModule],
  controllers: [ServiceTokenController, JwksController, EcosystemController],
  providers: [ServiceKeyService, ServiceTokenService, EcosystemService],
  exports: [ServiceKeyService, EcosystemService, ServiceTokenService],
})
export class ServiceIdentityModule {}
