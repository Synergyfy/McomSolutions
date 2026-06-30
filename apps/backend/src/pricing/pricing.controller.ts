import { Controller, Get, Post, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pricing')
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Get('plans')
  async getPlans() {
    return this.pricingService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(
    @Request() req: any,
    @Body('level') level: string,
    @Body('tier') tier: string,
  ) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.pricingService.subscribeMembership(req.user.businessId, level, tier);
  }

  @UseGuards(JwtAuthGuard)
  @Post('packages/purchase')
  async purchasePackage(
    @Request() req: any,
    @Body('platform') platform: string,
    @Body('packageName') packageName: string,
  ) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.pricingService.purchasePackage(req.user.businessId, platform, packageName);
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
