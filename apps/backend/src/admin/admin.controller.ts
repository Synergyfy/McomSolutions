import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import {
  CreateBusinessUserDto,
  CreateCustomerUserDto,
  CreateAgentUserDto,
  CreateConsultantUserDto,
  CreateAccountManagerDto,
  CreateMembershipPlanDto,
  CreatePackageTemplateDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  UpdateEcosystemPlatformDto,
  CreatePlatformLaunchRuleDto,
  UpdatePermissionRoleDto,
  RecordPaymentDto,
  UpdatePaymentStatusDto,
  CreateBroadcastNotificationDto,
  UpdateSupportTicketDto,
  UpdateSystemSettingsDto,
  CreateBoroughDto,
  CreateHighStreetDto,
  CreateLocalMallDto,
  AdminQueryDto,
  UpdateMembershipPlanDto,
  UpdatePackageTemplateDto,
  UpdateBoroughDto,
  UpdateHighStreetDto,
  UpdateLocalMallDto,
  UpdatePlatformLaunchRuleDto,
  UpdateBroadcastNotificationDto,
  ClearAuditLogsDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private getAdminName(req: any): string {
    return req.user?.name || req.user?.email || 'Admin';
  }

  // ─── Dashboard Stats ────────────────────────────────────
  @Get('stats')
  @ApiOperation({ summary: 'Get overall ecosystem stats' })
  async getStats() {
    return this.adminService.getStats();
  }

  // ─── Business Users Management ────────────────────────
  @Get('users/businesses')
  @ApiOperation({ summary: 'List businesses' })
  async getBusinesses(@Query() query: AdminQueryDto) {
    return this.adminService.getBusinesses(query);
  }

  @Post('users/businesses')
  @ApiOperation({ summary: 'Create business user' })
  async createBusiness(@Req() req: any, @Body() dto: CreateBusinessUserDto) {
    return this.adminService.createBusiness(dto, this.getAdminName(req));
  }

  @Put('users/businesses/:id')
  @ApiOperation({ summary: 'Update business user' })
  async updateBusiness(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: Partial<CreateBusinessUserDto>,
  ) {
    return this.adminService.updateBusiness(id, updates, this.getAdminName(req));
  }

  @Delete('users/businesses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete business user' })
  async deleteBusiness(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteBusiness(id, this.getAdminName(req));
  }

  // ─── Customer Users Management ────────────────────────
  @Get('users/customers')
  @ApiOperation({ summary: 'List customer users' })
  async getCustomers(@Query() query: AdminQueryDto) {
    return this.adminService.getCustomers(query);
  }

  @Post('users/customers')
  @ApiOperation({ summary: 'Create customer user' })
  async createCustomer(@Req() req: any, @Body() dto: CreateCustomerUserDto) {
    return this.adminService.createCustomer(dto, this.getAdminName(req));
  }

  @Put('users/customers/:id')
  @ApiOperation({ summary: 'Update customer user' })
  async updateCustomer(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: Partial<CreateCustomerUserDto>,
  ) {
    return this.adminService.updateCustomer(id, updates, this.getAdminName(req));
  }

  @Delete('users/customers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete customer user' })
  async deleteCustomer(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteCustomer(id, this.getAdminName(req));
  }

  // ─── Agent Users Management ───────────────────────────
  @Get('users/agents')
  @ApiOperation({ summary: 'List agents' })
  async getAgents(@Query() query: AdminQueryDto) {
    return this.adminService.getAgents(query);
  }

  @Post('users/agents')
  @ApiOperation({ summary: 'Create agent user' })
  async createAgent(@Req() req: any, @Body() dto: CreateAgentUserDto) {
    return this.adminService.createAgent(dto, this.getAdminName(req));
  }

  @Put('users/agents/:id')
  @ApiOperation({ summary: 'Update agent user' })
  async updateAgent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: Partial<CreateAgentUserDto>,
  ) {
    return this.adminService.updateAgent(id, updates, this.getAdminName(req));
  }

  @Delete('users/agents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete agent user' })
  async deleteAgent(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteAgent(id, this.getAdminName(req));
  }

  // ─── Consultant Users Management ──────────────────────
  @Get('users/consultants')
  @ApiOperation({ summary: 'List consultants' })
  async getConsultants(@Query() query: AdminQueryDto) {
    return this.adminService.getConsultants(query);
  }

  @Post('users/consultants')
  @ApiOperation({ summary: 'Create consultant user' })
  async createConsultant(@Req() req: any, @Body() dto: CreateConsultantUserDto) {
    return this.adminService.createConsultant(dto, this.getAdminName(req));
  }

  @Put('users/consultants/:id')
  @ApiOperation({ summary: 'Update consultant user' })
  async updateConsultant(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: Partial<CreateConsultantUserDto>,
  ) {
    return this.adminService.updateConsultant(id, updates, this.getAdminName(req));
  }

  @Delete('users/consultants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete consultant user' })
  async deleteConsultant(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteConsultant(id, this.getAdminName(req));
  }

  // ─── Account Manager Management ──────────────────────
  @Get('users/account-managers')
  @ApiOperation({ summary: 'List account managers' })
  async getAccountManagers(@Query() query: AdminQueryDto) {
    return this.adminService.getAccountManagers(query);
  }

  @Post('users/account-managers')
  @ApiOperation({ summary: 'Create account manager' })
  async createAccountManager(@Req() req: any, @Body() dto: CreateAccountManagerDto) {
    return this.adminService.createAccountManager(dto, this.getAdminName(req));
  }

  @Put('users/account-managers/:id')
  @ApiOperation({ summary: 'Update account manager' })
  async updateAccountManager(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: Partial<CreateAccountManagerDto>,
  ) {
    return this.adminService.updateAccountManager(id, updates, this.getAdminName(req));
  }

  @Delete('users/account-managers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete account manager' })
  async deleteAccountManager(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteAccountManager(id, this.getAdminName(req));
  }

  // ─── Membership Plans ──────────────────────────────────
  @Get('plans')
  @ApiOperation({ summary: 'List membership plans' })
  async getPlans() {
    return this.adminService.getPlans();
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create membership plan' })
  async createPlan(@Req() req: any, @Body() dto: CreateMembershipPlanDto) {
    return this.adminService.createPlan(dto, this.getAdminName(req));
  }

  @Put('plans/:id')
  @ApiOperation({ summary: 'Update membership plan' })
  async updatePlan(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: UpdateMembershipPlanDto,
  ) {
    return this.adminService.updatePlan(id, updates, this.getAdminName(req));
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete membership plan' })
  async deletePlan(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deletePlan(id, this.getAdminName(req));
  }

  // ─── Packages ──────────────────────────────────────────
  @Get('packages')
  @ApiOperation({ summary: 'List packages templates' })
  async getPackages() {
    return this.adminService.getPackages();
  }

  @Post('packages')
  @ApiOperation({ summary: 'Create package template' })
  async createPackage(@Req() req: any, @Body() dto: CreatePackageTemplateDto) {
    return this.adminService.createPackage(dto, this.getAdminName(req));
  }

  @Put('packages/:id')
  @ApiOperation({ summary: 'Update package template' })
  async updatePackage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: UpdatePackageTemplateDto,
  ) {
    return this.adminService.updatePackage(id, updates, this.getAdminName(req));
  }

  @Delete('packages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete package template' })
  async deletePackage(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deletePackage(id, this.getAdminName(req));
  }

  // ─── Subscriptions ─────────────────────────────────────
  @Get('subscriptions')
  @ApiOperation({ summary: 'List subscriptions' })
  async getSubscriptions(@Query() query: AdminQueryDto) {
    return this.adminService.getSubscriptions(query);
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create subscription' })
  async createSubscription(@Req() req: any, @Body() dto: CreateSubscriptionDto) {
    return this.adminService.createSubscription(dto, this.getAdminName(req));
  }

  @Put('subscriptions/:id')
  @ApiOperation({ summary: 'Update subscription status' })
  async updateSubscription(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.adminService.updateSubscription(id, dto, this.getAdminName(req));
  }

  // ─── Platforms Access Control ──────────────────────────
  @Get('platforms')
  @ApiOperation({ summary: 'List platforms and launch rules' })
  async getPlatforms() {
    return this.adminService.getPlatforms();
  }

  @Put('platforms/:id')
  @ApiOperation({ summary: 'Update platform config' })
  async updatePlatform(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEcosystemPlatformDto,
  ) {
    return this.adminService.updatePlatform(id, dto, this.getAdminName(req));
  }

  @Post('platforms/launch-rules')
  @ApiOperation({ summary: 'Create platform launch rule' })
  async createLaunchRule(@Req() req: any, @Body() dto: CreatePlatformLaunchRuleDto) {
    return this.adminService.createLaunchRule(dto, this.getAdminName(req));
  }

  @Put('platforms/launch-rules/:id')
  @ApiOperation({ summary: 'Update platform launch rule' })
  async updateLaunchRule(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: UpdatePlatformLaunchRuleDto,
  ) {
    return this.adminService.updateLaunchRule(id, updates, this.getAdminName(req));
  }

  @Delete('platforms/launch-rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete platform launch rule' })
  async deleteLaunchRule(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteLaunchRule(id, this.getAdminName(req));
  }

  // ─── Permission Matrix ─────────────────────────────────
  @Get('permissions')
  @ApiOperation({ summary: 'Get permission roles matrix' })
  async getPermissions() {
    return this.adminService.getPermissions();
  }

  @Put('permissions/:role')
  @ApiOperation({ summary: 'Update permission role matrix' })
  async updatePermissionRole(
    @Req() req: any,
    @Param('role') role: string,
    @Body() dto: UpdatePermissionRoleDto,
  ) {
    return this.adminService.updatePermissionRole(role, dto, this.getAdminName(req));
  }

  // ─── Finance & Billing ─────────────────────────────────
  @Get('finance/payments')
  @ApiOperation({ summary: 'List finance payments' })
  async getPayments(@Query() query: AdminQueryDto) {
    return this.adminService.getPayments(query);
  }

  @Post('finance/payments')
  @ApiOperation({ summary: 'Record payment manually' })
  async recordPayment(@Req() req: any, @Body() dto: RecordPaymentDto) {
    return this.adminService.recordPayment(dto, this.getAdminName(req));
  }

  @Put('finance/payments/:id/status')
  @ApiOperation({ summary: 'Update payment status' })
  async updatePaymentStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.adminService.updatePaymentStatus(id, dto, this.getAdminName(req));
  }

  @Get('finance/revenue')
  @ApiOperation({ summary: 'List revenue logs' })
  async getRevenue(@Query() query: AdminQueryDto) {
    return this.adminService.getRevenue(query);
  }

  // ─── Communication ─────────────────────────────────────
  @Get('communication/notifications')
  @ApiOperation({ summary: 'List broadcast notifications' })
  async getNotifications(@Query() query: AdminQueryDto) {
    return this.adminService.getNotifications(query);
  }

  @Post('communication/notifications')
  @ApiOperation({ summary: 'Create broadcast notification' })
  async createNotification(@Req() req: any, @Body() dto: CreateBroadcastNotificationDto) {
    return this.adminService.createNotification(dto, this.getAdminName(req));
  }

  @Put('communication/notifications/:id')
  @ApiOperation({ summary: 'Update broadcast notification' })
  async updateNotification(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: UpdateBroadcastNotificationDto,
  ) {
    return this.adminService.updateNotification(id, updates, this.getAdminName(req));
  }

  @Delete('communication/notifications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete broadcast notification' })
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteNotification(id, this.getAdminName(req));
  }

  @Get('communication/tickets')
  @ApiOperation({ summary: 'List support tickets' })
  async getTickets(@Query() query: AdminQueryDto) {
    return this.adminService.getTickets(query);
  }

  @Put('communication/tickets/:id')
  @ApiOperation({ summary: 'Update support ticket status' })
  async updateTicket(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.adminService.updateTicket(id, dto, this.getAdminName(req));
  }

  // ─── System Audit & Settings ──────────────────────────
  @Get('system/audit-logs')
  @ApiOperation({ summary: 'List system audit logs' })
  async getAuditLogs(@Query() query: AdminQueryDto) {
    return this.adminService.getAuditLogs(query);
  }

  @Post('system/audit-logs/clear')
  @ApiOperation({ summary: 'Clear system audit logs with confirmation' })
  async clearAuditLogs(@Req() req: any, @Body() body: ClearAuditLogsDto) {
    return this.adminService.clearAuditLogs(body, this.getAdminName(req));
  }

  @Get('system/settings')
  @ApiOperation({ summary: 'Get global system settings' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Put('system/settings')
  @ApiOperation({ summary: 'Update global system settings' })
  async updateSettings(@Body() dto: UpdateSystemSettingsDto) {
    return this.adminService.updateSettings(dto);
  }

  // ─── Localities (Boroughs, High Streets, Local Malls) ─
  @Get('localities/boroughs')
  @ApiOperation({ summary: 'List boroughs' })
  async getBoroughs() {
    return this.adminService.getBoroughs();
  }

  @Post('localities/boroughs')
  @ApiOperation({ summary: 'Create borough' })
  async createBorough(@Req() req: any, @Body() dto: CreateBoroughDto) {
    return this.adminService.createBorough(dto, this.getAdminName(req));
  }

  @Put('localities/boroughs/:id')
  @ApiOperation({ summary: 'Update borough' })
  async updateBorough(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: UpdateBoroughDto,
  ) {
    return this.adminService.updateBorough(id, updates, this.getAdminName(req));
  }

  @Delete('localities/boroughs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete borough' })
  async deleteBorough(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteBorough(id, this.getAdminName(req));
  }

  @Get('localities/high-streets')
  @ApiOperation({ summary: 'List high streets' })
  async getHighStreets() {
    return this.adminService.getHighStreets();
  }

  @Post('localities/high-streets')
  @ApiOperation({ summary: 'Create high street' })
  async createHighStreet(@Req() req: any, @Body() dto: CreateHighStreetDto) {
    return this.adminService.createHighStreet(dto, this.getAdminName(req));
  }

  @Put('localities/high-streets/:id')
  @ApiOperation({ summary: 'Update high street' })
  async updateHighStreet(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: UpdateHighStreetDto,
  ) {
    return this.adminService.updateHighStreet(id, updates, this.getAdminName(req));
  }

  @Delete('localities/high-streets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete high street' })
  async deleteHighStreet(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteHighStreet(id, this.getAdminName(req));
  }

  @Get('localities/local-malls')
  @ApiOperation({ summary: 'List local malls' })
  async getLocalMalls() {
    return this.adminService.getLocalMalls();
  }

  @Post('localities/local-malls')
  @ApiOperation({ summary: 'Create local mall' })
  async createLocalMall(@Req() req: any, @Body() dto: CreateLocalMallDto) {
    return this.adminService.createLocalMall(dto, this.getAdminName(req));
  }

  @Put('localities/local-malls/:id')
  @ApiOperation({ summary: 'Update local mall configuration' })
  async updateLocalMall(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updates: UpdateLocalMallDto,
  ) {
    return this.adminService.updateLocalMall(id, updates, this.getAdminName(req));
  }

  @Delete('localities/local-malls/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete local mall' })
  async deleteLocalMall(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteLocalMall(id, this.getAdminName(req));
  }
}
