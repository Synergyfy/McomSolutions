import { Controller, Get, Post, Body, UseGuards, Request, NotFoundException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubscribeMembershipDto, PurchasePackageDto } from './dto/pricing.dto';

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  private readonly logger = new Logger(PricingController.name);
  constructor(private pricingService: PricingService) {}

  @SkipThrottle()
  @Get('plans')
  @ApiOperation({ summary: 'Get all active membership plans with bundles and sub-tiers' })
  async getPlans() {
    return this.pricingService.getPlans();
  }

  /**
   * Phase 2: direct activation without a provider payment is an ADMIN-only
   * manual grant (support tooling). The previous open endpoint let any
   * authenticated user grant themselves a paid membership for free.
   * Trials are removed — every grant is recorded as a paid manual ledger row.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('subscribe')
  @ApiOperation({ summary: 'ADMIN manual membership grant (audited, no trial)' })
  async subscribe(
    @Request() req: any,
    @Body() dto: SubscribeMembershipDto,
  ) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    this.logger.warn(
      `Manual membership grant by admin ${req.user.userId} for business ${req.user.businessId}: ${dto.level}/${dto.tier || 'Normal'} (${dto.billing || 'monthly'})`,
    );
    return this.pricingService.subscribeMembership(
      req.user.businessId,
      dto.level,
      dto.tier || 'Normal',
      dto.billing || 'monthly',
      { provider: 'manual', providerPaymentId: `manual-${randomUUID()}` },
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

  @SkipThrottle()
  @Get('packages')
  @ApiOperation({ summary: 'Get all active package templates' })
  async getPackages() {
    return this.pricingService.getPackageTemplates();
  }

  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getTransactions(@Request() req: any) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.pricingService.getTransactions(req.user.businessId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('subscriptions')
  @ApiOperation({ summary: 'Get active subscriptions and packages for current business' })
  async getSubscriptions(@Request() req: any) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.pricingService.getSubscriptions(req.user.businessId);
  }
}
