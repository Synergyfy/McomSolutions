import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffiliateApiKeyGuard } from './guards/affiliate-api-key.guard';
import { AffiliateTaskService } from './affiliate-task.service';
import { AffiliateClientService } from './affiliate-client.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import {
  AffiliateTaskQueryDto,
  ApproveServiceRequestDto,
  AssignAffiliateTaskDto,
  CloseAffiliateProjectDto,
  CreateAffiliateProjectDto,
  ReviewAffiliateTaskDto,
  AffiliateTaskStatusCallbackDto,
} from './dto/affiliate.dto';

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


  // ── Account Manager workspace (used by the 247GBS AM dashboard) ──────────
  @Get('account-managers/:userId/tasks')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Tasks across the businesses managed by an account manager' })
  async managerTasks(@Param('userId') userId: string, @Query() query: AffiliateTaskQueryDto) {
    return this.tasks.listTasksForManager(userId, query);
  }

  @Get('account-managers/:userId/tasks/:id')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async managerTask(@Param('userId') userId: string, @Param('id') id: string) {
    return { success: true, data: await this.tasks.getTaskForManager(userId, id) };
  }

  @Post('account-managers/:userId/tasks/:id/review')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Account Manager checks a submission and forwards it or requests changes' })
  async managerReview(
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ReviewAffiliateTaskDto,
  ) {
    return { success: true, data: await this.tasks.reviewTaskAsAccountManager(id, dto, userId) };
  }

  @Post('account-managers/:userId/tasks/:id/assign')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Account Manager assigns a task to an agent or consultant' })
  async managerAssign(
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: AssignAffiliateTaskDto,
  ) {
    return {
      success: true,
      data: await this.tasks.assignTask(id, dto, userId, { asAccountManager: true }),
    };
  }

  @Get('account-managers/:userId/requests')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async managerRequests(@Param('userId') userId: string, @Query() query: AffiliateTaskQueryDto) {
    return this.tasks.listRequestsForManager(userId, query);
  }

  @Post('account-managers/:userId/requests/:id/clarify')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async managerClarify(
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    return {
      success: true,
      data: await this.tasks.clarifyServiceRequest(userId, id, note),
    };
  }

  @Post('account-managers/:userId/requests/:id/quote')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async managerQuote(
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ApproveServiceRequestDto,
  ) {
    return {
      success: true,
      data: await this.tasks.quoteServiceRequest(userId, id, dto),
    };
  }

  @Post('account-managers/:userId/requests/:id/convert')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async managerConvert(
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateAffiliateProjectDto,
  ) {
    return {
      success: true,
      data: await this.tasks.convertServiceRequestToProject(userId, id, dto),
    };
  }

  @Get('account-managers/:userId/projects')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async managerProjects(@Param('userId') userId: string, @Query() query: AffiliateTaskQueryDto) {
    return this.tasks.listProjectsForManager(userId, query);
  }

  @Post('account-managers/:userId/projects/:id/close')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  async managerCloseProject(
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CloseAffiliateProjectDto,
  ) {
    return {
      success: true,
      data: await this.tasks.closeProjectForManager(userId, id, dto),
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
