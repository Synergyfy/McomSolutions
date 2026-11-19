import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PartnerFeatureGuard } from '../mesh-inbound/partner-feature.guard';
import { RequirePartnerFeature } from '../mesh-inbound/require-partner-feature.decorator';
import { RequireServiceScopes } from '../mesh-inbound/require-service-scopes.decorator';
import { ServiceAuthGuard } from '../mesh-inbound/service-auth.guard';
import { ServiceScopesGuard } from '../mesh-inbound/service-scopes.guard';
import {
  PartnerFeature,
  SERVICE_SCOPE_CENTRAL_ISSUE,
  SERVICE_SCOPE_CENTRAL_READ,
} from '../mesh-inbound/service-mesh.constants';
import { AffiliateConversionService } from './affiliate-conversion.service';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { IngestConversionDto } from './dto/affiliate-partner.dto';

/**
 * Provider → Central surface, called over the zero-hop service mesh with an
 * RS256 token. Disabled routes return 503 FEATURE_DISABLED (never 404), so a
 * provider can tell a rollout state apart from a missing endpoint.
 */
@ApiTags('Partner — Affiliate')
@ApiBearerAuth()
@UseGuards(ServiceAuthGuard, ServiceScopesGuard, PartnerFeatureGuard)
@RequirePartnerFeature(PartnerFeature.AFFILIATE)
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@Controller('partner/affiliate')
export class AffiliatePartnerController {
  constructor(
    private readonly conversions: AffiliateConversionService,
    private readonly tracking: AffiliateTrackingService,
  ) {}

  @Get('attribution/:trackingCode')
  @RequireServiceScopes(SERVICE_SCOPE_CENTRAL_READ)
  @ApiOperation({
    summary: 'Validate a tracking code before checkout',
    description:
      'Returns the internal ids a provider needs to attach the attribution to its own order. Deliberately returns no PII.',
  })
  validateCode(@Param('trackingCode') trackingCode: string) {
    return this.tracking.validateCode(trackingCode);
  }

  @Post('conversions')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireServiceScopes(SERVICE_SCOPE_CENTRAL_ISSUE)
  @ApiOperation({
    summary: 'Report a conversion (order paid, booking completed, refund)',
    description:
      'Idempotent on (provider, providerOrderId, eventType). A replay returns 202 with duplicate=true — never 409, so providers do not retry-storm.',
  })
  ingest(@Body() dto: IngestConversionDto) {
    return this.conversions
      .ingest(dto)
      .then((result) => ({
        success: true,
        data: {
          conversionId: result.conversion?.id ?? null,
          status: result.conversion?.status ?? null,
          duplicate: result.duplicate,
        },
      }));
  }
}
