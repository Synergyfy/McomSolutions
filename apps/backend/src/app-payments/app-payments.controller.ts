import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WalletHmacGuard } from '../wallet/guards/wallet-hmac.guard';
import { AppPaymentsService } from './app-payments.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';
import { RefundChargeDto } from './dto/refund-charge.dto';
import { FilterChargesDto } from './dto/filter-charges.dto';
import { AppChargeDto, CreateChargeResponseDto, PaginatedChargesDto } from './dto/responses.dto';

/**
 * MCOM Pay partner endpoints. Any active Console-registered app can charge its
 * customers through MCOM using HMAC-signed server-to-server requests. The app
 * identity comes from `X-Mcom-Client-ID` — never the request body.
 */
@ApiTags('MCOM Pay (Partner)')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Mcom-Client-ID', description: 'Your Console-registered Client ID', required: true })
@ApiHeader({
  name: 'X-Mcom-Signature',
  description: 'sha256=HMAC-SHA256(rawBody, your hmacSecret)',
  required: true,
})
@ApiUnauthorizedResponse({ description: 'Missing/invalid HMAC signature or inactive client' })
@UseGuards(WalletHmacGuard)
@Controller('app-payments')
export class AppPaymentsController {
  constructor(private readonly service: AppPaymentsService) {}

  @Post('charges')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a charge for your app (stripe | paypal | wallet)' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Unique per business event — retries return the original charge',
    required: true,
  })
  @ApiCreatedResponse({ type: CreateChargeResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error or invalid amount' })
  async create(
    @Req() req: any,
    @Body() dto: CreateChargeDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ): Promise<CreateChargeResponseDto> {
    return this.service.createCharge(
      req.partnerClient,
      dto,
      this.requireIdempotencyKey(idempotencyKey),
      req.ip,
    );
  }

  @Post('charges/:id/confirm')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Confirm a charge after the customer completes payment' })
  @ApiOkResponse({ type: AppChargeDto })
  async confirm(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ConfirmChargeDto,
  ) {
    return this.service.confirmCharge(req.partnerClient, id, dto);
  }

  @Post('charges/:id/refund')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Refund a paid charge (full or partial)' })
  @ApiOkResponse({ type: AppChargeDto })
  async refund(@Req() req: any, @Param('id') id: string, @Body() dto: RefundChargeDto) {
    return this.service.refundCharge(req.partnerClient, id, dto);
  }

  @Get('charges')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'List charges this app created' })
  @ApiOkResponse({ type: PaginatedChargesDto })
  async list(@Req() req: any, @Query() filters: FilterChargesDto): Promise<PaginatedChargesDto> {
    return this.service.listCharges(req.partnerClient, filters);
  }

  @Get('charges/:id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a single charge' })
  @ApiOkResponse({ type: AppChargeDto })
  async get(@Req() req: any, @Param('id') id: string): Promise<AppChargeDto> {
    return this.service.getCharge(req.partnerClient, id);
  }

  private requireIdempotencyKey(key?: string): string {
    if (!key || key.trim() === '') {
      throw new BadRequestException(
        'X-Idempotency-Key header is required for charge creation (prevents duplicate charges on retry)',
      );
    }
    return key.trim();
  }
}
