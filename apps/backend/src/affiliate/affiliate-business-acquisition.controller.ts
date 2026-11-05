import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffiliateApiKeyGuard } from './guards/affiliate-api-key.guard';
import {
  BusinessAcquisitionService,
  CreateClaimInput,
  CreateInvitationInput,
} from './business-acquisition.service';

/**
 * Business acquisition endpoints used by the 247GBS Affiliates portal.
 *
 * Internal routes are authenticated with the shared affiliate API key. The
 * invitation lookup is public because the invited business opens it before
 * it has an account.
 */
@ApiTags('Affiliate Business Acquisition')
@Controller('affiliate')
export class AffiliateBusinessAcquisitionController {
  constructor(private readonly acquisition: BusinessAcquisitionService) {}

  @Post('business-invitations')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Create a tracked business invitation (backend-to-backend)' })
  async createInvitation(@Body() body: CreateInvitationInput) {
    return { success: true, data: await this.acquisition.createInvitation(body) };
  }

  @Get('business-invitations')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'List business invitations for an affiliate' })
  async listInvitations(@Query('affiliateUserId') affiliateUserId?: string) {
    return { success: true, data: await this.acquisition.listInvitations(affiliateUserId) };
  }

  /** Public: the business resolves its invitation before registering. */
  @Get('business-invitations/token/:token')
  @ApiOperation({ summary: 'Resolve a business invitation token (public)' })
  getInvitation(@Param('token') token: string) {
    return this.acquisition.getInvitationByToken(token);
  }

  @Get('businesses/lookup')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Look up a CHS business by identity before creating a prospect' })
  async lookup(
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
    @Query('postcode') postcode?: string,
  ) {
    return {
      success: true,
      data: await this.acquisition.lookupBusinessByIdentity({ name, email, phone, postcode }),
    };
  }

  @Post('businesses/:businessId/verify')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Verify or reject an acquisition on behalf of a 247GBS administrator' })
  async verify(
    @Param('businessId') businessId: string,
    @Body() body: { decision: 'VERIFIED' | 'REJECTED'; notes?: string; reviewerUserId?: string },
  ) {
    return {
      success: true,
      data: await this.acquisition.verifyAcquisition(
        businessId,
        body.decision,
        body.reviewerUserId || '247gbs-admin',
        body.notes,
      ),
    };
  }

  @Get('businesses/acquired/:affiliateUserId')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Businesses permanently attributed to an affiliate (backend-to-backend)' })
  async acquiredBusinesses(
    @Param('affiliateUserId') affiliateUserId: string,
    @Query('affiliateExternalId') affiliateExternalId?: string,
  ) {
    return {
      success: true,
      data: await this.acquisition.listAcquiredBusinesses({
        affiliateUserId,
        affiliateExternalId,
      }),
    };
  }

  @Get('businesses/acquired-summary/:affiliateUserId')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async acquiredSummary(
    @Param('affiliateUserId') affiliateUserId: string,
    @Query('affiliateExternalId') affiliateExternalId?: string,
  ) {
    return {
      success: true,
      data: await this.acquisition.getAcquisitionSummary({
        affiliateUserId,
        affiliateExternalId,
      }),
    };
  }

  @Get('businesses/:businessId/relationships')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Relationship record and history for a business' })
  async relationships(@Param('businessId') businessId: string) {
    return { success: true, data: await this.acquisition.getRelationships(businessId) };
  }

  @Post('business-claims')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({
    summary: 'Claim an already-registered business (requires administrative verification)',
  })
  async createClaim(@Body() body: CreateClaimInput) {
    return { success: true, data: await this.acquisition.createClaim(body) };
  }

  @Post('business-claims/:id/review')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Approve or reject a claim on behalf of a 247GBS administrator' })
  async reviewClaim(
    @Param('id') id: string,
    @Body()
    body: { decision: 'APPROVED' | 'REJECTED'; notes?: string; reviewerUserId?: string },
  ) {
    return {
      success: true,
      data: await this.acquisition.reviewClaim(
        id,
        body.decision,
        body.reviewerUserId || '247gbs-admin',
        body.notes,
      ),
    };
  }
}
