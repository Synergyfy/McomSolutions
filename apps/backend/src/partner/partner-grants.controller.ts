import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PartnerFeatureGuard } from '../mesh-inbound/partner-feature.guard';
import { RequirePartnerFeature } from '../mesh-inbound/require-partner-feature.decorator';
import { RequireServiceScopes } from '../mesh-inbound/require-service-scopes.decorator';
import { ServiceAuthGuard } from '../mesh-inbound/service-auth.guard';
import { ServiceScopesGuard } from '../mesh-inbound/service-scopes.guard';
import {
  PartnerFeature,
  SERVICE_SCOPE_CENTRAL_ISSUE,
} from '../mesh-inbound/service-mesh.constants';
import { GrantMembershipDto, IssueAccessPassCodeDto } from './dto/partner-grant.dto';
import { PartnerGrantService } from './partner-grant.service';

/** Partner grant commands (membership, access-pass code, revocation). */
@ApiTags('Partner — Grants')
@ApiBearerAuth()
@UseGuards(ServiceAuthGuard, ServiceScopesGuard, PartnerFeatureGuard)
@RequirePartnerFeature(PartnerFeature.API, PartnerFeature.GRANTS)
@RequireServiceScopes(SERVICE_SCOPE_CENTRAL_ISSUE)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('partner')
export class PartnerGrantsController {
  constructor(private readonly grants: PartnerGrantService) {}

  @Post('grants/membership')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant a membership to a business recipient (idempotent)' })
  @ApiCreatedResponse({ description: 'Membership granted (or replayed)' })
  @ApiConflictResponse({ description: 'MEMBERSHIP_CONFLICT' })
  @ApiUnprocessableEntityResponse({ description: 'Recipient/plan/tier/duration not applicable' })
  grantMembership(@Body() dto: GrantMembershipDto, @Req() req: Request) {
    return this.grants.grantMembership(dto, req.serviceCaller!);
  }

  @Post('access-pass-codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue an access-pass code in UNUSED state (idempotent)' })
  @ApiCreatedResponse({ description: 'Code issued (or replayed)' })
  issueAccessCode(@Body() dto: IssueAccessPassCodeDto, @Req() req: Request) {
    return this.grants.issueAccessPassCode(dto, req.serviceCaller!);
  }

  @Post('grants/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a zero-amount membership grant or an unused code' })
  @ApiConflictResponse({ description: 'GRANT_NOT_REVOCABLE' })
  revokeGrant(@Param('id') id: string, @Req() req: Request) {
    return this.grants.revokeGrant(id, req.serviceCaller!);
  }
}
