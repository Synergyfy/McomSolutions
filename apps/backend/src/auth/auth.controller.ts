import { Controller, Post, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
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
  async register(@Body() registerDto: any) {
    if (registerDto.role === 'CUSTOMER') {
      return this.authService.registerCustomer(registerDto);
    }
    return this.authService.registerBusiness(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
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
    await this.authService.sendOtp(email);
    return { success: true };
  }

  @Post('verify-otp')
  async verifyOtp(@Body('email') email: string, @Body('code') code: string) {
    const isValid = await this.authService.verifyOtp(email, code);
    return { valid: isValid };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sso/token')
  async getSsoToken(@Request() req: any) {
    return this.authService.generateSsoToken(req.user.userId);
  }
}
