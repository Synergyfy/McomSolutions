
import { Controller, Get, Post, Query, Body, Req, Res, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SsoService } from './sso.service';
import { SsoClientGuard } from './guards/sso-client.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiOkResponse, ApiCreatedResponse, ApiBearerAuth, ApiBadRequestResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SsoAuthorizeDto } from './dto/sso-authorize.dto';
import { SsoTokenDto } from './dto/sso-token.dto';
import { SsoTokenRefreshDto } from './dto/sso-token-refresh.dto';
import { SsoClientRegisterDto } from './dto/sso-client-register.dto';

@ApiTags('SSO (Single Sign-On)')
@Controller('auth')
export class SsoController {
  constructor(
    private readonly ssoService: SsoService,
    private readonly configService: ConfigService,
  ) { }

  @Get('sso/authorize')
  @ApiOperation({ summary: 'Browser redirection target for SSO authorization flow' })
  @ApiQuery({ name: 'client_id', example: 'mcom-mall', description: 'OAuth client ID' })
  @ApiQuery({ name: 'redirect_uri', example: 'https://mcommall.vercel.app/auth/callback', description: 'Redirect URI' })
  @ApiQuery({ name: 'state', example: 'xyz123', description: 'Client state' })
  @ApiQuery({ name: 'scope', required: false, example: 'profile email', description: 'Space-separated scopes' })
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('state') state: string,
    @Query('scope') scope: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!clientId || !redirectUri || !state) {
      throw new BadRequestException('client_id, redirect_uri, and state are required parameters');
    }

    const client = await this.ssoService.getClientByClientId(clientId);
    if (!client || !client.isActive) {
      throw new BadRequestException('Invalid or inactive client');
    }

    if (!client.redirectUris.includes(redirectUri)) {
      throw new BadRequestException('Redirect URI is not registered');
    }

    // Check for mcom_session cookie
    const sessionCookie = req.cookies?.['mcom_session'];
    let userId: string | null = null;

    if (sessionCookie) {
      try {
        const payload = await this.ssoService.getUserInfoFromToken(sessionCookie);
        userId = payload.sub;
      } catch (e) {
        // Cookie invalid or expired
      }
    }

    const scopes = scope ? scope.split(' ') : ['profile', 'email'];

    if (userId) {
      // Already authenticated, generate auth code and redirect back to client app
      const code = await this.ssoService.generateAuthCode(userId, clientId, redirectUri, scopes);
      return res.redirect(`${redirectUri}?code=${code}&state=${state}`);
    }

    // Not authenticated, redirect to central login page
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const loginUrl = `${frontendUrl}/login?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scopes.join(' '))}`;
    return res.redirect(loginUrl);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('sso/authorize')
  @ApiOperation({ summary: 'Request authorization code after user login' })
  @ApiBody({ type: SsoAuthorizeDto })
  @ApiCreatedResponse({ description: 'Authorization code generated successfully' })
  async postAuthorize(
    @Body() dto: SsoAuthorizeDto,
    @Req() req: any,
  ) {
    const scopes = dto.scope ? dto.scope.split(' ') : ['profile', 'email'];
    const code = await this.ssoService.generateAuthCode(req.user.userId, dto.client_id, dto.redirect_uri, scopes);
    return { code };
  }

  @UseGuards(SsoClientGuard)
  @Post('sso/token')
  @ApiOperation({ summary: 'Exchange authorization code for access and refresh tokens (called by partner backend)' })
  @ApiBody({ type: SsoTokenDto })
  @ApiCreatedResponse({ description: 'Tokens issued successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid code or client credentials' })
  async exchangeToken(
    @Body() dto: SsoTokenDto,
  ) {
    return this.ssoService.exchangeCodeForTokens(dto.code, dto.client_id, dto.redirect_uri);
  }

  @Post('sso/token/refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: SsoTokenRefreshDto })
  @ApiOkResponse({ description: 'New tokens issued successfully' })
  async refreshToken(@Body() dto: SsoTokenRefreshDto) {
    return this.ssoService.refreshSsoToken(dto.refresh_token);
  }

  @Post('sso/logout')
  @ApiOperation({ summary: 'Logout SSO session' })
  @ApiBody({ schema: { type: 'object', properties: { access_token: { type: 'string' } } } })
  @ApiOkResponse({ description: 'Logged out successfully' })
  async logout(@Body('access_token') accessToken: string, @Res() res: Response) {
    if (!accessToken) {
      throw new BadRequestException('access_token is required');
    }
    await this.ssoService.logout(accessToken);

    // Also clear the central session cookie
    res.clearCookie('mcom_session');
    return res.json({ success: true });
  }

  @Get('sso/userinfo')
  @ApiOperation({ summary: 'Fetch user profile using Bearer access token' })
  @ApiOkResponse({ description: 'User profile retrieved successfully' })
  async getUserInfo(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new BadRequestException('Bearer access token is required');
    }
    const token = authHeader.substring(7).trim();
    return this.ssoService.getUserInfoFromToken(token);
  }

  // Admin route to list clients
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('sso/clients')
  @ApiOperation({ summary: 'List all registered SSO clients (Admin only)' })
  @ApiOkResponse({ description: 'SSO Clients retrieved successfully' })
  async listClients(@Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin role required');
    }
    const clients = await this.ssoService.listClients();
    return {
      success: true,
      data: clients,
    };
  }

  // Admin route to register client
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('sso/clients')
  @ApiOperation({ summary: 'Register a new SSO client (Admin only)' })
  @ApiBody({ type: SsoClientRegisterDto })
  @ApiCreatedResponse({ description: 'Client registered successfully' })
  async registerClient(@Req() req: any, @Body() dto: SsoClientRegisterDto) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin role required');
    }
    const client = await this.ssoService.registerClient(dto);
    return {
      success: true,
      data: client,
      message: 'SSO Client registered successfully',
    };
  }
}
