import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocalAffiliateService } from './local-affiliate.service';
import { AffiliateRedemptionService } from './affiliate-redemption.service';
import {
  ActivateAffiliateDto,
  AffiliatePageQueryDto,
  RegisterLocalAffiliateDto,
  UpdateLocalAffiliateDto,
  VerifyAffiliateEmailDto,
} from './dto/local-affiliate.dto';
import {
  RedeemRewardDto,
  RewardLedgerQueryDto,
} from './dto/affiliate-reward.dto';
import { AffiliateRewardService } from './affiliate-reward.service';

@ApiTags('Local Affiliate')
@Controller('local-affiliate')
export class LocalAffiliateController {
  constructor(
    private readonly affiliates: LocalAffiliateService,
    private readonly rewards: AffiliateRewardService,
    private readonly redemptions: AffiliateRedemptionService,
  ) {}

  // ── Registration ───────────────────────────────────────────────────────

  @Post('activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activate a Local Affiliate profile on an existing CHS identity',
    description:
      'Scenario A. Never creates a second user row; idempotent — a repeat call returns the existing profile with alreadyActive=true.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth token' })
  activate(@Req() req: any, @Body() dto: ActivateAffiliateDto) {
    return this.affiliates.activate(req.user.userId, dto);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a new CHS identity together with its affiliate profile',
    description:
      'Scenario B. User, wallet, customer profile and affiliate profile are created in one transaction. Returns auth tokens.',
  })
  register(@Body() dto: RegisterLocalAffiliateDto, @Req() req: any) {
    return this.affiliates.register(dto, { ip: req.ip });
  }

  // ── Profile ────────────────────────────────────────────────────────────

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete email verification for a pending affiliate profile',
    description:
      'Scenario B profiles start PENDING. This proves the emailed code and activates the profile so links can be shared.',
  })
  verifyEmail(@Req() req: any, @Body() dto: VerifyAffiliateEmailDto) {
    return this.affiliates.verifyEmail(req.user.userId, dto.code);
  }

  @Post('verification/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Resend the affiliate email verification code' })
  resendVerification(@Req() req: any) {
    return this.affiliates.sendVerificationCode(req.user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My affiliate profile, link and reward balances' })
  @ApiOkResponse({ description: 'Profile, or null when not yet an affiliate' })
  me(@Req() req: any) {
    return this.affiliates.me(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my display name' })
  update(@Req() req: any, @Body() dto: UpdateLocalAffiliateDto) {
    return this.affiliates.update(req.user.userId, dto);
  }

  @Get('link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My permanent affiliate link and QR payload' })
  link(@Req() req: any) {
    return this.affiliates.link(req.user.userId);
  }

  // ── Activity ───────────────────────────────────────────────────────────

  @Get('activity/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Counters: clicks, conversions by type/status, reward balances',
  })
  activitySummary(@Req() req: any) {
    return this.affiliates.activitySummary(req.user.userId);
  }

  @Get('activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My conversion activity (paginated)' })
  activity(@Req() req: any, @Query() query: AffiliatePageQueryDto) {
    return this.affiliates.activity(req.user.userId, query);
  }

  @Get('activity/clicks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My link clicks (paginated)' })
  clicks(@Req() req: any, @Query() query: AffiliatePageQueryDto) {
    return this.affiliates.clicks(req.user.userId, query);
  }

  // ── Rewards ────────────────────────────────────────────────────────────

  @Get('rewards/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reward balances by status',
    description:
      'Pending, approved, available, redeemed, expired and reversed are always reported separately. Pending units never appear in the wallet balance.',
  })
  async rewardsSummary(@Req() req: any) {
    const profile = await this.affiliates.requireProfile(req.user.userId);
    const [points, credits] = await Promise.all([
      this.rewards.getBalances(profile.id, 'POINTS'),
      this.rewards.getBalances(profile.id, 'CREDIT'),
    ]);
    return { success: true, data: { points, credits } };
  }

  @Get('rewards/ledger')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My append-only reward ledger (paginated)' })
  async ledger(@Req() req: any, @Query() query: RewardLedgerQueryDto) {
    const profile = await this.affiliates.requireProfile(req.user.userId);
    return this.rewards.listLedger(profile.id, query);
  }

  @Post('rewards/redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem available points for a voucher' })
  async redeem(@Req() req: any, @Body() dto: RedeemRewardDto) {
    const profile = await this.affiliates.requireActiveProfile(req.user.userId);
    return this.redemptions.redeemReward(profile.id, dto);
  }

  @Get('rewards/redemptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My reward redemptions (paginated)' })
  async redemptionsList(@Req() req: any, @Query() query: RewardLedgerQueryDto) {
    const profile = await this.affiliates.requireProfile(req.user.userId);
    return this.redemptions.listOwnRedemptions(profile.id, query);
  }
}
