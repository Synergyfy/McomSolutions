import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsoleAdminGuard } from '../console/guards/console-admin.guard';
import { LedgerQueryService } from './ledger-query.service';
import { LedgerAnalyticsService } from './ledger-analytics.service';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { AccountsQueryDto, AnalyticsQueryDto, EventQueryDto, TransferQueryDto } from './dto/ledger-admin-query.dto';

/**
 * Read-only admin surface for the central ledger.
 *
 * Deliberately exposes no mutation: the journal is append-only, and corrections
 * are reversing transfers, not edits.
 */
@ApiTags('Central Ledger (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ConsoleAdminGuard)
@Controller('admin/mcom-pay')
export class LedgerAdminController {
  constructor(
    private readonly query: LedgerQueryService,
    private readonly analytics: LedgerAnalyticsService,
    private readonly reconciliation: LedgerReconciliationService,
  ) {}

  @Get('overview')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Platform wallet, float, payables, 30-day flow and GMV' })
  @ApiOkResponse()
  async overview() {
    return this.query.overview();
  }

  @Get('platform-wallet')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: "The platform's own wallet: balance and lifetime flow" })
  async platformWallet() {
    return this.query.platformWallet();
  }

  @Get('platform-wallet/activity')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Platform wallet movements grouped by business event (in, allocation out, fee kept)',
  })
  async platformActivity(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.query.platformActivity(page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('platform-wallet/transactions')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: "Ledger entries for the platform's wallet" })
  async platformWalletEntries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.query.accountEntries(
      'platform:wallet:GBP',
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('accounts')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Chart of accounts with live balances' })
  async accounts(@Query() filters: AccountsQueryDto) {
    return this.query.listAccounts(filters);
  }

  @Get('accounts/:code/entries')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Entries for one account' })
  async accountEntries(
    @Param('code') code: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.query.accountEntries(code, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('platforms')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Platforms seen in the ledger, for filtering' })
  async platforms() {
    return this.query.platforms();
  }

  @Get('events')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'The ledger, one row per money event: who was debited and who was credited',
  })
  async events(@Query() filters: EventQueryDto) {
    return this.query.listEvents({
      page: filters.page,
      limit: filters.limit,
      platformId: filters.platformId,
      intent: filters.intent,
      search: filters.search,
      from: filters.dateFrom,
      to: filters.dateTo,
    });
  }

  @Get('events/:key')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Full detail for one event: parties, charge, splits, receipts and journal steps',
  })
  async event(@Param('key') key: string) {
    return this.query.getEvent(key);
  }

  @Get('transfers')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Ledger transfers (one row per business event)' })
  async transfers(@Query() filters: TransferQueryDto) {
    return this.query.listTransfers(filters);
  }

  @Get('transfers/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Full money trail for a transfer, including sibling transfers sharing a reference',
  })
  async transfer(@Param('id') id: string) {
    return this.query.getTransfer(id);
  }

  // ─── Analytics ───────────────────────────────────────────────────────────

  @Get('analytics/trend')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Volume, transfer count and platform flow per day, week or month',
  })
  async analyticsTrend(@Query() filters: AnalyticsQueryDto) {
    return this.analytics.trend(filters);
  }

  @Post('analytics/rebuild')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Rebuild the rollups behind the analytics charts' })
  async rebuildAnalytics(@Query('days') days?: string) {
    return this.analytics.rebuildRecent(days ? Number(days) : 90);
  }

  @Get('analytics/by-platform')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Volume, transfers and platform flow per ecosystem app' })
  async analyticsByPlatform(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.byPlatform(from, to);
  }

  @Get('analytics/by-intent')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Volume and share per business intent' })
  async analyticsByIntent(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.byIntent(from, to);
  }

  @Get('reconciliation')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Journal vs wallets vs balance-sheet identity' })
  async reconciliationReport() {
    return this.reconciliation.getReport();
  }

  @Get('reconciliation/shadow')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Charges vs journal shadow comparison' })
  async shadow() {
    return this.reconciliation.shadowCompare();
  }
}
