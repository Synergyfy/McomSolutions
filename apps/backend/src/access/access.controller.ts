import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessService } from './access.service';
import { AccessCouponQuoteDto } from './dto/access.dto';

@ApiTags('Access')
@Controller('access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

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
  @Get('purchases')
  @ApiOperation({ summary: 'List access purchases for the current business' })
  async getPurchases(@Req() req: any) {
    if (!req.user?.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.accessService.getPurchaseHistory(req.user.businessId);
  }
}
