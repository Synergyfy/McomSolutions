import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
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
import { RegisterDto } from './dto/register.dto';
import { hashRefreshToken, parseTtlSeconds } from './refresh-session.util';
import { rethrowAsConflictOnUniqueViolation } from '../common/prisma-errors.util';
import { RedisService } from '../redis/redis.service';
import {
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
  OtpPurpose,
  OtpRecord,
  hashOtp,
  normalizeOtpEmail,
  otpCooldownKey,
  otpKey,
  verifyOtpHash,
} from './otp.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private _smtpTransporter: nodemailer.Transporter | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private redis: RedisService,
  ) {}

  private getSmtpTransporter(): nodemailer.Transporter | null {
    if (this._smtpTransporter) {
      return this._smtpTransporter;
    }
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = this.config.get<string>('SMTP_PORT');
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS')
      ? this.config.get<string>('SMTP_PASS')!.replace(/\s+/g, '')
      : undefined;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return null;
    }

    this._smtpTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '587', 10),
      secure: parseInt(smtpPort || '587', 10) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    return this._smtpTransporter;
  }

  private isMockOtp(): boolean {
    const mockEnabled = this.config.get<string>('MOCK_OTP') === 'true';
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    // Mock mode is a development convenience only — never enabled in production.
    return mockEnabled && !isProduction;
  }

  private generateNumericCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Server-side pepper for OTP HMAC hashing. Plain SHA-256 of a 6-digit code
   * is brute-forceable (1M combos) — the pepper makes offline attacks infeasible.
   * Production fails closed when OTP_PEPPER is missing (see AppModule.validateEnv);
   * non-production falls back to JWT_SECRET, then a dev-only constant.
   */
  private getOtpPepper(): string {
    const pepper = this.config.get<string>('OTP_PEPPER') ?? process.env.OTP_PEPPER;
    if (pepper && pepper.trim() !== '') return pepper;
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production' || process.env.NODE_ENV === 'production';
    if (isProduction) {
      throw new Error('OTP_PEPPER environment variable is required in production.');
    }
    return (
      this.config.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET ?? 'dev-otp-pepper'
    );
  }

  /**
   * Fail-closed in production when Redis is down — an in-memory fallback does
   * not coordinate across instances and must not silently accept OTP traffic.
   * Non-production (dev/test) uses RedisService's in-memory fallback.
   */
  private ensureOtpStoreAvailable(): void {
    if (process.env.NODE_ENV === 'test') return;
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production' || process.env.NODE_ENV === 'production';
    if (isProduction && !this.redis.isAvailable()) {
      throw new ServiceUnavailableException('Verification service temporarily unavailable');
    }
  }

  private async storeOtpCode(purpose: OtpPurpose, email: string, code: string): Promise<void> {
    const normalizedEmail = normalizeOtpEmail(email);
    const record: OtpRecord = { h: hashOtp(code, this.getOtpPepper()), attempts: 0 };
    await this.redis.set(otpKey(purpose, normalizedEmail), record, OTP_TTL_SECONDS);
    await this.redis.set(
      otpCooldownKey(purpose, normalizedEmail),
      { issuedAt: Date.now() },
      OTP_COOLDOWN_SECONDS,
    );
  }

  private async verifyOtpCode(purpose: OtpPurpose, email: string, code: string): Promise<boolean> {
    const normalizedEmail = normalizeOtpEmail(email);
    this.ensureOtpStoreAvailable();
    const key = otpKey(purpose, normalizedEmail);
    const record = await this.redis.get<OtpRecord>(key);
    if (!record) return false;
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      return false;
    }
    if (verifyOtpHash(code, record.h, this.getOtpPepper())) {
      await this.redis.del(key);
      return true;
    }
    const nextAttempts = record.attempts + 1;
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      return false;
    }
    const remainingTtl = await this.redis.ttl(key);
    await this.redis.set(
      key,
      { h: record.h, attempts: nextAttempts } satisfies OtpRecord,
      remainingTtl && remainingTtl > 0 ? remainingTtl : OTP_TTL_SECONDS,
    );
    return false;
  }

  private hashToken(token: string): string {
    return hashRefreshToken(token);
  }

  /**
   * Phase 3: parse a TTL env value into seconds (shared util).
   * Falls back fail-safe on garbage input (never fail-open).
   */
  private parseTtlSeconds(raw: string | undefined, fallbackSeconds: number): number {
    return parseTtlSeconds(raw, fallbackSeconds);
  }

  /**
   * Phase 3 (G4): spec access TTL is 15m. JWT_ACCESS_TTL may override
   * (accepts "15m", "1h", or seconds); default is 15m.
   */
  private accessTtlSeconds(): number {
    return this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL'), 900);
  }

  private refreshTtlSeconds(): number {
    return this.parseTtlSeconds(this.config.get<string>('JWT_REFRESH_TTL'), 7 * 86400);
  }

  private accessCookieMaxAgeMs(): number {
    return this.accessTtlSeconds() * 1000;
  }

  /**
   * Phase 3: issue a bound access+refresh pair and persist the hashed refresh.
   * Access carries `tv` (User.tokenVersion) so role-change / ban / password
   * reset invalidates outstanding tokens via JwtStrategy.
   */
  private async issueTokenPair(
    user: { id: string; email: string; role: string; tokenVersion?: number | null },
    claims: { name: string; businessId: string | null },
    meta?: { userAgent?: string; ip?: string },
  ) {
    const tokenVersion = user.tokenVersion ?? 0;
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();
    const accessPayload = {
      jti: accessJti,
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: tokenVersion,
      name: claims.name,
      businessId: claims.businessId,
    };
    const refreshPayload = {
      jti: refreshJti,
      type: 'refresh',
      sub: user.id,
      tv: tokenVersion,
    };
    const accessTtl = this.accessTtlSeconds();
    const refreshTtl = this.refreshTtlSeconds();
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: accessTtl });
    const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: refreshTtl });
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        jti: refreshJti,
        hashedToken: this.hashToken(refreshToken),
        accessJti,
        expiresAt,
        userAgent: meta?.userAgent ?? null,
        ip: meta?.ip ?? null,
      },
    });
    return { accessToken, refreshToken, accessJti, refreshJti, accessTtl, expiresAt };
  }

  /**
   * Phase 3: rotate a refresh token. Reuse of an already-rotated token is
   * treated as theft: all of the user's sessions are revoked.
   */
  async refreshTokens(
    refreshToken: string,
    meta?: { userAgent?: string; ip?: string },
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    let payload: { jti?: string; sub?: string; tv?: number; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh' || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const hashedToken = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { hashedToken },
    });
    if (!session) {
      // Unknown token — possibly a rotated-out session that was cleaned up.
      // Fail closed without side effects.
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (session.revokedAt || session.replacedById) {
      // Reuse detected: revoke everything for this user.
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`[Auth] Refresh token reuse detected for user ${session.userId} — all sessions revoked`);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (session.expiresAt < new Date()) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        tokenVersion: true,
        businessProfile: { select: { id: true, businessName: true } },
      },
    });
    if (!user) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('User not found');
    }
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session revoked. Please log in again.');
    }
    const businessId = user.businessProfile?.id || null;
    const name =
      user.businessProfile?.businessName ||
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.email.split('@')[0];
    const pair = await this.issueTokenPair(user, { name, businessId }, meta);
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedById: pair.refreshJti },
    });
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      auth: { accessToken: pair.accessToken, refreshToken: pair.refreshToken },
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

  /**
   * Phase 3: revoke sessions. With no `refreshToken`, revokes every session
   * for the user (logout-everywhere). With one, revokes just that session —
   * and its bound access `jti` is rejected by JwtStrategy until it expires.
   */
  async logout(userId: string, refreshToken?: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      const session = await this.prisma.refreshSession.findUnique({
        where: { hashedToken: this.hashToken(refreshToken) },
      });
      if (session && session.userId === userId) {
        await this.prisma.refreshSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
    } else {
      await this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  /** Phase 3: bump User.tokenVersion to invalidate outstanding access tokens. */
  async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async sendCodeEmail(
    email: string,
    code: string,
    subject: string,
    intro: string,
  ): Promise<void> {
    const fromAddress =
      this.config.get<string>('SMTP_FROM') ||
      process.env.SMTP_FROM ||
      'Central Hub Solution <no-reply@centralhubsolution.com>';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #ea580c; text-align: center; margin-bottom: 20px;">Central Hub Solution</h2>
        <p>Hello,</p>
        <p>${intro}</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #e5e7eb;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code is valid for 10 minutes. If you did not make this request, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© 2026 Central Hub Solution. All rights reserved.</p>
      </div>
    `;

    // Preferred path: Resend transactional email API (RESEND_API_KEY configured).
    const rawResendApiKey = this.config.get<string>('RESEND_API_KEY') || process.env.RESEND_API_KEY;
    const resendApiKey = rawResendApiKey ? rawResendApiKey.replace(/['"\s]+/g, '') : undefined;
    if (resendApiKey) {
      const maskedKey = `${resendApiKey.slice(0, 7)}...${resendApiKey.slice(-4)}`;
      this.logger.log(`[Resend] Sending email to ${email} (key: ${maskedKey})`);
      try {
        const response = await axios.post(
          'https://api.resend.com/emails',
          { from: fromAddress, to: [email], subject, html },
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
      } catch (err: any) {
        const errorData = err.response?.data;
        this.logger.error(
          `[Resend] Failed to send email to ${email}: ${JSON.stringify(errorData || err.message)}`,
        );
        this.logger.warn(`[OTP Fallback] Verification code for ${email}: ${code}`);
      }
    } else {
      this.logger.debug('[Resend] RESEND_API_KEY not set — using SMTP fallback.');
    }

    // Fallback: SMTP via nodemailer (legacy/dev path).
    const transporter = this.getSmtpTransporter();
    if (!transporter) {
      this.logger.warn('SMTP variables are missing — verification code was not emailed.');
      return;
    }

    try {
      await transporter.sendMail({
        from: fromAddress,
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
    const normalizedEmail = normalizeOtpEmail(email);
    this.ensureOtpStoreAvailable();
    const isMock = this.isMockOtp();

    const cooldown = await this.redis.get(otpCooldownKey('OTP', normalizedEmail));
    if (cooldown) {
      throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = this.generateNumericCode();

    // Pure Redis: hashed code with 10-min TTL. Overwrite invalidates any
    // previously issued, still-open OTP for this email.
    await this.storeOtpCode('OTP', normalizedEmail, code);

    if (isMock) {
      // Dev-only convenience: log the code so it can be read in the terminal.
      this.logger.debug(`[OTP] Verification code for ${normalizedEmail}: ${code}`);
    } else {
      await this.sendCodeEmail(
        normalizedEmail,
        code,
        'Central Hub Solution - Your Verification Code',
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
    // Pure Redis: HMAC hash compare, single-use consume, 5-attempt burn.
    return this.verifyOtpCode('OTP', email, code);
  }

  async sendForgotPasswordCode(email: string): Promise<{ success: boolean; resetCode?: string; mode: 'mock' | 'email' }> {
    const normalizedEmail = normalizeOtpEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new ConflictException('User with this email does not exist');
    }

    this.ensureOtpStoreAvailable();
    const cooldown = await this.redis.get(otpCooldownKey('PASSWORD_RESET', normalizedEmail));
    if (cooldown) {
      throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const isMock = this.isMockOtp();
    const code = this.generateNumericCode();

    // Pure Redis: hashed code with 10-min TTL. Overwrite invalidates any
    // previously issued, still-open reset code for this user.
    await this.storeOtpCode('PASSWORD_RESET', normalizedEmail, code);

    if (isMock) {
      this.logger.debug(`[Reset Password] Reset code for ${normalizedEmail}: ${code}`);
    } else {
      await this.sendCodeEmail(
        normalizedEmail,
        code,
        'Central Hub Solution - Reset Your Password',
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
    // Pure Redis: HMAC hash compare, single-use consume, 5-attempt burn.
    return this.verifyOtpCode('PASSWORD_RESET', email, code);
  }

  async resetPassword(data: any): Promise<boolean> {
    const email = data.email ? data.email.toLowerCase().trim() : '';
    const code = data.code;
    const newPassword = data.newPassword;

    const isValid = await this.verifyResetCode(email, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await this.prisma.user.update({
      where: { email },
      // Phase 3: password change invalidates outstanding access (tv bump)
      // and kills refresh sessions.
      data: { password: passwordHash, tokenVersion: { increment: 1 } },
    });
    const changed = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (changed) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: changed.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return true;
  }

  /** Phase 3: cookie lifetime for `mcom_session` (mirrors access TTL). */
  getAccessCookieMaxAgeMs(): number {
    return this.accessCookieMaxAgeMs();
  }

  async validateUser(email: string, password?: string): Promise<any> {
    const normalizedEmail = email ? email.toLowerCase().trim() : '';
    // findFirst (not findUnique) so soft-deleted users stay locked out.
    // Phase 6: minimal select — login() reuses the included profile, so the
    // fallback query below only fires for callers passing a bare `{ id }`.
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        password: true,
        firstName: true,
        lastName: true,
        tokenVersion: true,
        businessProfile: { select: { id: true, businessName: true } },
      },
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

  async login(user: any, meta?: { userAgent?: string; ip?: string }) {
    let businessProfile = user.businessProfile;
    if (businessProfile?.deletedAt) {
      businessProfile = null;
    }
    if (!businessProfile && user.id) {
      businessProfile = await this.prisma.businessProfile.findFirst({
        where: { userId: user.id, deletedAt: null },
      });
    }

    const businessId = businessProfile?.id || null;
    const name = businessProfile?.businessName || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];

    // G6: the packages read and the token-pair write are independent once
    // businessId/name are resolved — run them concurrently instead of
    // sequentially to cut one round-trip off the login hot path.
    const packagesPromise = (async () => {
      if (!businessId) return [];
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
      return packages.map((p) => ({
        platform: p.platform,
        planId: p.externalPlanId,
        planName: p.planName,
        planType: p.planType,
        expiresAt: p.expiresAt,
        billingCycle: p.billingCycle,
        amount: p.amount,
        currency: p.currency,
      }));
    })();

    // Phase 3: bound access+refresh pair, refresh persisted hashed with rotation.
    const pairPromise = this.issueTokenPair(
      { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion ?? 0 },
      { name, businessId },
      meta,
    );

    const [activePlans, { accessToken, refreshToken }] = await Promise.all([
      packagesPromise,
      pairPromise,
    ]);

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

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password || 'password123', salt);

    // Create user, business profile, and wallet atomically.
    // Phase 5: a trashed row may still hold the email (hidden by the
    // soft-delete extension) — translate the unique violation to a 409.
    let newUser;
    try {
      newUser = await this.prisma.$transaction(async (tx) => {
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
    } catch (e) {
      rethrowAsConflictOnUniqueViolation(e);
    }

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

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password || 'password123', salt);

    // Create user + wallet atomically (Phase 5: see registerBusiness for P2002 note)
    let newUser;
    try {
      newUser = await this.prisma.$transaction(async (tx) => {
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
    } catch (e) {
      rethrowAsConflictOnUniqueViolation(e);
    }

    return this.login(newUser);
  }

  async registerAffiliate(data: RegisterDto) {
    const email = data.email ? data.email.toLowerCase().trim() : '';
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password || 'password123', salt);

    const rawRole = (data.role || 'AGENT').toString().toUpperCase().replace('-', '_');
    let targetRole: Role = Role.AGENT;
    if (rawRole === 'ACCOUNT_MANAGER' || rawRole === 'MANAGER') {
      targetRole = Role.ACCOUNT_MANAGER;
    } else if (rawRole === 'CONSULTANT') {
      targetRole = Role.CONSULTANT;
    } else {
      targetRole = Role.AGENT;
    }

    const phone = data.phone || data.phoneNumber || null;

    // Phase 5: see registerBusiness for P2002 note.
    let affiliateUser;
    try {
      affiliateUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          role: targetRole,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          registrationSource: 'affiliate-portal',
          wallet: {
            create: { balance: 0, currency: 'MCOM', status: 'ACTIVE' },
          },
          ...(targetRole === Role.AGENT
            ? {
                agentProfile: {
                  create: {
                    phone,
                    status: 'Active',
                    permissions: ['view_tasks', 'submit_deliverables'],
                  },
                },
              }
            : targetRole === Role.ACCOUNT_MANAGER
            ? {
                accountManagerProfile: {
                  create: {
                    phone,
                    status: 'Active',
                    assignedBusinesses: 0,
                  },
                },
              }
            : {
                consultantProfile: {
                  create: {
                    phone,
                    status: 'Active',
                    specialisation: data.specialisation || 'General Consulting',
                  },
                },
              }),
        },
        include: {
          agentProfile: true,
          accountManagerProfile: true,
          consultantProfile: true,
        },
      });
      return user;
      });
    } catch (e) {
      rethrowAsConflictOnUniqueViolation(e);
    }

    return this.login(affiliateUser);
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

    // Phase 3: SSO tokens are signed with the SSO-only secret. Production
    // fails closed when it is missing; non-production falls back to
    // JWT_SECRET as a dev convenience.
    const ssoSecret = this.config.get<string>('SSO_JWT_SECRET') || this.config.get<string>('SSO_SECRET');
    const secret = ssoSecret || (this.config.get<string>('NODE_ENV') === 'production'
      ? undefined
      : this.config.get<string>('JWT_SECRET'));
    if (!secret) {
      throw new Error('SSO_JWT_SECRET (or SSO_SECRET) must be configured in production.');
    }

    const ssoToken = this.jwtService.sign(payload, {
      secret,
      expiresIn: '60s',
    });

    return { ssoToken };
  }
}