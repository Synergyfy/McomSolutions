import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PartnerFeatureGuard } from '../mesh-inbound/partner-feature.guard';
import { RequirePartnerFeature } from '../mesh-inbound/require-partner-feature.decorator';
import { RequireServiceScopes } from '../mesh-inbound/require-service-scopes.decorator';
import { ServiceAuthGuard } from '../mesh-inbound/service-auth.guard';
import { ServiceScopesGuard } from '../mesh-inbound/service-scopes.guard';
import {
  PartnerFeature,
  SERVICE_SCOPE_CENTRAL_READ,
} from '../mesh-inbound/service-mesh.constants';
import { PartnerCatalogService } from './partner-catalog.service';

/** Read-only partner catalogue (membership plans + access plans). */
@ApiTags('Partner — Catalogue')
@ApiBearerAuth()
@UseGuards(ServiceAuthGuard, ServiceScopesGuard, PartnerFeatureGuard)
@RequirePartnerFeature(PartnerFeature.API)
@RequireServiceScopes(SERVICE_SCOPE_CENTRAL_READ)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('partner/catalog')
export class PartnerCatalogController {
  constructor(private readonly catalog: PartnerCatalogService) {}

  @Get('memberships')
  @ApiOperation({ summary: 'List active membership plans with tiers, prices and bundles' })
  @ApiOkResponse({ description: 'Membership catalogue' })
  listMemberships() {
    return this.catalog.listMemberships();
  }

  @Get('memberships/:id')
  @ApiOperation({ summary: 'Get one active membership plan' })
  @ApiNotFoundResponse({ description: 'Plan not found or unavailable' })
  getMembership(@Param('id') id: string) {
    return this.catalog.getMembership(id);
  }

  @Get('access-plans')
  @ApiOperation({ summary: 'List active access plans with bundles and durations' })
  @ApiOkResponse({ description: 'Access-plan catalogue' })
  listAccessPlans() {
    return this.catalog.listAccessPlans();
  }

  @Get('access-plans/:id')
  @ApiOperation({ summary: 'Get one active access plan' })
  @ApiNotFoundResponse({ description: 'Access plan not found or unavailable' })
  getAccessPlan(@Param('id') id: string) {
    return this.catalog.getAccessPlan(id);
  }
}
