import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { ResolveRecipientQueryDto } from './dto/partner-grant.dto';
import { PartnerRecipientService } from './partner-recipient.service';

/** Privacy-safe recipient resolution (never cached). */
@ApiTags('Partner — Recipients')
@ApiBearerAuth()
@UseGuards(ServiceAuthGuard, ServiceScopesGuard, PartnerFeatureGuard)
@RequirePartnerFeature(PartnerFeature.API)
@RequireServiceScopes(SERVICE_SCOPE_CENTRAL_READ)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('partner/users')
export class PartnerUsersController {
  constructor(private readonly recipients: PartnerRecipientService) {}

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve a recipient by email or mcomUserId (minimum fields)' })
  @ApiOkResponse({ description: 'Recipient identity + business membership summary' })
  @ApiNotFoundResponse({ description: 'Recipient not found' })
  resolve(@Query() query: ResolveRecipientQueryDto) {
    return this.recipients.resolve(query);
  }
}
