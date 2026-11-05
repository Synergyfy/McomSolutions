import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BusinessAcquisitionService } from './business-acquisition.service';

@ApiTags('Admin Business Acquisition')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AffiliateBusinessAcquisitionAdminController {
  constructor(private readonly acquisition: BusinessAcquisitionService) {}

  @Get('affiliate-business-invitations')
  @ApiOperation({ summary: 'List tracked business invitations' })
  async listInvitations(@Query('affiliateUserId') affiliateUserId?: string) {
    return { success: true, data: await this.acquisition.listInvitations(affiliateUserId) };
  }

  @Post('affiliate-business-invitations/:id/cancel')
  @ApiOperation({ summary: 'Cancel an unused business invitation' })
  async cancelInvitation(@Param('id') id: string, @Req() req: any) {
    return {
      success: true,
      data: await this.acquisition.cancelInvitation(id, req.user.userId),
    };
  }

  @Get('affiliate-business-claims')
  @ApiOperation({ summary: 'List post-registration acquisition claims' })
  async listClaims(@Query('status') status?: string) {
    return { success: true, data: await this.acquisition.listClaims(status) };
  }

  @Post('affiliate-business-claims/:id/review')
  @ApiOperation({ summary: 'Approve or reject an acquisition claim' })
  async reviewClaim(
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; notes?: string },
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.acquisition.reviewClaim(
        id,
        body.decision,
        req.user.userId,
        body.notes,
      ),
    };
  }

  @Get('affiliate-businesses/:businessId/relationships')
  @ApiOperation({ summary: 'Business acquisition, management and work relationship history' })
  async relationships(@Param('businessId') businessId: string) {
    return { success: true, data: await this.acquisition.getRelationships(businessId) };
  }

  @Post('affiliate-businesses/:businessId/verify-acquisition')
  @ApiOperation({ summary: 'Verify or reject the recorded acquisition source for a business' })
  async verifyAcquisition(
    @Param('businessId') businessId: string,
    @Body() body: { decision: 'VERIFIED' | 'REJECTED'; notes?: string },
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.acquisition.verifyAcquisition(
        businessId,
        body.decision,
        req.user.userId,
        body.notes,
      ),
    };
  }
}
