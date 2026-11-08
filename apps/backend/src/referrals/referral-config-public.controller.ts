import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferralConfigService } from './referral-config.service';

/**
 * Public read-only view of the latest referral rules. Anyone (including the
 * 247GBS affiliate portal and public pricing pages) may read the current
 * configuration; only administrators can publish new versions.
 */
@ApiTags('Referrals')
@Controller('referrals')
export class ReferralConfigPublicController {
  constructor(private readonly config: ReferralConfigService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get the current referral earning configuration (public)' })
  @ApiOkResponse({ description: 'Latest published referral configuration' })
  async getConfig() {
    return { success: true, data: await this.config.getPublicConfig() };
  }
}
