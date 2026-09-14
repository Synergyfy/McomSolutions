import { Controller, Get, Post, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscribeMembershipDto, PurchasePackageDto } from './dto/pricing.dto';

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all active membership plans with bundles and sub-tiers' })
  async getPlans() {
    return this.pricingService.getPlans();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe a business to a membership plan and provision multi-app packages' })
  async subscribe(
    @Request() req: any,
    @Body() dto: SubscribeMembershipDto,
  ) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.pricingService.subscribeMembership(
      req.user.businessId,
      dto.level,
      dto.tier || 'Normal',
      dto.billing || 'monthly',
      !!dto.isTrial,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('packages/purchase')
  @ApiOperation({ summary: 'Purchase a standalone platform package' })
  async purchasePackage(
    @Request() req: any,
    @Body() dto: PurchasePackageDto,
  ) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.pricingService.purchasePackage(req.user.businessId, dto.platform, dto.packageName);
  }

  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getTransactions(@Request() req: any) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.pricingService.getTransactions(req.user.businessId);
  }
}
