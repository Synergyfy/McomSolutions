import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOpsService } from './admin-ops.service';
import {
  ActivityQueryDto,
  CreateActivityFeedDto,
  CreateAssessmentQuestionDto,
  CreateBackgroundJobDto,
  CreateBoroughMetricDto,
  CreateErrorLogDto,
  CreateExternalPlanDto,
  CreateSystemApiKeyDto,
  CreateSystemIntegrationDto,
  ReorderAssessmentQuestionsDto,
  UpdateActivityFeedDto,
  UpdateAssessmentQuestionDto,
  UpdateBackgroundJobDto,
  UpdateBoroughMetricDto,
  UpdateExternalPlanDto,
  UpdateSystemApiKeyDto,
  UpdateSystemIntegrationDto,
} from './dto/admin-ops.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminOpsController {
  constructor(private readonly adminOpsService: AdminOpsService) {}

  // ─── External Platform Packages ───────────────────────
  @Get('packages/external/platforms')
  @ApiOperation({ summary: 'List supported external platform names for dropdown' })
  @ApiOkResponse({ description: 'Supported platform names' })
  getSupportedPlatforms() {
    return this.adminOpsService.getSupportedPlatforms();
  }

  @Get('packages/external')
  @ApiOperation({ summary: 'List external platform plans' })
  @ApiQuery({ name: 'platform', required: false, example: 'MCOM Mall', description: 'Filter by platform' })
  @ApiOkResponse({ description: 'List of external plans' })
  getExternalPlans(@Query('platform') platform?: string) {
    return this.adminOpsService.getExternalPlans(platform);
  }

  @Post('packages/external')
  @ApiOperation({ summary: 'Create an external platform plan' })
  @ApiBody({ type: CreateExternalPlanDto })
  @ApiCreatedResponse({ description: 'External plan created' })
  createExternalPlan(@Body() dto: CreateExternalPlanDto) {
    return this.adminOpsService.createExternalPlan(dto);
  }

  // NOTE: declared BEFORE `packages/external/:id` so the literal `schema` and `seasons`
  // segments are not captured as a plan id.
  @Get('packages/external/schema')
  @ApiOperation({ summary: 'Get an external platform plan configuration schema (quotas + feature flags)' })
  @ApiQuery({ name: 'platform', example: 'Mcom vCard', description: 'Platform name', required: true })
  @ApiOkResponse({ description: 'Plan schema (or null when the platform has no schema endpoint)' })
  getExternalPlanSchema(@Query('platform') platform: string) {
    return this.adminOpsService.getExternalPlanSchema(platform);
  }

  @Get('packages/external/seasons')
  @ApiOperation({ summary: 'Get available seasons from an external platform' })
  @ApiQuery({ name: 'platform', example: 'Mcom vCard', description: 'Platform name', required: true })
  @ApiOkResponse({ description: 'List of external seasons' })
  getExternalPlatformSeasons(@Query('platform') platform: string) {
    return this.adminOpsService.getExternalPlatformSeasons(platform);
  }

  @Get('packages/external/:id')
  @ApiOperation({ summary: 'Get a single external plan' })
  @ApiQuery({ name: 'platform', required: false, example: 'MCOM Mall', description: 'Platform (informational)' })
  @ApiOkResponse({ description: 'External plan' })
  @ApiNotFoundResponse({ description: 'External plan not found' })
  getExternalPlan(@Param('id') id: string, @Query('platform') platform?: string) {
    return this.adminOpsService.getExternalPlan(id, platform);
  }

  @Patch('packages/external/:id')
  @ApiOperation({ summary: 'Update an external plan' })
  @ApiQuery({ name: 'platform', required: false, example: 'MCOM Mall', description: 'Platform (informational)' })
  @ApiBody({ type: UpdateExternalPlanDto })
  @ApiOkResponse({ description: 'External plan updated' })
  @ApiNotFoundResponse({ description: 'External plan not found' })
  updateExternalPlan(@Param('id') id: string, @Query('platform') platform: string, @Body() dto: UpdateExternalPlanDto) {
    return this.adminOpsService.updateExternalPlan(id, platform, dto);
  }

  @Delete('packages/external/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an external plan' })
  @ApiQuery({ name: 'platform', required: false, example: 'MCOM Mall', description: 'Platform (informational)' })
  @ApiNotFoundResponse({ description: 'External plan not found' })
  async deleteExternalPlan(@Param('id') id: string, @Query('platform') platform: string) {
    await this.adminOpsService.deleteExternalPlan(id, platform);
  }

  // ─── System API Keys ──────────────────────────────────
  @Get('system/api-keys')
  @ApiOperation({ summary: 'List system API keys (masked)' })
  @ApiOkResponse({ description: 'List of API keys with masked values' })
  getApiKeys() {
    return this.adminOpsService.getApiKeys();
  }

  @Post('system/api-keys')
  @ApiOperation({ summary: 'Create a system API key' })
  @ApiBody({ type: CreateSystemApiKeyDto })
  @ApiCreatedResponse({ description: 'API key created (full key returned once)' })
  createApiKey(@Body() dto: CreateSystemApiKeyDto) {
    return this.adminOpsService.createApiKey(dto);
  }

  @Put('system/api-keys/:id')
  @ApiOperation({ summary: 'Update a system API key' })
  @ApiBody({ type: UpdateSystemApiKeyDto })
  @ApiOkResponse({ description: 'API key updated' })
  @ApiNotFoundResponse({ description: 'API key not found' })
  updateApiKey(@Param('id') id: string, @Body() dto: UpdateSystemApiKeyDto) {
    return this.adminOpsService.updateApiKey(id, dto);
  }

  @Delete('system/api-keys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a system API key' })
  @ApiNotFoundResponse({ description: 'API key not found' })
  async deleteApiKey(@Param('id') id: string) {
    await this.adminOpsService.deleteApiKey(id);
  }

  // ─── System Integrations ──────────────────────────────
  @Get('system/integrations')
  @ApiOperation({ summary: 'List system integrations' })
  @ApiOkResponse({ description: 'List of integrations' })
  getIntegrations() {
    return this.adminOpsService.getIntegrations();
  }

  @Post('system/integrations')
  @ApiOperation({ summary: 'Create a system integration' })
  @ApiBody({ type: CreateSystemIntegrationDto })
  @ApiCreatedResponse({ description: 'Integration created' })
  createIntegration(@Body() dto: CreateSystemIntegrationDto) {
    return this.adminOpsService.createIntegration(dto);
  }

  @Put('system/integrations/:id')
  @ApiOperation({ summary: 'Update a system integration' })
  @ApiBody({ type: UpdateSystemIntegrationDto })
  @ApiOkResponse({ description: 'Integration updated' })
  @ApiNotFoundResponse({ description: 'Integration not found' })
  updateIntegration(@Param('id') id: string, @Body() dto: UpdateSystemIntegrationDto) {
    return this.adminOpsService.updateIntegration(id, dto);
  }

  @Delete('system/integrations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a system integration' })
  @ApiNotFoundResponse({ description: 'Integration not found' })
  async deleteIntegration(@Param('id') id: string) {
    await this.adminOpsService.deleteIntegration(id);
  }

  // ─── Assessment Questions ─────────────────────────────
  @Get('assessment/questions')
  @ApiOperation({ summary: 'List assessment questions' })
  @ApiOkResponse({ description: 'List of assessment questions' })
  getAssessmentQuestions() {
    return this.adminOpsService.getAssessmentQuestions();
  }

  @Post('assessment/questions')
  @ApiOperation({ summary: 'Create an assessment question' })
  @ApiBody({ type: CreateAssessmentQuestionDto })
  @ApiCreatedResponse({ description: 'Assessment question created' })
  createAssessmentQuestion(@Body() dto: CreateAssessmentQuestionDto) {
    return this.adminOpsService.createAssessmentQuestion(dto);
  }

  @Put('assessment/questions/reorder')
  @ApiOperation({ summary: 'Reorder assessment questions' })
  @ApiBody({ type: ReorderAssessmentQuestionsDto })
  @ApiOkResponse({ description: 'Questions reordered' })
  reorderAssessmentQuestions(@Body() dto: ReorderAssessmentQuestionsDto) {
    return this.adminOpsService.reorderAssessmentQuestions(dto);
  }

  @Put('assessment/questions/:id')
  @ApiOperation({ summary: 'Update an assessment question' })
  @ApiBody({ type: UpdateAssessmentQuestionDto })
  @ApiOkResponse({ description: 'Assessment question updated' })
  @ApiNotFoundResponse({ description: 'Assessment question not found' })
  updateAssessmentQuestion(@Param('id') id: string, @Body() dto: UpdateAssessmentQuestionDto) {
    return this.adminOpsService.updateAssessmentQuestion(id, dto);
  }

  @Delete('assessment/questions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an assessment question' })
  @ApiNotFoundResponse({ description: 'Assessment question not found' })
  async deleteAssessmentQuestion(@Param('id') id: string) {
    await this.adminOpsService.deleteAssessmentQuestion(id);
  }

  // ─── Activity Feed ────────────────────────────────────
  @Get('activities')
  @ApiOperation({ summary: 'List activity feed items' })
  @ApiQuery({ name: 'highStreetId', required: false, description: 'Filter by high street' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Items per page (max 100)' })
  @ApiOkResponse({ description: 'Paginated list of activity feed items' })
  getActivities(@Query() query: ActivityQueryDto) {
    return this.adminOpsService.getActivities(query);
  }

  @Post('activities')
  @ApiOperation({ summary: 'Create an activity feed item' })
  @ApiBody({ type: CreateActivityFeedDto })
  @ApiCreatedResponse({ description: 'Activity created' })
  @ApiNotFoundResponse({ description: 'High street not found' })
  createActivity(@Body() dto: CreateActivityFeedDto) {
    return this.adminOpsService.createActivity(dto);
  }

  @Put('activities/:id')
  @ApiOperation({ summary: 'Update an activity feed item' })
  @ApiBody({ type: UpdateActivityFeedDto })
  @ApiOkResponse({ description: 'Activity updated' })
  @ApiNotFoundResponse({ description: 'Activity not found' })
  updateActivity(@Param('id') id: string, @Body() dto: UpdateActivityFeedDto) {
    return this.adminOpsService.updateActivity(id, dto);
  }

  @Delete('activities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an activity feed item' })
  @ApiNotFoundResponse({ description: 'Activity not found' })
  async deleteActivity(@Param('id') id: string) {
    await this.adminOpsService.deleteActivity(id);
  }

  // ─── Borough Metrics ──────────────────────────────────
  @Get('localities/boroughs/:id/metrics')
  @ApiOperation({ summary: 'List monthly metrics for a borough' })
  @ApiOkResponse({ description: 'List of borough metrics' })
  @ApiNotFoundResponse({ description: 'Borough not found' })
  getBoroughMetrics(@Param('id') id: string) {
    return this.adminOpsService.getBoroughMetrics(id);
  }

  @Post('localities/boroughs/:id/metrics')
  @ApiOperation({ summary: 'Create a monthly metric for a borough' })
  @ApiBody({ type: CreateBoroughMetricDto })
  @ApiCreatedResponse({ description: 'Borough metric created' })
  @ApiConflictResponse({ description: 'Metric for this borough/month already exists' })
  @ApiNotFoundResponse({ description: 'Borough not found' })
  createBoroughMetric(@Param('id') id: string, @Body() dto: CreateBoroughMetricDto) {
    return this.adminOpsService.createBoroughMetric(id, dto);
  }

  @Put('localities/boroughs/metrics/:metricId')
  @ApiOperation({ summary: 'Update a borough metric' })
  @ApiBody({ type: UpdateBoroughMetricDto })
  @ApiOkResponse({ description: 'Borough metric updated' })
  @ApiNotFoundResponse({ description: 'Borough metric not found' })
  updateBoroughMetric(@Param('metricId') metricId: string, @Body() dto: UpdateBoroughMetricDto) {
    return this.adminOpsService.updateBoroughMetric(metricId, dto);
  }

  @Delete('localities/boroughs/metrics/:metricId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a borough metric' })
  @ApiNotFoundResponse({ description: 'Borough metric not found' })
  async deleteBoroughMetric(@Param('metricId') metricId: string) {
    await this.adminOpsService.deleteBoroughMetric(metricId);
  }

  @Get('localities/boroughs/:id/stats')
  @ApiOperation({ summary: 'Get detailed stats for a borough' })
  @ApiOkResponse({ description: 'Borough detail stats' })
  @ApiNotFoundResponse({ description: 'Borough not found' })
  getBoroughStats(@Param('id') id: string) {
    return this.adminOpsService.getBoroughStats(id);
  }

  // ─── Background Jobs ──────────────────────────────────
  @Get('system/jobs')
  @ApiOperation({ summary: 'List background jobs' })
  @ApiOkResponse({ description: 'List of background jobs' })
  getBackgroundJobs() {
    return this.adminOpsService.getBackgroundJobs();
  }

  @Post('system/jobs')
  @ApiOperation({ summary: 'Create a background job' })
  @ApiBody({ type: CreateBackgroundJobDto })
  @ApiCreatedResponse({ description: 'Background job created' })
  createBackgroundJob(@Body() dto: CreateBackgroundJobDto) {
    return this.adminOpsService.createBackgroundJob(dto);
  }

  @Put('system/jobs/:id')
  @ApiOperation({ summary: 'Update a background job' })
  @ApiBody({ type: UpdateBackgroundJobDto })
  @ApiOkResponse({ description: 'Background job updated' })
  @ApiNotFoundResponse({ description: 'Background job not found' })
  updateBackgroundJob(@Param('id') id: string, @Body() dto: UpdateBackgroundJobDto) {
    return this.adminOpsService.updateBackgroundJob(id, dto);
  }

  @Delete('system/jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a background job' })
  @ApiNotFoundResponse({ description: 'Background job not found' })
  async deleteBackgroundJob(@Param('id') id: string) {
    await this.adminOpsService.deleteBackgroundJob(id);
  }

  // ─── Error Logs ───────────────────────────────────────
  @Get('system/error-logs')
  @ApiOperation({ summary: 'List error logs' })
  @ApiOkResponse({ description: 'List of error logs' })
  getErrorLogs() {
    return this.adminOpsService.getErrorLogs();
  }

  @Post('system/error-logs')
  @ApiOperation({ summary: 'Create an error log' })
  @ApiBody({ type: CreateErrorLogDto })
  @ApiCreatedResponse({ description: 'Error log created' })
  createErrorLog(@Body() dto: CreateErrorLogDto) {
    return this.adminOpsService.createErrorLog(dto);
  }

  // ─── System Health ────────────────────────────────────
  @Get('system/health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiOkResponse({ description: 'System health' })
  getSystemHealth() {
    return this.adminOpsService.getSystemHealth();
  }
}
