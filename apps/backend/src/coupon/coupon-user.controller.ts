import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CouponService } from './coupon.service';

@ApiTags('Coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('coupons')
export class CouponUserController {
  constructor(private readonly couponService: CouponService) {}

  @Get('my')
  @ApiOperation({ summary: 'List coupons assigned to the signed-in user and their usage history' })
  @ApiOkResponse({ description: 'Personal coupon wallet' })
  getMyCoupons(@Req() req: any) {
    return this.couponService.listMyCoupons(req.user?.userId);
  }
}
