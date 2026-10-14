import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferralsService } from './referrals.service';
import { ReferralQueryDto } from './dto/referral-query.dto';
import {
  ReferralInfoResponseDto,
  ReferralListResponseDto,
  ReferralStatsResponseDto,
} from './dto/referral-response.dto';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my referral code and shareable referral link' })
  @ApiOkResponse({ type: ReferralInfoResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth token' })
  getMyReferralInfo(@Request() req: any): Promise<ReferralInfoResponseDto> {
    return this.referralsService.getMyReferralInfo(req.user.userId);
  }

  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my referral counts' })
  @ApiOkResponse({ type: ReferralStatsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth token' })
  getMyReferralStats(@Request() req: any): Promise<ReferralStatsResponseDto> {
    return this.referralsService.getMyReferralStats(req.user.userId);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users I have referred (paginated)' })
  @ApiOkResponse({ type: ReferralListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid auth token' })
  listMyReferrals(
    @Request() req: any,
    @Query() query: ReferralQueryDto,
  ): Promise<ReferralListResponseDto> {
    return this.referralsService.listMyReferrals(req.user.userId, query);
  }
}
