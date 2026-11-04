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
import { AccountManagerAssignmentService } from './account-manager-assignment.service';
import {
  AffiliateTaskQueryDto,
  AssignAffiliateTaskDto,
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
  @ApiOperation({ summary: 'Assign a pending task to an agent, account manager or consultant' })
  async assign(@Param('id') id: string, @Body() dto: AssignAffiliateTaskDto, @Req() req: any) {
    const task = await this.tasks.assignTask(id, dto, req.user.userId);
    return { success: true, data: task, message: 'Affiliate assigned' };
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
