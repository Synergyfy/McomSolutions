import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private isMockOtp(): boolean {
    const mockEnabled = this.config.get<string>('MOCK_OTP') === 'true';
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    // Mock mode is a development convenience only — never enabled in production.
    return mockEnabled && !isProduction;
  }

  private generateNumericCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  private async sendCodeEmail(
    email: string,
    code: string,
    subject: string,
    intro: string,
  ): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM') || 'MCOM Solutions <no-reply@mcomsolutions.com>';
    const smtpFrom = this.config.get<string>('SMTP_FROM') || 'no-reply@mcomsolutions.com';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #ea580c; text-align: center; margin-bottom: 20px;">MCOM Solutions</h2>
        <p>Hello,</p>
        <p>${intro}</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #e5e7eb;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code is valid for 10 minutes. If you did not make this request, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© 2026 MCOM Solutions. All rights reserved.</p>
      </div>
    `;

    // Preferred path: Resend transactional email API (RESEND_API_KEY configured).
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        const response = await axios.post(
          'https://api.resend.com/emails',
          { from, to: [email], subject, html },
          {
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          },
        );
        this.logger.log(`[Resend] Email sent to ${email} (id=${response.data?.id ?? 'n/a'})`);
        return;
      } catch (err) {
        this.logger.error('[Resend] Failed to send email, falling back to SMTP:', err as any);
      }
    } else {
      this.logger.debug('[Resend] RESEND_API_KEY not set — using SMTP fallback.');
    }

    // Fallback: SMTP via nodemailer (legacy/dev path).
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = this.config.get<string>('SMTP_PORT');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS')
      ? this.config.get<string>('SMTP_PASS')!.replace(/\s+/g, '')
      : undefined;

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn('SMTP variables are missing — verification code was not emailed.');
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587', 10),
        secure: parseInt(smtpPort || '587', 10) === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject,
        text: `Your code is: ${code}. It is valid for 10 minutes.`,
        html,
      });
      this.logger.log(`[SMTP Mailer] Email sent successfully to ${email}`);
    } catch (err) {
      this.logger.error('[SMTP Mailer] Failed to send email:', err as any);
    }
  }

  async sendOtp(email: string): Promise<{ success: boolean; code?: string; mode: 'mock' | 'email' }> {
    const normalizedEmail = email.toLowerCase().trim();
    const isMock = this.isMockOtp();
    const code = this.generateNumericCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    // OTP codes are persisted in the DB (survives restart / multi-instance).
    // Invalidate any previously issued, still-open OTP for this email.
    await this.prisma.passwordResetCode.updateMany({
      where: { email: normalizedEmail, purpose: 'OTP', used: false },
      data: { used: true },
    });

    await this.prisma.passwordResetCode.create({
      data: {
        email: normalizedEmail,
        purpose: 'OTP',
        code,
        expiresAt,
        used: false,
      },
    });

    if (isMock) {
      // Dev-only convenience: log the code so it can be read in the terminal.
      this.logger.debug(`[OTP] Verification code for ${normalizedEmail}: ${code}`);
    } else {
      await this.sendCodeEmail(
        normalizedEmail,
        code,
        'MCOM Solutions - Your Verification Code',
        'We received a request to verify your email address. Please use the following verification code to continue your setup:',
      );
    }

    return {
      success: true,
      mode: isMock ? 'mock' : 'email',
      ...(isMock ? { code } : {}),
    };
  }

  async resendOtp(email: string): Promise<{ success: boolean; code?: string; mode: 'mock' | 'email' }> {
    return this.sendOtp(email);
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();

    const record = await this.prisma.passwordResetCode.findFirst({
      where: {
        email: normalizedEmail,
        purpose: 'OTP',
        used: false,
        code,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return false;
    }

    // One-time use — consume the code.
    await this.prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { used: true },
    });
    return true;
  }

  async sendForgotPasswordCode(email: string): Promise<{ success: boolean; resetCode?: string; mode: 'mock' | 'email' }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new ConflictException('User with this email does not exist');
    }

    const isMock = this.isMockOtp();
    const code = this.generateNumericCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    // Invalidate any previously issued, still-open reset code for this user.
    await this.prisma.passwordResetCode.updateMany({
      where: { email: normalizedEmail, purpose: 'PASSWORD_RESET', used: false },
      data: { used: true },
    });

    await this.prisma.passwordResetCode.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        purpose: 'PASSWORD_RESET',
        code,
        expiresAt,
        used: false,
      },
    });

    if (isMock) {
      this.logger.debug(`[Reset Password] Reset code for ${normalizedEmail}: ${code}`);
    } else {
      await this.sendCodeEmail(
        normalizedEmail,
        code,
        'MCOM Solutions - Reset Your Password',
        'We received a request to reset your password. Please use the following code to continue:',
      );
    }

    return {
      success: true,
      mode: isMock ? 'mock' : 'email',
      ...(isMock ? { resetCode: code } : {}),
    };
  }

  async verifyResetCode(email: string, code: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();

    const record = await this.prisma.passwordResetCode.findFirst({
      where: {
        email: normalizedEmail,
        purpose: 'PASSWORD_RESET',
        used: false,
        code,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return false;
    }

    // One-time use — consume the code.
    await this.prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { used: true },
    });
    return true;
  }

  async resetPassword(data: any): Promise<boolean> {
    const email = data.email ? data.email.toLowerCase().trim() : '';
    const code = data.code;
    const newPassword = data.newPassword;

    const isValid = await this.verifyResetCode(email, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { email },
      data: { password: passwordHash },
    });

    return true;
  }

  async validateUser(email: string, password?: string): Promise<any> {
    const normalizedEmail = email ? email.toLowerCase().trim() : '';
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { businessProfile: true },
    });

    if (user && password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    const businessId = user.businessProfile?.id || null;
    const name = user.businessProfile?.businessName || user.email.split('@')[0];

    // Fetch active platform packages for this business
    let activePlans: any[] = [];
    if (businessId) {
      const now = new Date();
      const packages = await this.prisma.platformPackage.findMany({
        where: {
          businessId,
          status: 'active',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        select: {
          platform: true,
          externalPlanId: true,
          planName: true,
          planType: true,
          expiresAt: true,
          billingCycle: true,
          amount: true,
          currency: true,
        },
      });

      activePlans = packages.map((p) => ({
        platform: p.platform,
        planId: p.externalPlanId,
        planName: p.planName,
        planType: p.planType,
        expiresAt: p.expiresAt,
        billingCycle: p.billingCycle,
        amount: p.amount,
        currency: p.currency,
      }));
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name,
      businessId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      auth: {
        accessToken,
        refreshToken,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name,
        businessId,
        isOnboarded: !!businessId,
        activePlans,
      },
    };
  }

  async registerBusiness(data: any) {
    const email = data.email ? data.email.toLowerCase().trim() : '';
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(data.password || 'password123', salt);

    // Create user, business profile, and wallet atomically
    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          role: Role.BUSINESS,
          businessProfile: {
            create: {
              businessName: data.businessName || 'My New Business',
              businessType: data.businessType || 'retail',
              country: data.country || 'United Kingdom',
              phone: data.phone || '',
              email: email,
              isOnGoogle: data.isOnGoogle || false,
              googlePlaceId: data.googlePlaceId || null,
              address: data.address || '',
              postcode: data.postcode || '',
              industry: data.industry || '',
              category: data.category || '',
              description: data.description || '',
              website: data.website || '',
              openingHours: data.openingHours || '',
              socialMedia: data.socialMedia || '',
            },
          },
          wallet: {
            create: { balance: 0, currency: 'MCOM', status: 'ACTIVE' },
          },
        },
        include: {
          businessProfile: true,
        },
      });
      return user;
    });

    return this.login(newUser);
  }

  async registerCustomer(data: any) {
    const email = data.email ? data.email.toLowerCase().trim() : '';
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(data.password || 'password123', salt);

    // Create user + wallet atomically
    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          role: Role.CUSTOMER,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          wallet: {
            create: { balance: 0, currency: 'MCOM', status: 'ACTIVE' },
          },
          customerProfile: {
            create: {},
          },
        },
      });
      return user;
    });

    return this.login(newUser);
  }

  async updateSettings(userId: string, updates: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: updates.firstName !== undefined ? updates.firstName : undefined,
        lastName: updates.lastName !== undefined ? updates.lastName : undefined,
        jobTitle: updates.jobTitle !== undefined ? updates.jobTitle : undefined,
        twoFactorEnabled: updates.twoFactorEnabled !== undefined ? updates.twoFactorEnabled : undefined,
        emailNotifications: updates.emailNotifications !== undefined ? updates.emailNotifications : undefined,
        smsNotifications: updates.smsNotifications !== undefined ? updates.smsNotifications : undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        twoFactorEnabled: true,
        emailNotifications: true,
        smsNotifications: true,
      }
    });
  }

  async generateSsoToken(userId: string, targetClientId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { businessProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const name = user.businessProfile?.businessName || user.email.split('@')[0];
    const role = user.role === Role.BUSINESS ? 'business' : 'customer';
    const issuer = this.config.get<string>('MCOM_CENTRAL_ISSUER') || 'mcom-central';

    // Fetch active platform packages for the platforms claim
    const businessId = user.businessProfile?.id;
    const platforms: Record<string, { planId: string; expiresAt: string | null }> = {};

    if (businessId) {
      const now = new Date();
      const packages = await this.prisma.platformPackage.findMany({
        where: {
          businessId,
          status: 'active',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        select: {
          platform: true,
          externalPlanId: true,
          expiresAt: true,
        },
      });

      for (const p of packages) {
        platforms[p.platform] = {
          planId: p.externalPlanId,
          expiresAt: p.expiresAt?.toISOString() || null,
        };
      }
    }

    const payload = {
      iss: issuer,
      aud: targetClientId || 'mcom-ecosystem',
      sub: user.id,
      email: user.email,
      name,
      role,
      phoneNumber: user.businessProfile?.phone || null,
      postcode: user.businessProfile?.postcode || null,
      address: user.businessProfile?.address || null,
      platforms,
    };

    const secret =
      this.config.get<string>('SSO_SECRET') ||
      this.config.get<string>('SSO_JWT_SECRET') ||
      this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('SSO_SECRET (or SSO_JWT_SECRET / JWT_SECRET) must be configured.');
    }

    const ssoToken = this.jwtService.sign(payload, {
      secret,
      expiresIn: '60s',
    });

    return { ssoToken };
  }
}