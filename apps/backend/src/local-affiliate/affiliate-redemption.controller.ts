import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BusinessOrApiKeyGuard } from './guards/affiliate-auth.guards';
import { AffiliateRedemptionService } from './affiliate-redemption.service';
import {
  ReverseRedemptionDto,
  ValidateVoucherDto,
} from './dto/affiliate-redemption.dto';
import { AdminPageQueryDto } from './dto/affiliate-admin.dto';

/**
 * Business-facing voucher validation.
 *
 * Accepts either a business JWT (owner/staff in the dashboard) or an
 * `x-api-key` header (a POS or the business's own backend). Both paths resolve
 * to `req.businessActor`, and a business can only validate its own offers.
 */
@ApiTags('Affiliate Redemptions')
@ApiBearerAuth()
@ApiHeader({ name: 'x-api-key', required: false, description: 'Business API key (alternative to Bearer)' })
@Controller('affiliate-redemptions')
@UseGuards(BusinessOrApiKeyGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class AffiliateRedemptionController {
  constructor(private readonly redemptions: AffiliateRedemptionService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a voucher presented by a referred customer',
    description:
      'Idempotent per (voucher, customer): a repeat presentation returns ALREADY_REDEEMED with the original timestamp rather than an error.',
  })
  validate(@Body() dto: ValidateVoucherDto, @Req() req: any) {
    const actor = req.businessActor ?? {};
    return this.redemptions.validate(dto, {
      userId: actor.userId ?? req.user?.userId ?? null,
      businessId: actor.businessId ?? null,
      channel: dto.channel ?? (actor.via === 'api-key' ? 'API' : 'ONLINE'),
      ip: req.ip,
    });
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reverse a redemption inside the allowed window' })
  reverse(
    @Param('id') id: string,
    @Body() dto: ReverseRedemptionDto,
    @Req() req: any,
  ) {
    const actor = req.businessActor ?? {};
    return this.redemptions.reverse(id, {
      userId: req.user?.userId ?? null,
      businessId: actor.businessId ?? null,
      channel: 'MANUAL',
      ip: req.ip,
    }, dto.reason);
  }

  @Get()
  @ApiOperation({ summary: 'Redemptions for my business' })
  list(@Query() query: AdminPageQueryDto, @Req() req: any) {
    return this.redemptions.listRedemptions({
      ...query,
      businessId: req.businessActor?.businessId ?? null,
    });
  }
}
