import {
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ServiceAuthGuard } from '../mesh-inbound/service-auth.guard';
import { ServiceScopesGuard } from '../mesh-inbound/service-scopes.guard';
import { RequireServiceScopes } from '../mesh-inbound/require-service-scopes.decorator';
import { SERVICE_SCOPE_CENTRAL_READ } from '../mesh-inbound/service-mesh.constants';
import { EcosystemProfilesService } from './ecosystem-profiles.service';

/**
 * Canonical profile lookup for ecosystem app backends.
 *
 * B2B flow: app receives `profile.updated` → calls this endpoint with an
 * RS256 service token (audience `mcom-central`, scope `central:read`) → gets
 * the same identity/profile payload as SSO. Central never pushes profile
 * data inside the event.
 */
@ApiTags('Ecosystem — Profiles (B2B)')
@ApiBearerAuth()
@UseGuards(ServiceAuthGuard, ServiceScopesGuard)
@RequireServiceScopes(SERVICE_SCOPE_CENTRAL_READ)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('ecosystem/profiles')
export class EcosystemProfilesController {
  constructor(private readonly profiles: EcosystemProfilesService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Fetch the canonical profile for a central user id',
  })
  @ApiParam({ name: 'userId', example: 'usr_123' })
  @ApiOkResponse({ description: 'Identity + role-specific profile + entitlement view' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'Caller does not serve this role' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid service token' })
  getProfile(@Param('userId') userId: string, @Req() req: Request) {
    const callerAppId = req.serviceCaller?.callerAppId;
    if (!callerAppId) {
      throw new UnauthorizedException('Service caller identity is missing');
    }
    return this.profiles.getProfileForCaller(callerAppId, userId);
  }
}
