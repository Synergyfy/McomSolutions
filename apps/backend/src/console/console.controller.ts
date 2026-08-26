import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsoleAdminGuard } from './guards/console-admin.guard';
import { ConsoleService } from './console.service';
import { RegisterAppDto } from './dto/register-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { RotateSecretDto } from './dto/rotate-secret.dto';
import { ConsoleAuditQueryDto } from './dto/console-audit-query.dto';

@ApiTags('Mcom Console')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ConsoleAdminGuard, ThrottlerGuard)
@Controller('admin/console')
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) {}

  @Post('apps')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new application and generate one-time credentials' })
  @ApiBody({ type: RegisterAppDto })
  @ApiCreatedResponse({ description: 'App registered. One-time credentials returned in plainSecrets.' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Client ID or platform slug already exists' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  registerApp(@Body() dto: RegisterAppDto, @Req() req: Request) {
    return this.consoleService.registerApp(dto, (req.user as any).userId, req);
  }

  @Get('apps')
  @ApiOperation({ summary: 'List all registered applications' })
  @ApiOkResponse({ description: 'List of registered applications (secrets masked)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  listApps() {
    return this.consoleService.listApps();
  }

  @Get('apps/:clientId')
  @ApiOperation({ summary: 'Get app detail with masked secrets' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiOkResponse({ description: 'App detail with masked secrets' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  getApp(@Param('clientId') clientId: string) {
    return this.consoleService.getApp(clientId);
  }

  @Patch('apps/:clientId')
  @ApiOperation({ summary: 'Update app configuration (PATCH semantics)' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiBody({ type: UpdateAppDto })
  @ApiOkResponse({ description: 'App updated' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiConflictResponse({ description: 'Platform slug already in use' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  updateApp(@Param('clientId') clientId: string, @Body() dto: UpdateAppDto, @Req() req: Request) {
    return this.consoleService.updateApp(clientId, dto, (req.user as any).userId, req);
  }

  @Delete('apps/:clientId')
  @ApiOperation({ summary: 'Deactivate (soft-delete) an application' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiOkResponse({ description: 'App deactivated and its SSO sessions invalidated' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiForbiddenResponse({ description: 'System apps cannot be deactivated' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  deactivateApp(@Param('clientId') clientId: string, @Req() req: Request) {
    return this.consoleService.deactivateApp(clientId, (req.user as any).userId, req);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('apps/:clientId/rotate-secret')
  @ApiOperation({ summary: 'Rotate the OAuth client secret (shown once)' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiBody({ type: RotateSecretDto })
  @ApiOkResponse({ description: 'New client secret generated (shown once)' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (5 requests/minute)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  rotateClientSecret(
    @Param('clientId') clientId: string,
    @Body() dto: RotateSecretDto,
    @Req() req: Request,
  ) {
    return this.consoleService.rotateClientSecret(clientId, (req.user as any).userId, req);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('apps/:clientId/rotate-api-key')
  @ApiOperation({ summary: 'Rotate the Data-Sharing API key (shown once)' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiBody({ type: RotateSecretDto })
  @ApiOkResponse({ description: 'New API key generated (shown once)' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (5 requests/minute)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  rotateApiKey(@Param('clientId') clientId: string, @Body() dto: RotateSecretDto, @Req() req: Request) {
    return this.consoleService.rotateApiKey(clientId, (req.user as any).userId, req);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('apps/:clientId/rotate-hmac')
  @ApiOperation({ summary: 'Rotate the HMAC signing secret (shown once)' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiBody({ type: RotateSecretDto })
  @ApiOkResponse({ description: 'New HMAC secret generated (shown once)' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (5 requests/minute)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  rotateHmacSecret(@Param('clientId') clientId: string, @Body() dto: RotateSecretDto, @Req() req: Request) {
    return this.consoleService.rotateHmacSecret(clientId, (req.user as any).userId, req);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('apps/:clientId/rotate-webhook-secret')
  @ApiOperation({ summary: 'Rotate the webhook signing secret (shown once)' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiBody({ type: RotateSecretDto })
  @ApiOkResponse({ description: 'New webhook secret generated (shown once)' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (5 requests/minute)' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  rotateWebhookSecret(
    @Param('clientId') clientId: string,
    @Body() dto: RotateSecretDto,
    @Req() req: Request,
  ) {
    return this.consoleService.rotateWebhookSecret(clientId, (req.user as any).userId, req);
  }

  @Get('apps/:clientId/health')
  @ApiOperation({ summary: 'Ping the app billingApiUrl and report latency' })
  @ApiParam({ name: 'clientId', example: 'mcom-vcard' })
  @ApiOkResponse({ description: 'Health ping result with reachability and latency' })
  @ApiNotFoundResponse({ description: 'App not found' })
  @ApiBadRequestResponse({ description: 'App has no billingApiUrl configured' })
  @ApiBadGatewayResponse({ description: 'billingApiUrl is unreachable' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  pingAppHealth(@Param('clientId') clientId: string) {
    return this.consoleService.pingAppHealth(clientId);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List console audit logs with filters' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Items per page' })
  @ApiQuery({ name: 'clientId', required: false, example: 'mcom-vcard', description: 'Filter by app clientId' })
  @ApiQuery({ name: 'action', required: false, example: 'rotate_client_secret', description: 'Filter by action type' })
  @ApiOkResponse({ description: 'Paginated list of audit logs' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  listAuditLogs(@Query() query: ConsoleAuditQueryDto) {
    return this.consoleService.listAuditLogs(query);
  }
}