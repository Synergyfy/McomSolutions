import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AffiliateApiKeyGuard } from './guards/affiliate-api-key.guard';
import { AffiliateTaskService } from './affiliate-task.service';
import { AffiliateClientService } from './affiliate-client.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import { WalletService } from '../wallet/wallet.service';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';
import {
  AffiliateTaskQueryDto,
  ApproveServiceRequestDto,
  AssignAffiliateTaskDto,
  CloseAffiliateProjectDto,
  CreateAffiliateProjectDto,
  CreateAffiliateTaskDto,
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
    private readonly wallet: WalletService,
    private readonly ledger: WalletLedgerService,
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

  /**
   * Affiliate MCOM wallet (read-only) for the 247GBS earnings screen.
   * Central remains the single source of truth for money; 247GBS only renders
   * this data. Keyed by the Central user id, which 247GBS stores as `mcomUserId`.
   */
  @Get('wallets/:userId')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiOperation({ summary: 'Affiliate MCOM wallet balance, holds and transactions (backend-to-backend)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async affiliateWallet(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const wallet = await this.wallet.getWalletForUser(userId);
    const [transactions, holds] = await Promise.all([
      this.ledger.getTransactions(wallet.id, {
        page: Math.max(1, Number(page) || 1),
        limit: Math.min(50, Math.max(1, Number(limit) || 20)),
      }),
      this.ledger.getActiveHolds(wallet.id),
    ]);
    return {
      success: true,
      data: {
        wallet,
        holds: holds.map((hold) => ({
          id: hold.id,
          amount: hold.amount.toNumber(),
          reference: hold.reference,
          description: hold.description,
          status: hold.status,
          expiresAt: hold.expiresAt.toISOString(),
          createdAt: hold.createdAt.toISOString(),
        })),
        transactions,
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

  @Post('account-managers/:userId/projects/:id/tasks')
  @UseGuards(AffiliateApiKeyGuard)
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiOperation({ summary: 'Create a task inside a project managed by an account manager' })
  async managerCreateProjectTask(
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateAffiliateTaskDto,
  ) {
    return {
      success: true,
      data: await this.tasks.createProjectTaskForManager(userId, id, dto),
      message: 'Task created',
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
      declineReason: dto.declineReason,
    });
    return { success: true, data: task };
  }
}
