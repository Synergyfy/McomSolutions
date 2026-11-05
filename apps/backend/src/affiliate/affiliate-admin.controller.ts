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
import { AffiliateTaskService } from './affiliate-task.service';
import { AffiliateSettlementService } from './affiliate-settlement.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import {
  AffiliateSettlementQueryDto,
  AffiliateTaskQueryDto,
  ApproveBusinessChargeDto,
  ApproveServiceRequestDto,
  AssignAffiliateTaskDto,
  CloseAffiliateProjectDto,
  CreateAffiliateProjectDto,
  ReviewAffiliateReportDto,
  ReviewAffiliateTaskDto,
} from './dto/affiliate.dto';

@ApiTags('Admin Affiliate Collaboration')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AffiliateAdminController {
  constructor(
    private readonly tasks: AffiliateTaskService,
    private readonly settlement: AffiliateSettlementService,
    private readonly accountManagers: AccountManagerAssignmentService,
  ) {}

  @Post('account-managers/backfill')
  @ApiOperation({
    summary:
      'Assign account managers to paid businesses that have never had one (same logic as the nightly cron)',
  })
  async backfillAccountManagers(@Body('limit') limit?: number) {
    const data = await this.accountManagers.backfillMissingAccountManagers(limit);
    return { success: true, data };
  }

  @Get('affiliate-tasks')
  @ApiOperation({ summary: 'List every delegated affiliate task (submissions, pending assignment, reviews)' })
  list(@Query() query: AffiliateTaskQueryDto) {
    return this.tasks.listAllTasks(query);
  }

  @Get('affiliate-tasks/:id')
  @ApiOperation({ summary: 'Get a delegated task with full review history and attachments' })
  async get(@Param('id') id: string) {
    return { success: true, data: await this.tasks.getTaskForAdmin(id) };
  }

  @Post('affiliate-tasks/:id/assign')
  @ApiOperation({ summary: 'Assign (or reassign a declined) task to an agent, account manager or consultant' })
  async assign(@Param('id') id: string, @Body() dto: AssignAffiliateTaskDto, @Req() req: any) {
    const task = await this.tasks.assignTask(id, dto, req.user.userId);
    return { success: true, data: task, message: 'Affiliate assigned' };
  }

  @Post('affiliate-tasks/:id/charge')
  @ApiOperation({ summary: 'Admin override: approve or decline a task charge' })
  async reviewCharge(
    @Param('id') id: string,
    @Body() dto: ApproveBusinessChargeDto,
    @Req() req: any,
  ) {
    const task = await this.tasks.reviewBusinessChargeAsAdmin(req.user.userId, id, dto);
    return { success: true, data: task, message: 'Charge decision recorded' };
  }

  @Get('affiliate-settlements')
  @ApiOperation({ summary: 'Escrow + payout ledger for delegated task money (admin)' })
  listSettlements(@Query() query: AffiliateSettlementQueryDto) {
    return this.settlement.listSettlements(query);
  }

  @Get('affiliate-settlements/summary')
  @ApiOperation({ summary: 'Headline escrow, payout and platform-fee totals' })
  getSettlementSummary() {
    return this.settlement.getSummary();
  }

  @Get('affiliate-tasks/:id/settlement')
  @ApiOperation({ summary: 'Escrow + payout record for one delegated task' })
  async getTaskSettlement(@Param('id') id: string) {
    return { success: true, data: await this.settlement.getForTask(id) };
  }

  @Post('affiliate-settlements/:taskId/retry')
  @ApiOperation({ summary: 'Retry a failed or partially settled task payout (idempotent)' })
  async retrySettlement(@Param('taskId') taskId: string) {
    return {
      success: true,
      data: await this.settlement.settleTask(taskId),
      message: 'Settlement retried',
    };
  }

  @Post('affiliate-settlements/:taskId/release')
  @ApiOperation({ summary: 'Release a task escrow back to the business wallet' })
  async releaseSettlement(@Param('taskId') taskId: string, @Body('reason') reason?: string) {
    return {
      success: true,
      data: await this.settlement.releaseTaskHold(
        taskId,
        reason || 'Released by administrator',
      ),
      message: 'Escrow released',
    };
  }

  @Get('affiliate-requests')
  @ApiOperation({ summary: 'List every business service request' })
  listRequests(@Query() query: AffiliateTaskQueryDto) {
    return this.tasks.listAllServiceRequests(query);
  }

  @Post('affiliate-requests/:id/clarify')
  @ApiOperation({ summary: 'Ask the business for more information' })
  async clarifyRequest(
    @Param('id') id: string,
    @Body('note') note: string,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.tasks.clarifyRequestAsAdmin(req.user.userId, id, note),
    };
  }

  @Post('affiliate-requests/:id/quote')
  @ApiOperation({ summary: 'Set the price shown to an Access Pass / Trial business' })
  async quoteRequest(
    @Param('id') id: string,
    @Body() dto: ApproveServiceRequestDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.tasks.quoteRequestAsAdmin(req.user.userId, id, dto),
    };
  }

  @Post('affiliate-requests/:id/convert')
  @ApiOperation({ summary: 'Convert a request into a project/service plan' })
  async convertRequest(
    @Param('id') id: string,
    @Body() dto: CreateAffiliateProjectDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.tasks.convertRequestAsAdmin(req.user.userId, id, dto),
    };
  }

  @Get('affiliate-projects')
  @ApiOperation({ summary: 'List every project/service plan' })
  listProjects(@Query() query: AffiliateTaskQueryDto) {
    return this.tasks.listAllProjects(query);
  }

  @Post('affiliate-projects/:id/close')
  @ApiOperation({ summary: 'Close a project with an outcome summary and follow-up notes' })
  async closeProject(
    @Param('id') id: string,
    @Body() dto: CloseAffiliateProjectDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.tasks.closeProjectAsAdmin(req.user.userId, id, dto),
    };
  }

  @Post('affiliate-tasks/:id/review')
  @ApiOperation({ summary: 'Approve or request changes on a submitted task' })
  async review(@Param('id') id: string, @Body() dto: ReviewAffiliateTaskDto, @Req() req: any) {
    const task = await this.tasks.reviewTask(id, dto, req.user.userId);
    return { success: true, data: task, message: 'Review recorded' };
  }

  @Post('affiliate-tasks/:id/cancel')
  @ApiOperation({ summary: 'Cancel a delegated task (applies failed-task reputation)' })
  async cancel(@Param('id') id: string, @Req() req: any) {
    const task = await this.tasks.cancelTaskAdmin(id, req.user.userId);
    return { success: true, data: task };
  }

  @Get('affiliate-reports')
  @ApiOperation({ summary: 'List affiliate reports submitted by businesses' })
  listReports(@Query() query: AffiliateTaskQueryDto) {
    return this.tasks.listReports(query);
  }

  @Post('affiliate-reports/:id/review')
  @ApiOperation({ summary: 'Validate or dismiss an affiliate report (valid reports reduce reputation)' })
  async reviewReport(
    @Param('id') id: string,
    @Body() dto: ReviewAffiliateReportDto,
    @Req() req: any,
  ) {
    const report = await this.tasks.reviewReport(id, dto, req.user.userId);
    return { success: true, data: report };
  }

  @Get('affiliates/:userId/reputation')
  @ApiOperation({ summary: 'Get an affiliate reputation/experience profile and event history' })
  async reputation(@Param('userId') userId: string) {
    return { success: true, data: await this.tasks.getAffiliateProfileForAdmin(userId) };
  }
}
