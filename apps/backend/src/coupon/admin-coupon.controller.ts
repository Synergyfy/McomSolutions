import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CouponService } from './coupon.service';
import {
  CouponUserLookupQueryDto,
  CreateCouponDto,
  QueryCouponRedemptionsDto,
  QueryCouponsDto,
  UpdateCouponDto,
  UpdateCouponStatusDto,
} from './dto/coupon.dto';

@ApiTags('Admin Coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/coupons')
export class AdminCouponController {
  constructor(private readonly couponService: CouponService) {}

  private adminName(req: any): string {
    return req.user?.name || req.user?.email || 'Admin';
  }

  @Get('stats')
  @ApiOperation({ summary: 'Coupon totals, redemptions and discount value' })
  @ApiOkResponse({ description: 'Coupon statistics' })
  getStats() {
    return this.couponService.getStats();
  }

  @Get('redemptions')
  @ApiOperation({ summary: 'Paginated coupon redemption ledger with filters' })
  @ApiOkResponse({ description: 'Redemption ledger' })
  getRedemptions(@Query() query: QueryCouponRedemptionsDto) {
    return this.couponService.listRedemptions(query);
  }

  @Get('users')
  @ApiOperation({ summary: 'Search users for locking a coupon to one person' })
  @ApiOkResponse({ description: 'Matching users (max 20)' })
  lookupUsers(@Query() query: CouponUserLookupQueryDto) {
    return this.couponService.lookupUsers(query.search);
  }

  @Get()
  @ApiOperation({ summary: 'List coupons with search, status, source and plan filters' })
  @ApiOkResponse({ description: 'Paginated coupons' })
  getCoupons(@Query() query: QueryCouponsDto) {
    return this.couponService.listCoupons(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one coupon' })
  @ApiNotFoundResponse({ description: 'Coupon not found' })
  getCoupon(@Param('id') id: string) {
    return this.couponService.getCoupon(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an admin coupon code' })
  @ApiBody({ type: CreateCouponDto })
  @ApiCreatedResponse({ description: 'Coupon created' })
  createCoupon(@Body() dto: CreateCouponDto, @Req() req: any) {
    return this.couponService.createCoupon(dto, this.adminName(req));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a coupon' })
  @ApiBody({ type: UpdateCouponDto })
  @ApiOkResponse({ description: 'Coupon updated' })
  updateCoupon(@Param('id') id: string, @Body() dto: UpdateCouponDto, @Req() req: any) {
    return this.couponService.updateCoupon(id, dto, this.adminName(req));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a coupon' })
  @ApiBody({ type: UpdateCouponStatusDto })
  @ApiOkResponse({ description: 'Coupon status updated' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCouponStatusDto,
    @Req() req: any,
  ) {
    return this.couponService.setCouponStatus(id, dto.isActive, this.adminName(req));
  }

  @Post(':id/resend-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a task-reward coupon email' })
  @ApiOkResponse({ description: 'Email resent' })
  resendEmail(@Param('id') id: string, @Req() req: any) {
    return this.couponService.resendTaskCouponEmail(id, this.adminName(req));
  }
}
