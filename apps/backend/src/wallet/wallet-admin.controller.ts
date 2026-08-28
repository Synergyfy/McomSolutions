import { Controller, Get, Patch, Post, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsoleAdminGuard } from '../console/guards/console-admin.guard';
import { WalletAdminService } from './wallet-admin.service';
import { FilterTransactionsDto, AdminWalletQueryDto } from './dto/filter-transactions.dto';
import {
  AdminAdjustWalletDto,
  AdminWalletActionDto,
  AdminWalletLimitsDto,
  ReverseTransactionDto,
} from './dto/admin-wallet.dto';

@ApiTags('Wallet (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ConsoleAdminGuard, ThrottlerGuard)
@Controller('wallet/admin')
export class WalletAdminController {
  constructor(private readonly adminService: WalletAdminService) {}

  @Get('wallets')
  @ApiOperation({ summary: 'List all wallets (search, status filter, paginated)' })
  async listWallets(@Query() query: AdminWalletQueryDto) {
    return this.adminService.listWallets(query);
  }

  @Get('wallets/:walletId')
  @ApiOperation({ summary: 'Wallet detail with available balance and active holds' })
  async getWallet(@Param('walletId') walletId: string) {
    return this.adminService.getWalletDetail(walletId);
  }

  @Get('wallets/user/:userId')
  @ApiOperation({ summary: 'Get wallet by user ID' })
  async getWalletByUser(@Param('userId') userId: string) {
    return this.adminService.getWalletByUser(userId);
  }

  @Patch('wallets/:walletId/freeze')
  @ApiOperation({ summary: 'Freeze a wallet (mandatory reason)' })
  async freeze(@Req() req: any, @Param('walletId') walletId: string, @Body() dto: AdminWalletActionDto) {
    return this.adminService.setWalletStatus(walletId, 'freeze', req.user.userId, dto, req);
  }

  @Patch('wallets/:walletId/unfreeze')
  @ApiOperation({ summary: 'Unfreeze a wallet (mandatory reason)' })
  async unfreeze(@Req() req: any, @Param('walletId') walletId: string, @Body() dto: AdminWalletActionDto) {
    return this.adminService.setWalletStatus(walletId, 'unfreeze', req.user.userId, dto, req);
  }

  @Patch('wallets/:walletId/close')
  @ApiOperation({ summary: 'Close a wallet permanently (mandatory reason)' })
  async close(@Req() req: any, @Param('walletId') walletId: string, @Body() dto: AdminWalletActionDto) {
    return this.adminService.setWalletStatus(walletId, 'close', req.user.userId, dto, req);
  }

  @Post('wallets/:walletId/credit')
  @ApiOperation({ summary: 'Manual credit (adjustment) — audited' })
  async credit(@Req() req: any, @Param('walletId') walletId: string, @Body() dto: AdminAdjustWalletDto) {
    return this.adminService.manualCredit(walletId, req.user.userId, dto, req);
  }

  @Post('wallets/:walletId/debit')
  @ApiOperation({ summary: 'Manual debit (adjustment) — audited' })
  async debit(@Req() req: any, @Param('walletId') walletId: string, @Body() dto: AdminAdjustWalletDto) {
    return this.adminService.manualDebit(walletId, req.user.userId, dto, req);
  }

  @Patch('wallets/:walletId/limits')
  @ApiOperation({ summary: 'Set daily/monthly debit limits and max balance' })
  async setLimits(@Req() req: any, @Param('walletId') walletId: string, @Body() dto: AdminWalletLimitsDto) {
    return this.adminService.setLimits(walletId, req.user.userId, dto, req);
  }

  @Get('wallets/:walletId/transactions')
  @ApiOperation({ summary: 'Full transaction history for a wallet' })
  async getTransactions(@Param('walletId') walletId: string, @Query() filters: FilterTransactionsDto) {
    return this.adminService.listAdminTransactions(walletId, filters);
  }

  @Post('transactions/:id/reverse')
  @ApiOperation({ summary: 'Reverse a transaction via a compensating entry (never edits the original)' })
  async reverse(@Req() req: any, @Param('id') id: string, @Body() dto: ReverseTransactionDto) {
    return this.adminService.reverseTransaction(id, req.user.userId, dto, req);
  }

  @Get('reports/platform-summary')
  @ApiOperation({ summary: 'Credit/debit volume grouped by platform' })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  async platformSummary(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.adminService.getPlatformSummary(dateFrom, dateTo);
  }

  @Get('reports/daily-volume')
  @ApiOperation({ summary: 'Day-by-day credit/debit volume' })
  async dailyVolume(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.adminService.getDailyVolume(dateFrom, dateTo);
  }

  @Get('reports/reconciliation')
  @ApiOperation({ summary: 'Balance vs ledger reconciliation — detects any drift' })
  async reconciliation() {
    return this.adminService.getReconciliationReport();
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Admin wallet action audit log' })
  async auditLog(
    @Query('walletId') walletId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.listAuditLogs(walletId, Number(page), Number(limit));
  }
}