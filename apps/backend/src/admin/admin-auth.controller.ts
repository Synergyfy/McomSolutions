import { Controller, Post, Body, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiUnauthorizedResponse, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-auth.dto';

// Phase 3: rate limiting is enforced by the global ThrottlerGuard (see
// AppModule) backed by @Throttle() metadata — 429 on excess, shared across
// instances when a Redis store is configured. The previous in-memory Map
// (401, lost on restart) is removed.
@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Admin login — validates credentials and ADMIN role' })
  @ApiCreatedResponse({ description: 'Admin authenticated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or not an admin' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminService.loginAdmin(dto.email, dto.password);
  }
}
