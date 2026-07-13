import { Controller, Post, Get, Put, Body, UseGuards, Request, Res, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: any, @Res({ passthrough: true }) res: any) {
    let result;
    if (registerDto.role === 'CUSTOMER') {
      result = await this.authService.registerCustomer(registerDto);
    } else {
      result = await this.authService.registerBusiness(registerDto);
    }

    res.cookie('mcom_session', result.accessToken, {
      httpOnly: true,
      secure: false, // In local development HTTP is fine; set secure in prod if HTTPS
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return result;
  }

  @Get('check-email')
  async checkEmail(@Query('email') email: string) {
    if (!email) return { exists: false };
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return { exists: !!user };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.login(req.user);

    res.cookie('mcom_session', result.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { businessProfile: { include: { packages: true } } },
    });
    const { password, ...result } = user;
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  async updateSettings(@Request() req: any, @Body() body: any) {
    return this.authService.updateSettings(req.user.userId, body);
  }

  @Post('send-otp')
  async sendOtp(@Body('email') email: string) {
    return this.authService.sendOtp(email);
  }

  @Post('resend-otp')
  async resendOtp(@Body('email') email: string) {
    return this.authService.resendOtp(email);
  }

  @Post('verify-otp')
  async verifyOtp(@Body('email') email: string, @Body('code') code: string) {
    const isValid = await this.authService.verifyOtp(email, code);
    return { valid: isValid };
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.sendForgotPasswordCode(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: any) {
    await this.authService.resetPassword(body);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sso/token')
  async getSsoToken(@Request() req: any, @Query('target_client_id') targetClientId?: string) {
    return this.authService.generateSsoToken(req.user.userId, targetClientId);
  }
}
