import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private otps = new Map<string, string>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async sendOtp(email: string): Promise<boolean> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.otps.set(email.toLowerCase(), code);
    
    console.log('\n======================================');
    console.log(`[OTP Engine] 🔑 Verification Code for ${email}: ${code}`);
    console.log('======================================\n');

    // Send email if SMTP is configured in environment variables
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@mcomsolutions.com';

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort || '587'),
          secure: parseInt(smtpPort || '587') === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: smtpFrom,
          to: email,
          subject: 'MCOM Solutions - Your Verification Code',
          text: `Your verification code is: ${code}. It is valid for 10 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <h2 style="color: #ea580c; text-align: center; margin-bottom: 20px;">MCOM Solutions</h2>
              <p>Hello,</p>
              <p>We received a request to verify your email address. Please use the following verification code to continue your setup:</p>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #e5e7eb;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">${code}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px;">This code is valid for 10 minutes. If you did not make this request, you can safely ignore this email.</p>
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">© 2026 MCOM Solutions. All rights reserved.</p>
            </div>
          `,
        });
        console.log(`[SMTP Mailer] ✉️ Verification email sent successfully to ${email}`);
      } catch (err) {
        console.error('[SMTP Mailer] ❌ Failed to send verification email:', err);
      }
    } else {
      console.log('[SMTP Mailer] ⚠️ SMTP variables are missing. Falling back to local logging.');
    }
    
    return true;
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const savedCode = this.otps.get(email.toLowerCase());
    if (savedCode && savedCode === code) {
      this.otps.delete(email.toLowerCase());
      return true;
    }
    return false;
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

    // Create user and business profile
    const newUser = await this.prisma.user.create({
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
      },
      include: {
        businessProfile: true,
      },
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

    const newUser = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: Role.CUSTOMER,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
      },
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

  async generateSsoToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { businessProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const name = user.businessProfile?.businessName || user.email.split('@')[0];
    const role = user.role === Role.BUSINESS ? 'business' : 'customer';

    const payload = {
      iss: 'mcom-loyalty',
      aud: 'mcom-mall',
      sub: user.id,
      email: user.email,
      name,
      role,
      phoneNumber: user.businessProfile?.phone || null,
      postcode: user.businessProfile?.postcode || null,
      address: user.businessProfile?.address || null,
    };

    const ssoToken = this.jwtService.sign(payload, {
      secret: process.env.SSO_SECRET || 'shared-sso-secret',
      expiresIn: '60s',
    });

    return { ssoToken };
  }
}
