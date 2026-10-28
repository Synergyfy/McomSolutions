import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessService } from './access.service';
import { ServiceConnectorsService } from '../service-connectors/service-connectors.service';
import { AccessCouponQuoteDto, RedeemAccessCodeDto } from './dto/access.dto';

@ApiTags('Access')
@Controller('access')
export class AccessController {
  constructor(
    private readonly accessService: AccessService,
    private readonly serviceConnectors: ServiceConnectorsService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Get('rewards-passes')
  @ApiOperation({ summary: 'List active MCOM Rewards access pass plans' })
  async getMcomRewardsAccessPassPlans() {
    const data = await this.serviceConnectors.getMcomRewardsAccessPassPlans();
    return { success: true, data };
  }

  @SkipThrottle()
  @Get('plans')
  @ApiOperation({ summary: 'List active access plans (one-time platform passes)' })
  async getPlans() {
    return this.accessService.getPlans();
  }

  @SkipThrottle()
  @Get('plans/:id')
  @ApiOperation({ summary: 'Get one active access plan' })
  async getPlan(@Param('id') id: string) {
    return { success: true, data: await this.accessService.getPlan(id) };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate a coupon against an access plan and quote the amount due' })
  async validateCoupon(@Req() req: any, @Body() dto: AccessCouponQuoteDto) {
    const quote = await this.accessService.resolveQuote(
      dto.accessPlanId,
      dto.couponCode,
      req.user?.userId,
    );
    return {
      accessPlanId: quote.accessPlan.id,
      planName: quote.accessPlan.name,
      durationDays: quote.accessPlan.durationDays,
      originalAmount: quote.originalAmount,
      discountAmount: quote.discountAmount,
      finalAmount: quote.finalAmount,
      currency: quote.currency,
      walletCredits: quote.walletCredits,
      walletCurrency: quote.walletCurrency,
      coupon: quote.coupon,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('conflict')
  @ApiOperation({ summary: 'Check whether an access pass overlaps the business active membership' })
  @ApiQuery({ name: 'accessPlanId', required: true, description: 'Access plan to check' })
  async getConflict(@Req() req: any, @Query('accessPlanId') accessPlanId: string) {
    if (!req.user?.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    if (!accessPlanId) {
      throw new BadRequestException('accessPlanId is required');
    }
    return this.accessService.getMembershipConflict(req.user.businessId, accessPlanId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('purchases')
  @ApiOperation({ summary: 'List access purchases for the current business' })
  async getPurchases(@Req() req: any) {
    if (!req.user?.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.accessService.getPurchaseHistory(req.user.businessId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('codes')
  @ApiOperation({ summary: 'List access pass codes purchased by or assigned to this business' })
  async getCodes(@Req() req: any) {
    if (!req.user?.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.accessService.listAccessCodes(req.user.businessId, req.user.email);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('codes/redeem')
  @ApiOperation({ summary: 'Redeem an access pass code and start the pass now' })
  async redeemCode(@Req() req: any, @Body() dto: RedeemAccessCodeDto) {
    if (!req.user?.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.accessService.redeemAccessCode(
      req.user.businessId,
      req.user.userId,
      req.user.email,
      dto.code,
    );
  }
}
