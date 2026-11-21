import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsoleAdminGuard } from '../console/guards/console-admin.guard';
import { AppPaymentsService } from './app-payments.service';
import { AppPayoutsService } from './app-payouts.service';
import { AdminFilterChargesDto } from './dto/admin-filter-charges.dto';
import { AdminFilterWalletActivityDto } from './dto/admin-filter-wallet-activity.dto';
import { PaginatedChargesDto, RefundListDto } from './dto/responses.dto';
import { ApprovePayoutDto, RejectPayoutDto, RequestPayoutDto } from './dto/payout.dto';

@ApiTags('MCOM Pay (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ConsoleAdminGuard)
@Controller('admin/app-payments')
export class AppPaymentsAdminController {
  constructor(
    private readonly service: AppPaymentsService,
    private readonly payouts: AppPayoutsService,
  ) {}

  @Get('charges')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List all app charges across every registered app' })
  @ApiOkResponse({ type: PaginatedChargesDto })
  async list(@Query() filters: AdminFilterChargesDto) {
    return this.service.listAllCharges(filters);
  }

  @Get('wallet-activity')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Wallet ledger activity (top-ups, affiliate payouts, transfers)',
    description:
      'Money movements recorded in the MCOM wallet ledger that are not AppCharge rows.',
  })
  async walletActivity(@Query() filters: AdminFilterWalletActivityDto) {
    return this.service.listWalletActivity(filters);
  }

  @Get('charges/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a single charge (admin view)' })
  async get(@Param('id') id: string) {
    return this.service.getChargeAsAdmin(id);
  }

  @Get('charges/:id/ledger')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Double-entry ledger rows for a charge' })
  async ledger(@Param('id') id: string) {
    return this.service.getLedgerForCharge(id);
  }

  // ─── Payables & payouts ─────────────────────────────────────────────────

  @Get('payables')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Payable balance per app with pending payouts reserved' })
  async payables() {
    return this.payouts.listPayables();
  }

  @Get('payouts')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List payout requests' })
  async listPayouts(
    @Query('appClientId') appClientId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payouts.list({
      appClientId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('payouts')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a payout of an app payable balance' })
  async requestPayout(
    @Req() req: any,
    @Body() dto: RequestPayoutDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    const key = (idempotencyKey || '').trim() || `payout-request:${dto.appClientId}:${dto.amountMinor}:${Date.now()}`;
    const payout = await this.payouts.request({
      appClientId: dto.appClientId,
      amountMinor: BigInt(dto.amountMinor),
      requestedBy: req.user?.userId ?? null,
      idempotencyKey: key,
      provider: dto.provider ?? null,
      providerRef: dto.providerRef ?? null,
    });
    return { success: true, data: payout };
  }

  @Post('payouts/:id/approve')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Approve and pay a payout request' })
  async approvePayout(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApprovePayoutDto,
  ) {
    const payout = await this.payouts.approve(id, req.user?.userId ?? 'admin', dto.providerRef ?? null);
    return { success: true, data: payout };
  }

  @Post('payouts/:id/reject')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Reject a payout request' })
  async rejectPayout(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RejectPayoutDto,
  ) {
    const payout = await this.payouts.reject(id, req.user?.userId ?? 'admin', dto.reason);
    return { success: true, data: payout };
  }

  @Get('charges/:id/refunds')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Refund attempts for a charge (pending rows need reconciliation)' })
  @ApiOkResponse({ type: RefundListDto })
  async refunds(@Param('id') id: string) {
    return this.service.listRefundsForCharge(id);
  }
}
