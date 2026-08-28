import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TransactionCategory } from '@prisma/client';
import { WalletHmacGuard } from './guards/wallet-hmac.guard';
import { WalletService } from './wallet.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { DebitWalletDto } from './dto/debit-wallet.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';
import { CaptureHoldDto, PlaceHoldDto, ReleaseHoldDto } from './dto/wallet-operations.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { TransactionReceiptDto, WalletBalanceDto } from './dto/responses.dto';

/**
 * Partner app endpoints. Any active Console-registered app (MCOM Mall, Rewards,
 * Spin, VemTap, 247GBS, Expo, ...) can call these with HMAC-signed requests.
 * The platform identity is taken from the X-Mcom-Client-ID header — never the body.
 */
@ApiTags('Wallet (Partner)')
@ApiHeader({ name: 'X-Mcom-Client-ID', description: 'Your Console-registered Client ID', required: true })
@ApiHeader({
  name: 'X-Mcom-Signature',
  description: 'sha256=HMAC-SHA256(rawBody, your hmacSecret)',
  required: true,
})
@ApiUnauthorizedResponse({ description: 'Missing/invalid HMAC signature or inactive client' })
@ApiUnprocessableEntityResponse({ description: 'INSUFFICIENT_BALANCE / DAILY_LIMIT_EXCEEDED' })
@UseGuards(WalletHmacGuard)
@Controller('wallet/partner')
export class WalletPartnerController {
  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: WalletLedgerService,
  ) {}

  @Post('debit')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Debit a user wallet (subscription, purchase, fee)' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Unique per business event — retries return the original result',
    required: true,
  })
  async debit(
    @Req() req: any,
    @Body() dto: DebitWalletDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ): Promise<TransactionReceiptDto> {
    const partner = await this.walletService.resolvePartner(req.partnerClient.clientId);
    return this.walletService.debitWallet(partner, dto, this.requireIdempotencyKey(idempotencyKey), req.ip);
  }

  @Post('credit')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Credit a user wallet (reward, refund, cashback)' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Unique per business event — retries return the original result',
    required: true,
  })
  async credit(
    @Req() req: any,
    @Body() dto: CreditWalletDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ): Promise<TransactionReceiptDto> {
    const partner = await this.walletService.resolvePartner(req.partnerClient.clientId);
    return this.walletService.creditWallet(partner, dto, this.requireIdempotencyKey(idempotencyKey), req.ip);
  }

  @Post('hold/place')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Reserve funds (pre-authorization) before confirming a debit' })
  async placeHold(@Req() req: any, @Body() dto: PlaceHoldDto) {
    const partner = await this.walletService.resolvePartner(req.partnerClient.clientId);
    return this.walletService.placeHold(partner, dto);
  }

  @Post('hold/capture')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Convert a hold into a real debit' })
  async captureHold(
    @Req() req: any,
    @Body() dto: CaptureHoldDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const partner = await this.walletService.resolvePartner(req.partnerClient.clientId);
    return this.walletService.captureHold(
      partner,
      dto.holdId,
      dto.category ?? TransactionCategory.HOLD_CAPTURE,
      idempotencyKey,
      req.ip,
    );
  }

  @Post('hold/release')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Release a hold back to the available balance' })
  async releaseHold(@Req() req: any, @Body() dto: ReleaseHoldDto) {
    const partner = await this.walletService.resolvePartner(req.partnerClient.clientId);
    return this.walletService.releaseHold(partner, dto.holdId);
  }

  @Get('balance/:userId')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Check a user wallet balance (cached 30s)' })
  async getBalance(@Req() req: any, @Param('userId') userId: string): Promise<WalletBalanceDto> {
    const partner = await this.walletService.resolvePartner(req.partnerClient.clientId);
    return this.walletService.getBalanceForPartner(partner, userId);
  }

  @Get('transactions/:userId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List transactions THIS platform originated for a user (scoped)' })
  async getTransactions(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query() filters: FilterTransactionsDto,
  ) {
    const partner = await this.walletService.resolvePartner(req.partnerClient.clientId);
    const wallet = await this.walletService.ensureWallet(userId);
    return this.ledgerService.getTransactions(wallet.id, filters, partner.clientId);
  }

  @Get('transaction/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Look up a transaction by ID or idempotencyKey (scoped to this platform)' })
  async getTransaction(
    @Req() req: any,
    @Param('id') id: string,
    @Query('by') by: 'id' | 'idempotencyKey' = 'id',
  ) {
    const partnerClientId = req.partnerClient.clientId;
    const txn =
      by === 'idempotencyKey'
        ? await this.ledgerService.getTransactionByIdempotencyKey(id)
        : await this.ledgerService.getTransactionById(id);
    // Partner data isolation — a platform can only read transactions it originated.
    if (txn.platformClientId !== partnerClientId) {
      throw new ForbiddenException('Transaction does not belong to this platform');
    }
    return txn;
  }

  private requireIdempotencyKey(key?: string): string {
    if (!key || key.trim() === '') {
      throw new BadRequestException(
        'X-Idempotency-Key header is required for wallet mutations (prevents duplicate charges on retry)',
      );
    }
    return key.trim();
  }
}