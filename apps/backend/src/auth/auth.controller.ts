import { Controller, Post, Get, Put, Body, UseGuards, Request, Res, Query, UnauthorizedException, ServiceUnavailableException, ForbiddenException, BadRequestException, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiCreatedResponse, ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthService } from './google-oauth.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

import { RegisterDto } from './dto/register.dto';
import { EmailDto } from './dto/email.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CheckEmailQueryDto } from './dto/check-email-query.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { userProfileSelect } from './profile-selects';
import type { Response } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
    private googleOAuth: GoogleOAuthService,
    private configService: ConfigService,
  ) { }

  private getRequestMeta(req: any): { userAgent?: string; ip?: string } {
    return {
      userAgent: req?.headers?.['user-agent'] ?? null,
      ip: req?.ip ?? req?.socket?.remoteAddress ?? null,
    };
  }

  /**
   * Phase 3: `mcom_session` lifetime mirrors the access TTL (15m spec).
   * The refresh token is kept in the response body (existing frontend
   * contract) plus a httpOnly cookie.
   */
  private setAuthCookies(res: Response, result: { accessToken: string; refreshToken: string }) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('mcom_session', result.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: this.authService.getAccessCookieMaxAgeMs(),
    });
    res.cookie('mcom_refresh', result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — mirrors JWT_REFRESH_TTL default
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'User registered successfully' })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response, @Req() req: any) {
    const confirmPassword = registerDto.confirm_password ?? registerDto.confirmPassword;
    if (confirmPassword !== undefined && confirmPassword !== registerDto.password) {
      throw new BadRequestException('Passwords do not match');
    }

    const normalizedRole = (registerDto.role || 'BUSINESS').toUpperCase().replace('-', '_');
    let result;
    if (normalizedRole === 'CUSTOMER') {
      result = await this.authService.registerCustomer(registerDto);
    } else if (['AGENT', 'CONSULTANT', 'ACCOUNT_MANAGER'].includes(normalizedRole)) {
      result = await this.authService.registerAffiliate(registerDto);
    } else {
      result = await this.authService.registerBusiness(registerDto);
    }

    this.setAuthCookies(res, result);

    return result;
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('check-email')
  @ApiOperation({ summary: 'Check whether an email is already registered' })
  @ApiOkResponse({ description: 'Email existence flag' })
  async checkEmail(@Query() query: CheckEmailQueryDto) {
    if (!query.email) return { exists: false };
    const user = await this.prisma.user.findUnique({
      where: { email: query.email.toLowerCase().trim() },
    });
    return { exists: !!user };
  }

  @Throttle({ default: { limit: 15, ttl: 60000, blockDuration: 60000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } })
  @ApiOkResponse({ description: 'Authenticated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Request() req: any, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.login(req.user, this.getRequestMeta(req));

    this.setAuthCookies(res, result);

    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token (rotation + reuse detection)' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ description: 'New token pair issued' })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or reused refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response, @Req() req: any) {
    const result = await this.authService.refreshTokens(dto.refreshToken, this.getRequestMeta(req));
    this.setAuthCookies(res, result);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh session(s) and clear auth cookies' })
  @ApiBody({ type: RefreshTokenDto, required: false, description: 'Omit to revoke all sessions (logout everywhere)' })
  @ApiOkResponse({ description: 'Logged out successfully' })
  async logout(@Request() req: any, @Body() dto: RefreshTokenDto | Record<string, never>, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (dto as RefreshTokenDto)?.refreshToken ?? req.cookies?.['mcom_refresh'];
    await this.authService.logout(req.user.userId, refreshToken);
    res.clearCookie('mcom_session');
    res.clearCookie('mcom_refresh');
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    // Phase 6: minimal select — password/tokenVersion never leave SQL.
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: userProfileSelect,
    });
    if (!user) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user settings' })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({ description: 'Settings updated' })
  async updateSettings(@Request() req: any, @Body() body: UpdateSettingsDto) {
    return this.authService.updateSettings(req.user.userId, body);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-otp')
  @ApiOperation({ summary: 'Send email verification OTP' })
  @ApiBody({ type: EmailDto })
  @ApiOkResponse({ description: 'OTP sent' })
  async sendOtp(@Body() dto: EmailDto) {
    return this.authService.sendOtp(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend email verification OTP' })
  @ApiBody({ type: EmailDto })
  @ApiOkResponse({ description: 'OTP resent' })
  async resendOtp(@Body() dto: EmailDto) {
    return this.authService.resendOtp(dto.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify email OTP (single-use, 10 min expiry)' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({ description: 'OTP validity flag' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const isValid = await this.authService.verifyOtp(dto.email, dto.code);
    return { valid: isValid };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password-reset code' })
  @ApiBody({ type: EmailDto })
  @ApiOkResponse({ description: 'Reset code sent' })
  async forgotPassword(@Body() dto: EmailDto) {
    return this.authService.sendForgotPasswordCode(dto.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with emailed code (invalidates sessions)' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ description: 'Password reset successfully' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sso/token')
  async getSsoToken(@Request() req: any, @Query('target_client_id') targetClientId?: string) {
    return this.authService.generateSsoToken(req.user.userId, targetClientId);
  }

  @Get('google')
  async googleAuth(@Res() res: any, @Query('returnUrl') returnUrl?: string) {
    if (!this.googleOAuth.isConfigured()) {
      if (this.googleOAuth.isSimulatorEnabled()) {
        const baseUrl = this.configService.get('APP_URL') || 'http://localhost:3010';
        return res.redirect(`${baseUrl}/api/v1/auth/google/simulator`);
      }
      throw new ServiceUnavailableException('Google Sign-In is not configured');
    }
    // Real OAuth redirect — state is HMAC-signed and short-lived so it cannot be forged
    const authUrl = this.googleOAuth.getAuthUrl(
      this.googleOAuth.signState({ type: 'login', returnUrl }),
    );
    return res.redirect(authUrl);
  }

  @Get('google/simulator')
  async googleSimulator(@Res() res: any) {
    if (!this.googleOAuth.isSimulatorEnabled()) {
      throw new ForbiddenException('Google login simulator is disabled');
    }
    const users = await this.prisma.user.findMany({ take: 5 });
    const options = users
      .map((u) => {
        const state = this.googleOAuth.signState({ type: 'sim-login', email: u.email });
        return `<option value="${state}">${u.email} (${u.role})</option>`;
      })
      .join('');
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Login Simulator</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; }
        </style>
      </head>
      <body class="bg-gray-50 flex flex-col justify-center items-center min-h-screen p-6">
        <div class="max-w-md w-full bg-white p-8 rounded-4xl shadow-xl border border-gray-100">
          <div class="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl mb-6 mx-auto">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.24.61 4.48 1.64l2.42-2.42C17.3 1.5 14.93 0 12.24 0c-6.07 0-11 4.93-11 11s4.93 11 11 11c5.83 0 11.23-4.14 11.23-11 0-.7-.08-1.37-.23-1.715h-11z"/></svg>
          </div>
          <h1 class="text-2xl font-black text-center mb-2">Google Sign-In</h1>
          <p class="text-gray-500 text-sm text-center mb-8">Select a mock account to authenticate. This simulator is development-only.</p>
          <form action="/api/v1/business/google/callback" method="GET" class="space-y-6">
            <input type="hidden" name="code" value="mock-google-code" />
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Mock Accounts Available</label>
              <select name="state" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold">
                ${options}
              </select>
            </div>
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg transition active:scale-95">
              Sign In with Google
            </button>
          </form>
        </div>
      </body>
      </html>
    `);
  }
}
