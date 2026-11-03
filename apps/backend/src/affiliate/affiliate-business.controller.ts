import {
  BadRequestException,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AffiliateDirectoryService } from './affiliate-directory.service';
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import { AffiliateTaskService } from './affiliate-task.service';
import {
  AffiliateTaskQueryDto,
  CreateAffiliateTaskDto,
  NearbyAffiliatesQueryDto,
  RateAffiliateDto,
  ReportAffiliateDto,
} from './dto/affiliate.dto';

@ApiTags('Business Affiliate Collaboration')
@ApiBearerAuth()
@Controller('business/affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateBusinessController {
  constructor(
    private readonly directory: AffiliateDirectoryService,
    private readonly assignment: AccountManagerAssignmentService,
    private readonly tasks: AffiliateTaskService,
  ) {}

  private async businessContext(req: any) {
    return this.directory.getBusiness(req.user.userId, req.user.businessId);
  }

  @Get('account-manager')
  @ApiOperation({ summary: 'Get the business assigned account manager' })
  async getAccountManager(@Req() req: any) {
    const business = await this.businessContext(req);
    const manager = await this.assignment.getAssignedAccountManager(business.id);
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
