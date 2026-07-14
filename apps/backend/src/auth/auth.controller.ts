import { Controller, Post, Get, Put, Body, UseGuards, Request, Res, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

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

  @Get('google')
  async googleAuth(@Res() res: any) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const baseUrl = process.env.APP_URL || 'http://localhost:3010';
    if (!clientId) {
      return res.redirect(`${baseUrl}/api/v1/auth/google/simulator`);
    }
    // Real OAuth redirect (if configured)
    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const redirectUri = `${baseUrl}/api/v1/auth/google/callback`;
    const scope = 'openid email profile';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state: 'login_state',
    });
    return res.redirect(`${googleAuthUrl}?${params.toString()}`);
  }

  @Get('google/simulator')
  async googleSimulator(@Res() res: any) {
    const users = await this.prisma.user.findMany({ take: 5 });
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
        <div class="max-w-md w-full bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
          <div class="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl mb-6 mx-auto">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.24.61 4.48 1.64l2.42-2.42C17.3 1.5 14.93 0 12.24 0c-6.07 0-11 4.93-11 11s4.93 11 11 11c5.83 0 11.23-4.14 11.23-11 0-.7-.08-1.37-.23-1.715h-11z"/></svg>
          </div>
          <h1 class="text-2xl font-black text-center mb-2">Google Sign-In</h1>
          <p class="text-gray-500 text-sm text-center mb-8">Select a mock account to authenticate using the Google login simulator.</p>
          <form action="/api/v1/auth/google/callback" method="GET" class="space-y-6">
            <input type="hidden" name="code" value="mock-google-code" />
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Mock Accounts Available</label>
              <select name="state" class="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold">
                ${users.map(u => `<option value="${u.email}">${u.email} (${u.role})</option>`).join('')}
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

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: any,
  ) {
    let email = state;
    if (code !== 'mock-google-code') {
      email = 'owner@mcomsolutions.co.uk';
    }

    let user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          password: 'googleAuthTempPass123!',
          role: Role.BUSINESS,
          firstName: 'Google',
          lastName: 'User',
        }
      });
    }

    const auth = await this.authService.login(user);

    res.cookie('mcom_session', auth.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_LOGIN_SUCCESS',
            auth: ${JSON.stringify(auth)},
            user: ${JSON.stringify(auth.user)}
          }, '*');
          window.close();
        } else {
          document.write("Login successful! Redirecting...");
        }
      </script>
    `);
  }
}
