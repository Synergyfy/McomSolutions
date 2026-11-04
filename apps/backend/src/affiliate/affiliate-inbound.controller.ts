import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffiliateApiKeyGuard } from './guards/affiliate-api-key.guard';
import { AffiliateTaskService } from './affiliate-task.service';
import { AffiliateClientService } from './affiliate-client.service';
import { AffiliateTaskStatusCallbackDto } from './dto/affiliate.dto';

@ApiTags('Affiliate Inbound (backend-to-backend)')
@Controller('affiliate')
export class AffiliateInboundController {
  constructor(
    private readonly tasks: AffiliateTaskService,
    private readonly client: AffiliateClientService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Affiliate bridge health (public)' })
  async health() {
    return {
      success: true,
      data: {
        bridge: 'up',
        affiliateReachable: await this.client.ping(),
      },
    };
  }

  @Post('tasks/:centralTaskId/status')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiOperation({ summary: 'Callback from 247GBS Affiliates when a delegated task is accepted, submitted or reviewed' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async callback(
    @Param('centralTaskId') centralTaskId: string,
    @Body() dto: AffiliateTaskStatusCallbackDto,
  ) {
    const task = await this.tasks.handleAffiliateCallback(centralTaskId, {
      status: dto.status,
      affiliateTaskId: dto.affiliateTaskId,
      submissionData: dto.submissionData,
      reviewAcknowledged: dto.reviewAcknowledged,
    });
    return { success: true, data: task };
  }
}
