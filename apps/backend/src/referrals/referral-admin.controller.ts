import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  PublishReferralConfigDto,
  ReferralAdminQueryDto,
} from './dto/referral-config.dto';
import { ReferralConfigService } from './referral-config.service';
import { ReferralCommissionService } from './referral-commission.service';
import { ReferralsService } from './referrals.service';

@ApiTags('Admin Referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/referrals')
export class ReferralAdminController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly config: ReferralConfigService,
    private readonly commission: ReferralCommissionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List every user actively referring people' })
  listReferrers(@Query() query: ReferralAdminQueryDto) {
    return this.commission.getAdminReferrers(query);
  }

  @Get('config')
  @ApiOperation({ summary: 'Current referral configuration plus recent config history' })
  async currentConfig() {
    const [current, history] = await Promise.all([
      this.config.getPublicConfig(),
      this.config.listHistory(1, 50),
    ]);
    return {
      success: true,
      data: {
        current,
        history: history.data,
      },
    };
  }

  @Get('config/history')
  @ApiOperation({ summary: 'Immutable referral configuration changelog' })
  history(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.config.listHistory(Number(page) || 1, Number(limit) || 50);
  }

  @Post('config')
  @ApiOperation({ summary: 'Publish a new referral configuration version' })
  publish(@Req() req: any, @Body() dto: PublishReferralConfigDto) {
    return this.config
      .publish(dto, req.user.userId)
      .then((data) => ({ success: true, data }));
  }

  @Get(':userId')
  @ApiOperation({ summary: 'A referrer, everyone they referred, and earnings per person' })
  detail(@Param('userId') userId: string) {
    return this.referrals.getAdminReferrerDetail(userId);
  }
}
