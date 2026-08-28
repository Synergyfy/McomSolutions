import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletTopUpService } from './wallet-topup.service';
import { FilterTransactionsDto, WalletSummaryQueryDto } from './dto/filter-transactions.dto';
import { TopUpInitiateDto } from './dto/wallet-operations.dto';
import {
  PaginatedWalletTransactionsDto,
  TransactionReceiptDto,
  WalletDto,
  WalletSummaryDto,
  WalletTopUpInitiateDto,
} from './dto/responses.dto';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: WalletLedgerService,
    private readonly topUpService: WalletTopUpService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get my wallet (balance, available, status)' })
  @ApiOkResponse({ type: WalletDto })
  async getMyWallet(@Req() req: any): Promise<WalletDto> {
    return this.walletService.getWalletForUser(req.user.userId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List my transactions with composable filters' })
  @ApiOkResponse({ type: PaginatedWalletTransactionsDto })
  async getMyTransactions(
    @Req() req: any,
    @Query() filters: FilterTransactionsDto,
  ): Promise<PaginatedWalletTransactionsDto> {
    const wallet = await this.walletService.ensureWallet(req.user.userId);
    return this.ledgerService.getTransactions(wallet.id, filters);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiOkResponse({ type: TransactionReceiptDto })
  @ApiNotFoundResponse()
  async getTransaction(@Req() req: any, @Param('id') id: string) {
    return this.ledgerService.getTransactionById(id);
  }

  @Post('topup/initiate')
  @ApiOperation({ summary: 'Start a wallet top-up → returns Stripe Checkout URL' })
  @ApiCreatedResponse({ type: WalletTopUpInitiateDto })
  async initiateTopUp(@Req() req: any, @Body() dto: TopUpInitiateDto) {
    return this.topUpService.initiateTopUp(req.user.userId, dto);
  }

  @Get('topup/history')
  @ApiOperation({ summary: 'List my top-up request history' })
  async getTopUpHistory(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.topUpService.listTopUpHistory(req.user.userId, Number(page), Number(limit));
  }

  @Get('holds')
  @ApiOperation({ summary: 'List my active holds' })
  async getHolds(@Req() req: any) {
    const wallet = await this.walletService.ensureWallet(req.user.userId);
    const holds = await this.ledgerService.getActiveHolds(wallet.id);
    return {
      success: true,
      data: holds.map((h) => ({
        id: h.id,
        amount: h.amount.toNumber(),
        platformClientId: h.platformClientId,
        platformName: h.platformName,
        reference: h.reference,
        status: h.status,
        expiresAt: h.expiresAt.toISOString(),
      })),
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Spending breakdown by platform and category for a period' })
  @ApiQuery({ name: 'period', enum: ['30d', '90d', '1y'], required: false })
  @ApiOkResponse({ type: WalletSummaryDto })
  async getSummary(@Req() req: any, @Query() query: WalletSummaryQueryDto) {
    return this.ledgerService.getWalletSummary(req.user.userId, query.period);
  }
}