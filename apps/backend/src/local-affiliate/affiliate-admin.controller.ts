import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffiliateOfferStatus, AffiliateCampaignStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { LocalAffiliateService } from './local-affiliate.service';
import { AffiliateAdminService } from './affiliate-admin.service';
import { AffiliateRedemptionService } from './affiliate-redemption.service';
import { AffiliateConversionService } from './affiliate-conversion.service';
import {
  AdminPageQueryDto,
  AttributeConversionDto,
  ConversionActionDto,
  ConversionQueryDto,
  CreateCampaignDto,
  CreateExternalBusinessDto,
  CreateOfferDto,
  CreateProviderAccountDto,
  CreateProviderDto,
  CreateRewardRuleDto,
  IssueVoucherDto,
  ReconciliationQueryDto,
  UpdateOfferDto,
  UpdateProviderDto,
} from './dto/affiliate-admin.dto';

@ApiTags('Admin — Local Affiliates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AffiliateAdminController {
  constructor(
    private readonly affiliates: LocalAffiliateService,
    private readonly admin: AffiliateAdminService,
    private readonly redemptions: AffiliateRedemptionService,
    private readonly conversions: AffiliateConversionService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Affiliates ─────────────────────────────────────────────────────────

  @Get('local-affiliates')
  @ApiOperation({ summary: 'List Local Affiliate profiles' })
  listAffiliates(@Query() query: AdminPageQueryDto) {
    return this.affiliates.adminList(query);
  }

  @Get('local-affiliates/:id')
  @ApiOperation({ summary: 'Affiliate detail: profile, balances, ledger, conversions' })
  affiliateDetail(@Param('id') id: string) {
    return this.affiliates.adminDetail(id);
  }

  @Post('local-affiliates/:id/suspend')
  @ApiOperation({ summary: 'Suspend an affiliate' })
  suspend(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.affiliates.setStatus(id, 'SUSPENDED', body?.reason);
  }

  @Post('local-affiliates/:id/reinstate')
  @ApiOperation({ summary: 'Reinstate a suspended affiliate' })
  reinstate(@Param('id') id: string) {
    return this.affiliates.setStatus(id, 'ACTIVE');
  }

  @Post('local-affiliates/:id/close')
  @ApiOperation({ summary: 'Close an affiliate account' })
  close(@Param('id') id: string) {
    return this.affiliates.setStatus(id, 'CLOSED');
  }

  // ── Providers ──────────────────────────────────────────────────────────

  @Get('affiliate-providers')
  @ApiOperation({ summary: 'List providers (credentials are never returned)' })
  listProviders() {
    return this.admin.listProviders();
  }

  @Post('affiliate-providers')
  @ApiOperation({ summary: 'Create a provider record' })
  createProvider(@Body() dto: CreateProviderDto) {
    return this.admin.createProvider(dto);
  }

  @Patch('affiliate-providers/:id')
  @ApiOperation({ summary: 'Update a provider' })
  updateProvider(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.admin.updateProvider(id, dto);
  }

  @Post('affiliate-providers/:id/test')
  @ApiOperation({ summary: 'Structural connection check (no external calls in this release)' })
  testProvider(@Param('id') id: string) {
    return this.admin.testProvider(id);
  }

  @Post('affiliate-providers/:id/accounts')
  @ApiOperation({ summary: 'Add a provider account; credentials are encrypted at rest' })
  createAccount(
    @Param('id') id: string,
    @Body() dto: CreateProviderAccountDto,
  ) {
    return this.admin.createProviderAccount(id, dto);
  }

  @Post('affiliate-providers/:id/sync')
  @ApiOperation({ summary: 'Trigger a provider sync (pull adapters only)' })
  syncProvider(@Param('id') id: string) {
    void id;
    return this.admin.syncProvider();
  }

  // ── External businesses ────────────────────────────────────────────────

  @Get('external-businesses')
  @ApiOperation({ summary: 'List external businesses' })
  listExternalBusinesses(@Query() query: AdminPageQueryDto) {
    return this.admin.listExternalBusinesses(query);
  }

  @Post('external-businesses')
  @ApiOperation({ summary: 'Register an external business' })
  createExternalBusiness(@Body() dto: CreateExternalBusinessDto, @Req() req: any) {
    return this.admin.createExternalBusiness(dto, req.user.userId);
  }

  @Post('external-businesses/:id/verify')
  @ApiOperation({ summary: 'Mark an external business verified' })
  verifyExternalBusiness(@Param('id') id: string, @Req() req: any) {
    return this.admin.verifyExternalBusiness(id, req.user.userId);
  }

  // ── Reward rules ───────────────────────────────────────────────────────

  @Get('affiliate-reward-rules')
  @ApiOperation({ summary: 'List reward rule versions (newest first)' })
  listRewardRules() {
    return this.admin.listRewardRules();
  }

  @Post('affiliate-reward-rules')
  @ApiOperation({
    summary: 'Publish a new immutable reward-rule version',
    description:
      'Existing conversions keep pointing at the version that was current when they happened.',
  })
  createRewardRule(@Body() dto: CreateRewardRuleDto, @Req() req: any) {
    return this.admin.createRewardRule(dto, req.user.userId);
  }

  @Get('affiliate-reward-rules/:id/preview')
  @ApiOperation({ summary: 'Preview a rule against a basket amount (minor units)' })
  previewRule(@Param('id') id: string, @Query('amountMinor') amountMinor?: string) {
    return this.admin.previewRule(id, Number(amountMinor) || 0);
  }

  // ── Offers ─────────────────────────────────────────────────────────────

  @Get('affiliate-offers')
  @ApiOperation({ summary: 'List offers (all statuses)' })
  listOffers(@Query() query: AdminPageQueryDto) {
    return this.admin.listOffersAdmin(query);
  }

  @Post('affiliate-offers')
  @ApiOperation({
    summary: 'Create an offer',
    description:
      'Rejected with REWARD_EVENT_NOT_VERIFIABLE when the reward rule references an event the provider integration cannot confirm.',
  })
  createOffer(@Body() dto: CreateOfferDto, @Req() req: any) {
    return this.admin.createOffer(dto, req.user.userId);
  }

  @Patch('affiliate-offers/:id')
  @ApiOperation({ summary: 'Update an offer' })
  updateOffer(@Param('id') id: string, @Body() dto: UpdateOfferDto) {
    return this.admin.updateOffer(id, dto);
  }

  @Post('affiliate-offers/:id/approve')
  @ApiOperation({ summary: 'Approve and publish an offer' })
  approveOffer(@Param('id') id: string, @Req() req: any) {
    return this.admin.approveOffer(id, req.user.userId);
  }

  @Post('affiliate-offers/:id/pause')
  @ApiOperation({ summary: 'Pause an offer' })
  pauseOffer(@Param('id') id: string) {
    return this.admin.setOfferStatus(id, AffiliateOfferStatus.PAUSED);
  }

  @Post('affiliate-offers/:id/end')
  @ApiOperation({ summary: 'End an offer' })
  endOffer(@Param('id') id: string) {
    return this.admin.setOfferStatus(id, AffiliateOfferStatus.ENDED);
  }

  // ── Campaigns ──────────────────────────────────────────────────────────

  @Get('affiliate-campaigns')
  @ApiOperation({ summary: 'List affiliate campaigns' })
  listCampaigns() {
    return this.admin.listCampaigns();
  }

  @Post('affiliate-campaigns')
  @ApiOperation({ summary: 'Create a campaign (optionally with offers)' })
  createCampaign(@Body() dto: CreateCampaignDto, @Req() req: any) {
    return this.admin.createCampaign(dto, req.user.userId);
  }

  @Post('affiliate-campaigns/:id/pause')
  @ApiOperation({ summary: 'Pause a campaign' })
  pauseCampaign(@Param('id') id: string) {
    return this.admin.updateCampaignStatus(id, AffiliateCampaignStatus.PAUSED);
  }

  @Post('affiliate-campaigns/:id/end')
  @ApiOperation({ summary: 'End a campaign' })
  endCampaign(@Param('id') id: string) {
    return this.admin.updateCampaignStatus(id, AffiliateCampaignStatus.ENDED);
  }

  // ── Conversions ────────────────────────────────────────────────────────

  @Get('affiliate-conversions')
  @ApiOperation({ summary: 'List conversions with attribution and ledger' })
  listConversions(@Query() query: ConversionQueryDto) {
    return this.admin.listConversions(query);
  }

  @Post('affiliate-conversions/:id/approve')
  @ApiOperation({ summary: 'Approve the pending reward(s) for a conversion' })
  async approveConversion(
    @Param('id') id: string,
    @Body() dto: ConversionActionDto,
    @Req() req: any,
  ) {
    const result = await this.conversions.approveConversion(
      id,
      req.user.userId,
      dto.reason,
    );
    await this.audit(req, 'AFFILIATE_CONVERSION_APPROVED', 'conversion', id, dto.reason);
    return result;
  }

  @Post('affiliate-conversions/:id/reject')
  @ApiOperation({ summary: 'Reject a conversion and its reward(s)' })
  async rejectConversion(
    @Param('id') id: string,
    @Body() dto: ConversionActionDto,
    @Req() req: any,
  ) {
    const result = await this.conversions.rejectConversion(
      id,
      req.user.userId,
      dto.reasonCode ?? 'NOT_ELIGIBLE',
      dto.reason,
    );
    await this.audit(req, 'AFFILIATE_CONVERSION_REJECTED', 'conversion', id, dto.reason);
    return result;
  }

  @Post('affiliate-conversions/:id/reverse')
  @ApiOperation({ summary: 'Reverse a conversion (refund/cancellation)' })
  async reverseConversion(
    @Param('id') id: string,
    @Body() dto: ConversionActionDto,
    @Req() req: any,
  ) {
    const result = await this.conversions.reverseConversion(
      id,
      req.user.userId,
      dto.reasonCode ?? 'REFUNDED',
    );
    await this.audit(req, 'AFFILIATE_CONVERSION_REVERSED', 'conversion', id, dto.reason);
    return result;
  }

  @Post('affiliate-conversions/:id/attribute')
  @ApiOperation({ summary: 'Attribute a conversion manually' })
  async attributeConversion(
    @Param('id') id: string,
    @Body() dto: AttributeConversionDto,
    @Req() req: any,
  ) {
    const result = await this.conversions.adminAttribute(
      id,
      dto.trackingCode,
      req.user.userId,
      dto.reason,
    );
    await this.audit(req, 'AFFILIATE_CONVERSION_ATTRIBUTED', 'conversion', id, dto.reason);
    return result;
  }

  // ── Vouchers & redemptions ─────────────────────────────────────────────

  @Get('affiliate-vouchers')
  @ApiOperation({ summary: 'List vouchers' })
  listVouchers(@Query() query: AdminPageQueryDto) {
    return this.redemptions.listVouchers(query);
  }

  @Post('affiliate-vouchers')
  @ApiOperation({ summary: 'Issue a voucher' })
  issueVoucher(@Body() dto: IssueVoucherDto) {
    return this.redemptions.issueVoucher(dto);
  }

  @Post('affiliate-vouchers/:id/revoke')
  @ApiOperation({ summary: 'Revoke a voucher' })
  revokeVoucher(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.redemptions.revokeVoucher(id, body?.reason);
  }

  @Get('affiliate-redemptions')
  @ApiOperation({ summary: 'List redemptions across all businesses' })
  listRedemptions(@Query() query: AdminPageQueryDto) {
    return this.redemptions.listRedemptions(query);
  }

  // ── Reconciliation & reports ───────────────────────────────────────────

  @Get('affiliate-reconciliation')
  @ApiOperation({ summary: 'Reconciliation queues (unmatched, duplicates, failures, negative balances)' })
  reconciliation(@Query() query: ReconciliationQueryDto) {
    return this.admin.reconciliation(query);
  }

  @Get('affiliate-reports/overview')
  @ApiOperation({ summary: 'Programme overview: totals, provider split, statuses' })
  reportOverview() {
    return this.admin.reportOverview();
  }

  // ── Audit helper ───────────────────────────────────────────────────────

  private async audit(
    req: any,
    action: string,
    targetType: string,
    targetName: string,
    details?: string,
  ) {
    await this.prisma.auditLog
      .create({
        data: {
          action,
          adminName: req.user?.email ?? req.user?.userId ?? 'admin',
          targetType,
          targetName,
          details: details ?? '',
          category: 'LOCAL_AFFILIATE',
        },
      })
      .catch(() => undefined);
  }
}
