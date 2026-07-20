import { Controller, Post, Body, UnauthorizedException, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-auth.dto';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  record.count++;
  if (record.count > MAX_ATTEMPTS) {
    throw new UnauthorizedException('Too many login attempts. Please try again later.');
  }
}

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin login — validates credentials and ADMIN role' })
  @ApiCreatedResponse({ description: 'Admin authenticated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or not an admin' })
  async login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    checkRateLimit(ip);
    return this.adminService.loginAdmin(dto.email, dto.password);
  }
}
