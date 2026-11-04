import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffiliateApiKeyGuard } from './guards/affiliate-api-key.guard';
import { AffiliateTaskService } from './affiliate-task.service';
import { AffiliateClientService } from './affiliate-client.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import { AffiliateTaskStatusCallbackDto } from './dto/affiliate.dto';

@ApiTags('Affiliate Inbound (backend-to-backend)')
@Controller('affiliate')
export class AffiliateInboundController {
  constructor(
    private readonly tasks: AffiliateTaskService,
    private readonly client: AffiliateClientService,
    private readonly accountManagers: AccountManagerAssignmentService,
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

  @Get('account-managers/:userId/businesses')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiOperation({ summary: 'Businesses assigned to an account manager (backend-to-backend)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async accountManagerBusinesses(@Param('userId') userId: string) {
    return {
      success: true,
      data: await this.accountManagers.listBusinessesForManager(userId),
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
