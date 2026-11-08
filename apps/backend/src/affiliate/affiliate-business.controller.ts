import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AffiliateDirectoryService } from './affiliate-directory.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import { AffiliateTaskService } from './affiliate-task.service';
import { AffiliateTaskQuotaService } from './affiliate-task-quota.service';
import {
  AffiliateTaskQueryDto,
  ApproveBusinessChargeDto,
  ApproveServiceRequestDto,
  AssignAffiliateTaskDto,
  CloseAffiliateProjectDto,
  CreateAffiliateProjectDto,
  CreateAffiliateServiceRequestDto,
  CreateAffiliateTaskDto,
  NearbyAffiliatesQueryDto,
  RateAffiliateDto,
  ReportAffiliateDto,
  ReviewBusinessTaskDto,
} from './dto/affiliate.dto';

@ApiTags('Business Affiliate Collaboration')
@ApiBearerAuth()
@Controller('business/affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateBusinessController {
  private readonly logger = new Logger(AffiliateBusinessController.name);

  constructor(
    private readonly directory: AffiliateDirectoryService,
    private readonly assignment: AccountManagerAssignmentService,
    private readonly tasks: AffiliateTaskService,
    private readonly quota: AffiliateTaskQuotaService,
  ) {}

  private async businessContext(req: any) {
    return this.directory.getBusiness(req.user.userId, req.user.businessId);
  }

  @Get('account-manager')
  @ApiOperation({ summary: 'Get the business assigned account manager' })
  async getAccountManager(@Req() req: any) {
    const business = await this.businessContext(req);
    let manager = await this.assignment.getAssignedAccountManager(business.id);

    // Self-heal memberships that became active before assignment existed (or
    // whose manager was deactivated). Never let a lookup failure break the
    // business dashboard; the response still exposes `assignable`.
    if (!manager && this.isPaidActiveMembership(business)) {
      try {
        manager = await this.assignment.assignForBusiness(business.id, {
          notify: false,
        });
      } catch (error: any) {
        this.logger.warn(
          `Lazy account-manager assignment failed for business ${business.id}: ${
            error?.message ?? error
          }`,
        );
      }
    }

    const assignable = this.isPaidActiveMembership(business);
    return {
      success: true,
      data: manager,
      meta: {
        assignable: assignable && !manager,
        membershipStatus: business.membershipStatus,
        membershipPlanName: business.membershipPlanName,
      },
    };
  }

  @Post('account-manager/reassign')
  @ApiOperation({ summary: 'Re-run proximity assignment (idempotent, force refresh)' })
  async reassignAccountManager(@Req() req: any) {
    const business = await this.businessContext(req);
    if (!this.isPaidActiveMembership(business)) {
      throw new BadRequestException(
        'Account managers are assigned to active paid memberships. Trial and access-pass businesses can delegate tasks from Task Delegation.',
      );
    }
    const manager = await this.assignment.assignForBusiness(business.id, {
      force: true,
      notify: false,
    });
    return { success: true, data: manager };
  }

  private isPaidActiveMembership(business: {
    membershipStatus?: string | null;
    membershipPlanName?: string | null;
    membershipExpiresAt?: Date | null;
  }): boolean {
    return (
      business.membershipStatus === 'active' &&
      !!business.membershipPlanName &&
      (!business.membershipExpiresAt || business.membershipExpiresAt > new Date())
    );
  }

  @Get('affiliates')
  @ApiOperation({ summary: 'List nearby agents, account managers and consultants ranked by proximity + reputation' })
  async listAffiliates(@Req() req: any, @Query() query: NearbyAffiliatesQueryDto) {
    const business = await this.businessContext(req);
    const result = await this.directory.listNearbyAffiliates(business, query);
    return { success: true, ...result };
  }

  @Get('platform-access')
  @ApiOperation({ summary: 'Platforms the business may tag a delegated task with' })
  async platformAccess(@Req() req: any) {
    const business = await this.businessContext(req);
    const result = await this.directory.getPlatformAccess(business.id);
    return { success: true, data: result };
  }

  @Get('task-quota')
  @ApiOperation({
    summary: 'Free delegated-task allowance for the current membership or access pass',
  })
  async taskQuota(@Req() req: any) {
    const business = await this.businessContext(req);
    return { success: true, data: await this.quota.resolve(business.id) };
  }

  // ─── Service requests (support channel) ─────────────────────────────
  @Post('requests')
  @ApiOperation({ summary: 'Submit a service request describing the outcome you need' })
  async createServiceRequest(@Req() req: any, @Body() dto: CreateAffiliateServiceRequestDto) {
    const business = await this.businessContext(req);
    const request = await this.tasks.createServiceRequest(req.user.userId, business.id, dto);
    return { success: true, data: request, message: 'Service request submitted' };
  }

  @Get('requests')
  @ApiOperation({ summary: 'List your service requests' })
  async listServiceRequests(@Req() req: any, @Query() query: AffiliateTaskQueryDto) {
    const business = await this.businessContext(req);
    return this.tasks.listBusinessServiceRequests(business.id, query);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get a service request with its project and tasks' })
  async getServiceRequest(@Req() req: any, @Param('id') id: string) {
    const business = await this.businessContext(req);
    return { success: true, data: await this.tasks.getBusinessServiceRequest(business.id, id) };
  }

  @Post('requests/:id/approve-price')
  @ApiOperation({ summary: 'Approve the quoted price for a service request before chargeable work begins' })
  async approveRequestPrice(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveServiceRequestDto,
  ) {
    const business = await this.businessContext(req);
    return {
      success: true,
      data: await this.tasks.approveServiceRequestPrice(req.user.userId, business.id, id, dto),
    };
  }

  // ─── Projects (service plans grouping related tasks) ────────────────
  @Post('projects')
  @ApiOperation({ summary: 'Create a project/service plan to group related tasks' })
  async createProject(@Req() req: any, @Body() dto: CreateAffiliateProjectDto) {
    const business = await this.businessContext(req);
    return {
      success: true,
      data: await this.tasks.createProject(req.user.userId, business.id, dto),
    };
  }

  @Get('projects')
  @ApiOperation({ summary: 'List projects with their tasks' })
  async listProjects(@Req() req: any, @Query() query: AffiliateTaskQueryDto) {
    const business = await this.businessContext(req);
    return this.tasks.listProjects(business.id, query);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get a project, its tasks, events and review history' })
  async getProject(@Req() req: any, @Param('id') id: string) {
    const business = await this.businessContext(req);
    return { success: true, data: await this.tasks.getProject(business.id, id) };
  }

  @Post('projects/:id/close')
  @ApiOperation({ summary: 'Close the loop: record outcome and any follow-up work' })
  async closeProject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CloseAffiliateProjectDto,
  ) {
    const business = await this.businessContext(req);
    return {
      success: true,
      data: await this.tasks.closeProject(req.user.userId, business.id, id, dto),
    };
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Delegate a task to the account manager or a chosen nearby affiliate' })
  async createTask(@Req() req: any, @Body() dto: CreateAffiliateTaskDto) {
    const business = await this.businessContext(req);
    const task = await this.tasks.createBusinessTask(req.user.userId, business.id, dto);
    return { success: true, data: task, message: 'Task delegated successfully' };
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List tasks delegated to affiliates' })
  async listTasks(@Req() req: any, @Query() query: AffiliateTaskQueryDto) {
    const business = await this.businessContext(req);
    return this.tasks.listBusinessTasks(business.id, query);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get a delegated task with reviews and attachments' })
  async getTask(@Req() req: any, @Param('id') id: string) {
    const business = await this.businessContext(req);
    const task = await this.tasks.getBusinessTask(business.id, id);
    return { success: true, data: task };
  }

  @Post('tasks/:id/reassign')
  @ApiOperation({ summary: 'Reassign a task the affiliate declined to another affiliate' })
  async reassignTask(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignAffiliateTaskDto,
  ) {
    const business = await this.businessContext(req);
    const task = await this.tasks.reassignBusinessTask(business.id, id, dto, req.user.userId);
    return { success: true, data: task, message: 'Task reassigned' };
  }

  @Post('tasks/:id/review')
  @ApiOperation({ summary: 'Business owner approves or requests changes on a submitted outcome' })
  async reviewTask(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewBusinessTaskDto,
  ) {
    const business = await this.businessContext(req);
    const task = await this.tasks.reviewTaskAsBusiness(req.user.userId, business.id, id, dto);
    return { success: true, data: task, message: 'Business review recorded' };
  }

  @Post('tasks/:id/charge')
  @ApiOperation({ summary: 'Approve or decline the separate charge for a task before work begins' })
  async reviewCharge(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveBusinessChargeDto,
  ) {
    const business = await this.businessContext(req);
    const task = await this.tasks.reviewBusinessCharge(req.user.userId, business.id, id, dto);
    return { success: true, data: task, message: 'Charge decision recorded' };
  }

  @Post('tasks/:id/lock-funds')
  @ApiOperation({
    summary: 'Lock the business wallet funds for an assigned task after funding the wallet',
  })
  async lockTaskFunds(@Req() req: any, @Param('id') id: string) {
    const business = await this.businessContext(req);
    const task = await this.tasks.lockBusinessTaskFunds(req.user.userId, business.id, id);
    return {
      success: true,
      data: task,
      message: 'Funds locked. The affiliate can now start the task.',
    };
  }

  @Post('tasks/:id/cancel')
  @ApiOperation({ summary: 'Cancel a delegated task' })
  async cancelTask(@Req() req: any, @Param('id') id: string) {
    const business = await this.businessContext(req);
    const task = await this.tasks.cancelBusinessTask(business.id, id);
    return { success: true, data: task };
  }

  @Post('affiliates/:userId/rating')
  @ApiOperation({ summary: 'Rate/praise an affiliate (updates reputation)' })
  async rateAffiliate(@Req() req: any, @Param('userId') userId: string, @Body() dto: RateAffiliateDto) {
    const business = await this.businessContext(req);
    return this.tasks.rateAffiliate(req.user.userId, business.id, userId, dto);
  }

  @Post('affiliates/:userId/report')
  @ApiOperation({ summary: 'Report an affiliate (admin validates before reputation changes)' })
  async reportAffiliate(@Req() req: any, @Param('userId') userId: string, @Body() dto: ReportAffiliateDto) {
    const business = await this.businessContext(req);
    const report = await this.tasks.reportAffiliate(req.user.userId, business.id, userId, dto);
    return { success: true, data: report, message: 'Report submitted for admin review' };
  }
}
