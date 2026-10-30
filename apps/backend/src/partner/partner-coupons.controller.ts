import {
  Body,
  Controller,
  Get,
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
  ApiNotFoundResponse,
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
  SERVICE_SCOPE_CENTRAL_READ,
} from '../mesh-inbound/service-mesh.constants';
import { CreatePartnerCouponDto } from './dto/partner-coupon.dto';
import { PartnerCouponService } from './partner-coupon.service';

/**
 * Partner coupon surface. Central coupons apply to MCOM memberships/access
 * passes only — never Mall goods.
 */
@ApiTags('Partner — Coupons')
@ApiBearerAuth()
@UseGuards(ServiceAuthGuard, ServiceScopesGuard, PartnerFeatureGuard)
@RequirePartnerFeature(PartnerFeature.API, PartnerFeature.COUPONS)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('partner/coupons')
export class PartnerCouponsController {
  constructor(private readonly coupons: PartnerCouponService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequireServiceScopes(SERVICE_SCOPE_CENTRAL_ISSUE)
  @ApiOperation({ summary: 'Create a partner coupon locked to a recipient (idempotent)' })
  @ApiCreatedResponse({ description: 'Coupon created (or replayed)' })
  @ApiConflictResponse({ description: 'CODE_ALREADY_EXISTS' })
  @ApiUnprocessableEntityResponse({ description: 'LOCKED_USER_NOT_FOUND' })
  create(@Body() dto: CreatePartnerCouponDto, @Req() req: Request) {
    return this.coupons.create(dto, req.serviceCaller!);
  }

  @Get(':code')
  @RequireServiceScopes(SERVICE_SCOPE_CENTRAL_READ)
  @ApiOperation({ summary: 'Inspect a partner coupon (status, uses, lock)' })
  @ApiOkResponse({ description: 'Coupon state' })
  @ApiNotFoundResponse({ description: 'COUPON_NOT_FOUND' })
  inspect(@Param('code') code: string, @Req() req: Request) {
    return this.coupons.inspect(code, req.serviceCaller!);
  }

  @Post(':code/revoke')
  @HttpCode(HttpStatus.OK)
  @RequireServiceScopes(SERVICE_SCOPE_CENTRAL_ISSUE)
  @ApiOperation({ summary: 'Revoke an unused partner coupon' })
  @ApiOkResponse({ description: 'Coupon revoked' })
  @ApiConflictResponse({ description: 'COUPON_ALREADY_REDEEMED' })
  revoke(@Param('code') code: string, @Req() req: Request) {
    return this.coupons.revoke(code, req.serviceCaller!);
  }
}
