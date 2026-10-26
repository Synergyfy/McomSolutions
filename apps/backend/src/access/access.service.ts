import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CouponProductType,
  Prisma,
  type AccessPassCode,
  type AccessPlan,
  type AccessPlanAppBundle,
  type AccessPurchase,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CouponService, type CouponChargeQuote } from '../coupon/coupon.service';
import { WalletService } from '../wallet/wallet.service';
import { MailService } from '../common/mail/mail.service';

const ACCESS_WALLET_PARTNER = {
  clientId: 'mcom-central',
  name: 'MCOM Central',
  platformSlug: 'mcom-central',
};

export type AccessProvider = 'stripe' | 'paypal' | 'wallet' | 'manual' | 'code';

export type AccessEntitlementChoice = 'membership' | 'access_pass';

export interface AccessMembershipConflict {
  hasConflict: boolean;
  membership: {
    planName: string | null;
    level: string | null;
    status: string | null;
    expiresAt: Date | string | null;
  } | null;
  overlappingPlatforms: Array<{
    platform: string;
    membershipPlanId: string;
    membershipPlanName: string;
    accessPassPlanId: string;
    accessPassPlanName: string;
  }>;
  accessPlan: { id: string; name: string } | null;
}

export interface AccessActivationOpts {
  provider: AccessProvider;
  providerPaymentId: string;
  userId?: string;
  chargedAmount: number;
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string;
  couponRedemptionId?: string;
  /** Code redemptions have already been paid for by the purchaser. */
  allowZeroAmount?: boolean;
  /** Paid codes remain redeemable even if the plan was later archived. */
  allowArchived?: boolean;
  /**
   * What the buyer chose at checkout when the pass overlaps an active
   * membership. `access_pass` means the membership was stopped by the caller
   * before activation. Anything else keeps the membership and defers the pass.
   */
  entitlementChoice?: AccessEntitlementChoice;
}

export interface AccessQuote {
  accessPlan: AccessPlan & { appBundles?: AccessPlanAppBundle[] };
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: 'GBP';
  walletCredits: number;
  walletCurrency: 'MCOM';
  coupon: CouponChargeQuote['coupon'] | null;
}

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly couponService: CouponService,
    private readonly walletService: WalletService,
    private readonly mailService: MailService,
  ) {}

  private addDaysUtc(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  // ─── Membership / access-pass conflict handling ─────────────────────────

  private platformKey(value?: string | null): string {
    return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private platformsMatch(a?: string | null, b?: string | null): boolean {
    const left = this.platformKey(a);
    const right = this.platformKey(b);
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
  }

  private isMembershipCurrentlyActive(
    business:
      | {
          membershipStatus?: string | null;
          membershipPlanName?: string | null;
          membershipExpiresAt?: Date | string | null;
        }
      | null
      | undefined,
  ): boolean {
    if (!business) return false;
    const status = (business.membershipStatus || '').toLowerCase();
    if (!['active', 'trial', 'past_due'].includes(status)) return false;
    if (!business.membershipPlanName) return false;
    if (
      business.membershipExpiresAt &&
      new Date(business.membershipExpiresAt).getTime() <= Date.now()
    ) {
      return false;
    }
    return true;
  }

  private async buildMembershipConflict(
    business: {
      membershipStatus?: string | null;
      membershipPlanName?: string | null;
      membershipLevel?: string | null;
      membershipExpiresAt?: Date | string | null;
    },
    plan: AccessPlan & { appBundles?: AccessPlanAppBundle[] },
  ): Promise<AccessMembershipConflict> {
    const empty: AccessMembershipConflict = {
      hasConflict: false,
      membership: null,
      overlappingPlatforms: [],
      accessPlan: { id: plan.id, name: plan.name },
    };

    if (!this.isMembershipCurrentlyActive(business) || !business.membershipPlanName) {
      return empty;
    }

    const membershipPlan = await this.prisma.membershipPlan.findFirst({
      where: {
        name: { equals: business.membershipPlanName, mode: 'insensitive' },
        archived: false,
      },
      select: { name: true, includedApps: true },
    });

    const includedApps = Array.isArray(membershipPlan?.includedApps)
      ? (membershipPlan.includedApps as Array<Record<string, unknown>>)
      : [];
    if (includedApps.length === 0) return empty;

    const overlappingPlatforms: AccessMembershipConflict['overlappingPlatforms'] = [];
    for (const bundle of plan.appBundles ?? []) {
      const app = includedApps.find((raw) =>
        this.platformsMatch(
          String(raw.platform ?? raw.platformName ?? ''),
          bundle.platform,
        ),
      );
      if (!app) continue;
      overlappingPlatforms.push({
        platform: bundle.platform,
        membershipPlanId: String(app.planId ?? app.id ?? 'standard'),
        membershipPlanName: String(app.planName ?? app.name ?? 'Standard'),
        accessPassPlanId: String(bundle.externalPlanId ?? bundle.id),
        accessPassPlanName: bundle.packageName,
      });
    }

    if (overlappingPlatforms.length === 0) return empty;

    return {
      hasConflict: true,
      membership: {
        planName: business.membershipPlanName,
        level: business.membershipLevel ?? null,
        status: business.membershipStatus ?? null,
        expiresAt: business.membershipExpiresAt ?? null,
      },
      overlappingPlatforms,
      accessPlan: { id: plan.id, name: plan.name },
    };
  }

  async getMembershipConflict(
    businessId: string,
    accessPlanId: string,
  ): Promise<{ success: true; data: AccessMembershipConflict }> {
    const [business, plan] = await Promise.all([
      this.prisma.businessProfile.findFirst({
        where: { id: businessId, deletedAt: null },
      }),
      this.getPlan(accessPlanId),
    ]);
    if (!business) throw new NotFoundException('Business profile not found');
    const data = await this.buildMembershipConflict(business, plan);
    return { success: true, data };
  }

  /**
   * Provisions the platform packages for a pass. Shared by immediate activation
   * and deferred (pending) activation.
   */
  private async provisionPackagesTx(
    tx: Prisma.TransactionClient,
    businessId: string,
    plan: AccessPlan & { appBundles?: AccessPlanAppBundle[] },
    startAt: Date,
    opts: Pick<AccessActivationOpts, 'provider' | 'providerPaymentId'>,
  ): Promise<any[]> {
    const packages: any[] = [];

    for (const bundle of plan.appBundles ?? []) {
      const bundleDurationDays = bundle.durationDays ?? plan.durationDays;
      const bundleExpiresAt = this.addDaysUtc(startAt, bundleDurationDays);

      const existing = await tx.platformPackage.findUnique({
        where: {
          businessId_platform: {
            businessId,
            platform: bundle.platform,
          },
        },
      });

      const existingIsActive =
        !!existing &&
        existing.status === 'active' &&
        (!existing.expiresAt || existing.expiresAt > startAt);
      const existingLastsLonger =
        existingIsActive &&
        (existing!.expiresAt === null || existing!.expiresAt! > bundleExpiresAt);

      // Never shorten an existing active or lifetime plan.
      if (existingLastsLonger) {
        packages.push(existing);
        continue;
      }

      const data = {
        packageName: bundle.packageName,
        externalPlanId: bundle.externalPlanId,
        planName: bundle.packageName,
        planType: 'ACCESS',
        status: 'active',
        limits: (bundle.limits as Prisma.InputJsonValue) ?? {},
        expiresAt: bundleExpiresAt,
        provider: opts.provider === 'manual' ? 'manual' : opts.provider,
        providerSubscriptionId: opts.providerPaymentId,
        amount: 0,
        currency: 'GBP',
        billingCycle: 'One-time',
      };

      const pkg = await tx.platformPackage.upsert({
        where: {
          businessId_platform: {
            businessId,
            platform: bundle.platform,
          },
        },
        create: {
          businessId,
          platform: bundle.platform,
          ...data,
        },
        update: data,
      });
      packages.push(pkg);
    }

    return packages;
  }

  /**
   * Activates paid passes that were deferred because the buyer still had an
   * overlapping membership. Called by the cron and lazily when the dashboard
   * fetches purchase history.
   */
  async activatePendingAccessPurchases(businessId?: string): Promise<number> {
    const pending = await this.prisma.accessPurchase.findMany({
      where: {
        status: 'PENDING_ACTIVATION',
        ...(businessId ? { businessId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    let activated = 0;
    for (const purchase of pending) {
      try {
        const business = await this.prisma.businessProfile.findFirst({
          where: { id: purchase.businessId, deletedAt: null },
        });
        if (!business || this.isMembershipCurrentlyActive(business)) continue;
        await this.activatePendingAccessPurchase(purchase);
        activated += 1;
      } catch (err) {
        this.logger.warn(
          `Could not activate pending access purchase ${purchase.id}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
    return activated;
  }

  private async activatePendingAccessPurchase(purchase: AccessPurchase): Promise<void> {
    const plan = await this.getPlanIncludingArchived(purchase.accessPlanId);
    const now = new Date();
    const expiresAt = this.addDaysUtc(now, purchase.durationDays);

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.accessPurchase.updateMany({
        where: { id: purchase.id, status: 'PENDING_ACTIVATION' },
        data: { status: 'ACTIVE', startsAt: now, expiresAt },
      });
      if (claimed.count === 0) return;

      const business = await tx.businessProfile.findUnique({
        where: { id: purchase.businessId },
        select: { businessName: true },
      });

      await tx.ecosystemSubscription.create({
        data: {
          businessId: purchase.businessId,
          businessName: business?.businessName ?? '',
          type: 'Access',
          itemName: `${purchase.accessPlanName} (${purchase.durationDays} days)`,
          status: 'Active',
          startDate: now,
          endDate: expiresAt,
          amount: purchase.amount,
          billingCycle: 'One-time',
        },
      });

      await this.provisionPackagesTx(tx, purchase.businessId, plan, now, {
        provider: (purchase.provider as AccessProvider) || 'manual',
        providerPaymentId: purchase.providerPaymentId ?? `pending:${purchase.id}`,
      });
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handlePendingAccessActivations(): Promise<void> {
    try {
      const count = await this.activatePendingAccessPurchases();
      if (count > 0) {
        this.logger.log(`Activated ${count} pending access pass purchase(s)`);
      }
    } catch (err) {
      this.logger.warn(
        `Pending access activation sweep failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  /** GBP → MCOM wallet credits. Mirrors wallet top-up FX lookup/fallback. */
  private async getGbptoMcomRate(): Promise<number> {
    try {
      const fx = await this.prisma.fxRate.findUnique({
        where: { base_quote: { base: 'GBP', quote: 'MCOM' } },
      });
      if (fx) return new Decimal(fx.rate.toString()).toNumber();
    } catch (err: any) {
      this.logger.warn(`FX lookup failed for GBP→MCOM: ${err?.message}`);
    }
    const envRate = this.config.get<string>('MCOM_GBP_RATE');
    const parsed = envRate ? parseFloat(envRate) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  async getPlans() {
    const plans = await this.prisma.accessPlan.findMany({
      where: { archived: false },
      orderBy: { createdAt: 'desc' },
      include: { appBundles: { orderBy: { createdAt: 'asc' } } },
    });
    return { success: true, data: plans };
  }

  async getPlan(accessPlanId: string) {
    const plan = await this.prisma.accessPlan.findFirst({
      where: { id: accessPlanId, archived: false },
      include: { appBundles: { orderBy: { createdAt: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Access plan not found');
    return plan;
  }

  /** Paid access pass codes must remain redeemable even after a plan is archived. */
  private async getPlanIncludingArchived(accessPlanId: string) {
    const plan = await this.prisma.accessPlan.findFirst({
      where: { id: accessPlanId },
      include: { appBundles: { orderBy: { createdAt: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Access plan not found');
    return plan;
  }

  async resolveQuote(
    accessPlanId: string,
    couponCode?: string,
    userId?: string,
  ): Promise<AccessQuote> {
    const plan = await this.getPlan(accessPlanId);
    const amount = Number(plan.price);

    let coupon: CouponChargeQuote | null = null;
    if (couponCode) {
      if (!userId) {
        throw new BadRequestException('A signed-in user is required to use a coupon.');
      }
      coupon = await this.couponService.validateForCharge({
        code: couponCode,
        userId,
        planId: plan.id,
        planName: plan.name,
        amount,
        productType: CouponProductType.ACCESS,
      });
    }

    const originalAmount = coupon?.originalAmount ?? amount;
    const discountAmount = coupon?.discountAmount ?? 0;
    const finalAmount = coupon?.finalAmount ?? amount;
    const rate = await this.getGbptoMcomRate();
    const walletCredits = new Decimal(finalAmount).times(rate).toDecimalPlaces(4).toNumber();

    return {
      accessPlan: plan,
      originalAmount: this.roundMoney(originalAmount),
      discountAmount: this.roundMoney(discountAmount),
      finalAmount: this.roundMoney(finalAmount),
      currency: 'GBP',
      walletCredits,
      walletCurrency: 'MCOM',
      coupon: coupon?.coupon ?? null,
    };
  }

  async getActivePurchases(businessId: string) {
    await this.activatePendingAccessPurchases(businessId).catch(() => undefined);
    const now = new Date();
    const purchases = await this.prisma.accessPurchase.findMany({
      where: { businessId, status: 'ACTIVE', expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
      include: { accessPlan: { include: { appBundles: true } } },
    });
    return { success: true, data: purchases };
  }

  async getPurchaseHistory(businessId: string) {
    // Keep the dashboard accurate even if the cron has not run yet.
    await this.activatePendingAccessPurchases(businessId).catch(() => undefined);
    const purchases = await this.prisma.accessPurchase.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { accessPlan: { include: { appBundles: true } } },
    });
    return { success: true, data: purchases };
  }

  // ─── ACCESS PASS CODES (gift / transferable) ─────────────────────────────

  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(8);
    let raw = '';
    for (const byte of bytes) {
      raw += alphabet[byte % alphabet.length];
    }
    return `MCOM-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = this.generateCode();
      const existing = await this.prisma.accessPassCode.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new Error('Could not generate a unique access pass code. Please try again.');
  }

  async getAccessCode(codeId: string) {
    const code = await this.prisma.accessPassCode.findUnique({
      where: { id: codeId },
      include: { accessPlan: true },
    });
    if (!code) {
      throw new NotFoundException('Access pass code not found.');
    }
    return code;
  }

  async createPendingAccessCode(input: {
    businessId: string;
    userId?: string;
    accessPlanId: string;
    mode: 'GIFT' | 'CODE';
    recipientEmail?: string | null;
    amount: number;
    currency?: string;
    provider?: string;
  }) {
    const plan = await this.getPlan(input.accessPlanId);
    if (input.mode === 'GIFT' && !input.recipientEmail?.trim()) {
      throw new BadRequestException('A recipient email is required for a gifted access pass.');
    }

    const code = await this.uniqueCode();
    const created = await this.prisma.accessPassCode.create({
      data: {
        code,
        accessPlanId: plan.id,
        purchaserBusinessId: input.businessId,
        purchaserUserId: input.userId ?? null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        mode: input.mode,
        status: 'PENDING_PAYMENT',
        amount: this.roundMoney(input.amount),
        currency: (input.currency || 'GBP').toUpperCase(),
        provider: input.provider ?? null,
      },
    });

    return { code: created, plan };
  }

  async attachProviderPaymentToCode(codeId: string, providerPaymentId: string) {
    await this.prisma.accessPassCode.update({
      where: { id: codeId },
      data: { providerPaymentId },
    });
  }

  async cancelPendingAccessCode(codeId: string) {
    await this.prisma.accessPassCode
      .deleteMany({ where: { id: codeId, status: 'PENDING_PAYMENT' } })
      .catch(() => undefined);
  }

  async completeAccessCode(codeId: string, opts: { provider: string; providerPaymentId: string }) {
    const existing = await this.prisma.accessPassCode.findUnique({
      where: { id: codeId },
      include: { accessPlan: true },
    });
    if (!existing) {
      throw new NotFoundException('Access pass code not found.');
    }

    if (
      (existing.status === 'UNUSED' || existing.status === 'REDEEMED') &&
      existing.providerPaymentId === opts.providerPaymentId
    ) {
      return this.codeResult(existing, existing.accessPlan.name, Boolean(existing.emailSentAt));
    }
    if (existing.status !== 'PENDING_PAYMENT') {
      throw new ConflictException('This access pass code payment has already been processed.');
    }

    const updated = await this.prisma.accessPassCode.update({
      where: { id: codeId },
      data: {
        status: 'UNUSED',
        provider: opts.provider,
        providerPaymentId: opts.providerPaymentId,
        purchasedAt: new Date(),
      },
    });

    const emailSent = await this.sendAccessCodeEmail(updated, existing.accessPlan.name);
    return this.codeResult(updated, existing.accessPlan.name, emailSent);
  }

  async fulfillWalletAccessCode(input: {
    businessId: string;
    userId?: string;
    accessPlanId: string;
    mode: 'GIFT' | 'CODE';
    recipientEmail?: string | null;
    amount: number;
    currency?: string;
    providerPaymentId: string;
  }) {
    const existing = await this.prisma.accessPassCode.findUnique({
      where: { providerPaymentId: input.providerPaymentId },
      include: { accessPlan: true },
    });
    if (existing) {
      return this.codeResult(existing, existing.accessPlan.name, Boolean(existing.emailSentAt));
    }

    const plan = await this.getPlan(input.accessPlanId);
    if (input.mode === 'GIFT' && !input.recipientEmail?.trim()) {
      throw new BadRequestException('A recipient email is required for a gifted access pass.');
    }

    const created = await this.prisma.accessPassCode.create({
      data: {
        code: await this.uniqueCode(),
        accessPlanId: plan.id,
        purchaserBusinessId: input.businessId,
        purchaserUserId: input.userId ?? null,
        recipientEmail: input.recipientEmail?.trim().toLowerCase() || null,
        mode: input.mode,
        status: 'UNUSED',
        amount: this.roundMoney(input.amount),
        currency: (input.currency || 'GBP').toUpperCase(),
        provider: 'wallet',
        providerPaymentId: input.providerPaymentId,
        purchasedAt: new Date(),
      },
    });

    const emailSent = await this.sendAccessCodeEmail(created, plan.name);
    return this.codeResult(created, plan.name, emailSent);
  }

  async listAccessCodes(businessId: string, userEmail?: string) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { email: true },
    });
    const emails = [...new Set([userEmail, business?.email].filter(Boolean) as string[])];
    const emailFilter = emails.map((email) => ({
      recipientEmail: { equals: email.trim(), mode: 'insensitive' as const },
    }));

    const codes = await this.prisma.accessPassCode.findMany({
      where: {
        status: { not: 'PENDING_PAYMENT' },
        OR: [{ purchaserBusinessId: businessId }, ...emailFilter],
      },
      include: { accessPlan: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: codes.map((code) => ({
        id: code.id,
        code: code.code,
        accessPlanId: code.accessPlanId,
        planName: code.accessPlan.name,
        mode: code.mode,
        status: code.status,
        recipientEmail: code.recipientEmail,
        amount: code.amount,
        currency: code.currency,
        purchasedAt: code.purchasedAt,
        emailSentAt: code.emailSentAt,
        redeemedAt: code.redeemedAt,
        purchasedByMe: code.purchaserBusinessId === businessId,
        createdAt: code.createdAt,
      })),
    };
  }

  async redeemAccessCode(
    businessId: string,
    userId: string | undefined,
    userEmail: string | undefined,
    rawCode: string,
  ) {
    const codeValue = (rawCode || '').trim().toUpperCase();
    if (codeValue.length < 4) {
      throw new BadRequestException('Enter a valid access pass code.');
    }

    const found = await this.prisma.accessPassCode.findUnique({
      where: { code: codeValue },
      include: { accessPlan: true },
    });
    if (!found) {
      throw new NotFoundException('Access pass code not found.');
    }
    if (found.status === 'REDEEMED') {
      throw new ConflictException('This access pass code has already been redeemed.');
    }
    if (found.status !== 'UNUSED') {
      throw new BadRequestException('This access pass code is not ready to be redeemed.');
    }
    if (found.recipientEmail) {
      const business = await this.prisma.businessProfile.findFirst({
        where: { id: businessId, deletedAt: null },
        select: { email: true },
      });
      const allowedEmails = [...new Set([userEmail, business?.email].filter(Boolean) as string[])].map(
        (email) => email.trim().toLowerCase(),
      );
      if (!allowedEmails.includes(found.recipientEmail.toLowerCase())) {
        throw new ForbiddenException('This access pass code was issued to a different email address.');
      }
    }

    const claimed = await this.prisma.accessPassCode.updateMany({
      where: { id: found.id, status: 'UNUSED' },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        redeemedByBusinessId: businessId,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException('This access pass code has already been redeemed.');
    }

    try {
      const purchase = await this.activateAccess(businessId, found.accessPlanId, {
        provider: 'code',
        providerPaymentId: `code:${found.id}`,
        userId,
        chargedAmount: 0,
        originalAmount: found.amount,
        allowZeroAmount: true,
        allowArchived: true,
      });

      return {
        success: true,
        code: found.code,
        planName: found.accessPlan.name,
        purchasedAt: purchase.startsAt,
        expiresAt: purchase.expiresAt,
        purchase,
      };
    } catch (err) {
      await this.prisma.accessPassCode
        .updateMany({
          where: { id: found.id, status: 'REDEEMED' },
          data: { status: 'UNUSED', redeemedAt: null, redeemedByBusinessId: null },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  private codeResult(code: AccessPassCode, planName: string, emailSent: boolean) {
    return {
      success: true,
      type: 'access_code' as const,
      mode: code.mode,
      code: code.code,
      planName,
      accessPlanId: code.accessPlanId,
      recipientEmail: code.recipientEmail,
      amount: code.amount,
      currency: code.currency,
      emailSent,
      status: code.status,
    };
  }

  private async sendAccessCodeEmail(code: AccessPassCode, planName: string): Promise<boolean> {
    const recipient = code.recipientEmail?.trim();
    if (!recipient) return false;

    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const redeemUrl = `${frontendUrl}/dashboard/access-passes`;
    const text = [
      `You have received an MCOM access pass: ${planName}.`,
      '',
      `Your code: ${code.code}`,
      '',
      `Redeem it on your dashboard: ${redeemUrl}`,
      '',
      'This code is locked to this email address and will not activate until you redeem it.',
    ].join('\n');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="margin:0 0 8px">You've received an access pass</h2>
        <p style="margin:0 0 16px;color:#4b5563">${planName}</p>
        <div style="border:1px solid #e5e7eb;background:#f9fafb;border-radius:12px;padding:18px;text-align:center;margin:18px 0">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280">Your access code</p>
          <p style="margin:0;font-size:24px;font-weight:800;letter-spacing:0.12em;font-family:monospace">${code.code}</p>
        </div>
        <a href="${redeemUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Redeem your pass</a>
        <p style="margin:18px 0 0;font-size:12px;color:#6b7280">This code is locked to this email address. Access starts when you redeem it.</p>
      </div>
    `;

    try {
      await this.mailService.send({
        to: recipient,
        subject: `Your MCOM access pass code — ${planName}`,
        html,
        text,
      });
      await this.prisma.accessPassCode.update({
        where: { id: code.id },
        data: { emailSentAt: new Date() },
      });
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Access pass code ${code.id} was created but the email to ${recipient} failed: ${err?.message ?? err}`,
      );
      return false;
    }
  }

  async purchaseAccessCodeWithWallet(
    businessId: string,
    userId: string,
    accessPlanId: string,
    mode: 'GIFT' | 'CODE',
    recipientEmail: string | undefined,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey || idempotencyKey.trim().length < 8) {
      throw new BadRequestException('A valid X-Idempotency-Key header is required.');
    }
    if (mode === 'GIFT' && !recipientEmail?.trim()) {
      throw new BadRequestException('A recipient email is required for a gifted access pass.');
    }
    const providerPaymentId = `wallet:${idempotencyKey.trim()}`;

    const existing = await this.prisma.accessPassCode.findUnique({
      where: { providerPaymentId },
      include: { accessPlan: true },
    });
    if (existing) {
      return this.codeResult(existing, existing.accessPlan.name, Boolean(existing.emailSentAt));
    }

    const quote = await this.resolveQuote(accessPlanId);
    let walletReceipt: Awaited<ReturnType<WalletService['debitWallet']>>;
    try {
      walletReceipt = await this.walletService.debitWallet(
        ACCESS_WALLET_PARTNER as any,
        {
          userId,
          amount: quote.walletCredits,
          category: 'PURCHASE' as any,
          description: `MCOM Access Pass ${mode === 'GIFT' ? 'gift' : 'code'} — ${quote.accessPlan.name}`,
          reference: providerPaymentId,
          metadata: {
            accessPlanId: quote.accessPlan.id,
            businessId,
            mode,
            recipientEmail: recipientEmail ?? null,
          },
        },
        idempotencyKey.trim(),
      );
    } catch (err) {
      throw err;
    }

    try {
      return await this.fulfillWalletAccessCode({
        businessId,
        userId,
        accessPlanId,
        mode,
        recipientEmail,
        amount: quote.finalAmount,
        currency: quote.currency,
        providerPaymentId,
      });
    } catch (err) {
      await this.walletService
        .creditWallet(
          ACCESS_WALLET_PARTNER as any,
          {
            userId,
            amount: walletReceipt.amount,
            category: 'REFUND' as any,
            description: `Refund — ${quote.accessPlan.name} access pass code`,
            reference: providerPaymentId,
            metadata: {
              accessPlanId: quote.accessPlan.id,
              businessId,
              reason: 'access_code_creation_failed',
            },
          },
          `access-code-refund:${idempotencyKey.trim()}`,
        )
        .catch((refundErr: any) => {
          this.logger.error(
            `Wallet refund failed for access code ${providerPaymentId}: ${refundErr?.message ?? refundErr}`,
          );
        });
      throw err;
    }
  }

  private async resolveReplay(
    existingBilling: { businessId: string; amount: number },
    businessId: string,
    chargedAmount: number,
    providerPaymentId: string,
  ) {
    if (existingBilling.businessId !== businessId) {
      this.logger.warn(
        `Access activation conflict: reference ${providerPaymentId} already processed for business ${existingBilling.businessId}, attempted for ${businessId}`,
      );
      throw new ConflictException('This payment has already been processed for a different business.');
    }
    if (Math.abs(existingBilling.amount - chargedAmount) > 0.005) {
      this.logger.warn(
        `Access activation conflict: reference ${providerPaymentId} amount ${existingBilling.amount} does not match ${chargedAmount}`,
      );
      throw new ConflictException('This payment has already been processed for a different amount.');
    }

    const purchase = await this.prisma.accessPurchase.findUnique({
      where: { providerPaymentId },
      include: { accessPlan: { include: { appBundles: true } } },
    });
    if (!purchase) {
      throw new ConflictException('This payment reference has already been used.');
    }
    const platforms = purchase.accessPlan.appBundles.map((b) => b.platform);
    const packages = platforms.length
      ? await this.prisma.platformPackage.findMany({
          where: { businessId, platform: { in: platforms } },
        })
      : [];
    return {
      ...purchase,
      packages,
      replayed: true as const,
      pendingActivation: purchase.status === 'PENDING_ACTIVATION',
    };
  }

  /**
   * Idempotent access activation. The provider payment reference is the
   * idempotency key. Creates the purchase + ledger + subscription, completes
   * any coupon redemption and provisions the bundled platform packages.
   */
  async activateAccess(
    businessId: string,
    accessPlanId: string,
    opts: AccessActivationOpts,
  ) {
    if (!opts.providerPaymentId) {
      throw new BadRequestException('A payment reference is required to activate an access pass.');
    }

    const existingBilling = await this.prisma.billingTransaction.findUnique({
      where: { providerPaymentId: opts.providerPaymentId },
    });
    if (existingBilling) {
      return this.resolveReplay(
        existingBilling,
        businessId,
        opts.chargedAmount,
        opts.providerPaymentId,
      );
    }

    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
    });
    if (!business) throw new NotFoundException('Business profile not found');

    const plan = opts.allowArchived
      ? await this.getPlanIncludingArchived(accessPlanId)
      : await this.getPlan(accessPlanId);
    if (!plan.appBundles || plan.appBundles.length === 0) {
      throw new BadRequestException('This access pass has no platform plans configured.');
    }

    const chargedAmount = this.roundMoney(opts.chargedAmount);
    if (!Number.isFinite(chargedAmount) || chargedAmount < 0) {
      throw new BadRequestException('Access pass price must be greater than zero.');
    }
    if (chargedAmount === 0 && !opts.allowZeroAmount) {
      throw new BadRequestException('Access pass price must be greater than zero.');
    }

    const now = new Date();
    const bundleDurations = plan.appBundles
      .map((bundle) => bundle.durationDays ?? plan.durationDays)
      .filter((days) => Number.isFinite(days) && days > 0);
    const purchaseDurationDays = Math.max(plan.durationDays, ...bundleDurations);
    const expiresAt = this.addDaysUtc(now, purchaseDurationDays);
    const couponSuffix =
      opts.couponCode && opts.discountAmount
        ? `, coupon ${opts.couponCode} -£${Number(opts.discountAmount).toFixed(2)}`
        : '';

    const conflict = await this.buildMembershipConflict(business, plan);
    const deferForMembership =
      conflict.hasConflict && opts.entitlementChoice !== 'access_pass';

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const purchase = await tx.accessPurchase.create({
          data: {
            businessId,
            accessPlanId: plan.id,
            accessPlanName: plan.name,
            durationDays: purchaseDurationDays,
            amount: chargedAmount,
            currency: 'GBP',
            status: deferForMembership ? 'PENDING_ACTIVATION' : 'ACTIVE',
            provider: opts.provider,
            providerPaymentId: opts.providerPaymentId,
            startsAt: now,
            expiresAt,
          },
        });

        const billing = await tx.billingTransaction.create({
          data: {
            businessId,
            amount: chargedAmount,
            description: deferForMembership
              ? `Access Pass: ${plan.name} (${purchaseDurationDays} days, pending until membership ends)${couponSuffix}`
              : `Access Pass: ${plan.name} (${purchaseDurationDays} days, valid until ${expiresAt
                  .toISOString()
                  .split('T')[0]})${couponSuffix}`,
            status: 'paid',
            provider: opts.provider === 'manual' ? 'manual' : opts.provider,
            providerPaymentId: opts.providerPaymentId,
          },
        });

        if (opts.couponRedemptionId) {
          await this.couponService.completeRedemption(
            tx,
            opts.couponRedemptionId,
            billing.id,
            { businessId },
          );
        }

        if (deferForMembership) {
          // Paid and reserved, but not provisioned yet. The activation cron (or
          // a lazy check) starts it once the membership is no longer active.
          return { purchase, billingId: billing.id, packages: [] as any[] };
        }

        await tx.ecosystemSubscription.create({
          data: {
            businessId,
            businessName: business.businessName,
            type: 'Access',
            itemName: `${plan.name} (${purchaseDurationDays} days)`,
            status: 'Active',
            startDate: now,
            endDate: expiresAt,
            amount: chargedAmount,
            billingCycle: 'One-time',
          },
        });

        const packages = await this.provisionPackagesTx(tx, businessId, plan, now, opts);

        return { purchase, billingId: billing.id, packages };
      });

      return {
        ...result.purchase,
        packages: result.packages,
        pendingActivation: deferForMembership,
        conflict,
        planName: plan.name,
        durationDays: purchaseDurationDays,
        expiresAt,
        pricing: {
          originalAmount: this.roundMoney(opts.originalAmount ?? chargedAmount),
          discountAmount: this.roundMoney(opts.discountAmount ?? 0),
          finalAmount: chargedAmount,
          currency: 'GBP' as const,
        },
      };

    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        opts.providerPaymentId
      ) {
        const existing = await this.prisma.billingTransaction.findUnique({
          where: { providerPaymentId: opts.providerPaymentId },
        });
        if (existing) {
          return this.resolveReplay(
            existing,
            businessId,
            chargedAmount,
            opts.providerPaymentId,
          );
        }
      }
      throw err;
    }
  }

  /**
   * MCOM Wallet purchase. Debits the user's wallet synchronously, then
   * activates the access pass. The idempotency key is the payment reference.
   */
  async purchaseWithWallet(
    businessId: string,
    userId: string,
    accessPlanId: string,
    couponCode: string | undefined,
    idempotencyKey: string,
    entitlementChoice?: AccessEntitlementChoice,
  ) {
    if (!idempotencyKey || idempotencyKey.trim().length < 8) {
      throw new BadRequestException('A valid X-Idempotency-Key header is required.');
    }
    const providerPaymentId = `wallet:${idempotencyKey.trim()}`;

    const existingBilling = await this.prisma.billingTransaction.findUnique({
      where: { providerPaymentId },
    });
    if (existingBilling) {
      return this.resolveReplay(
        existingBilling,
        businessId,
        existingBilling.amount,
        providerPaymentId,
      );
    }

    const quote = await this.resolveQuote(accessPlanId, couponCode, userId);

    let redemptionId: string | undefined;
    if (couponCode) {
      const reservation = await this.couponService.reserveForCharge({
        code: couponCode,
        userId,
        planId: quote.accessPlan.id,
        planName: quote.accessPlan.name,
        amount: quote.originalAmount,
        businessId,
        provider: 'wallet',
        providerPaymentId,
        productType: CouponProductType.ACCESS,
      });
      redemptionId = reservation.redemptionId;
    }

    let walletReceipt: Awaited<ReturnType<WalletService['debitWallet']>>;
    try {
      walletReceipt = await this.walletService.debitWallet(
        ACCESS_WALLET_PARTNER as any,
        {
          userId,
          amount: quote.walletCredits,
          category: 'PURCHASE' as any,
          description: `MCOM Access Pass — ${quote.accessPlan.name} (${quote.accessPlan.durationDays} days)`,
          reference: providerPaymentId,
          metadata: {
            accessPlanId: quote.accessPlan.id,
            businessId,
            couponCode: couponCode ?? null,
            providerPaymentId,
          },
        },
        idempotencyKey.trim(),
      );
    } catch (err) {
      if (redemptionId) {
        await this.couponService.releaseReservation(redemptionId).catch(() => undefined);
      }
      throw err;
    }

    try {
      const purchase = await this.activateAccess(businessId, accessPlanId, {
        provider: 'wallet',
        providerPaymentId,
        userId,
        chargedAmount: quote.finalAmount,
        originalAmount: quote.originalAmount,
        discountAmount: quote.discountAmount,
        couponCode,
        couponRedemptionId: redemptionId,
        entitlementChoice,
      });

      return {
        ...purchase,
        pricing: {
          originalAmount: quote.originalAmount,
          discountAmount: quote.discountAmount,
          finalAmount: quote.finalAmount,
          currency: 'GBP' as const,
          walletDebited: walletReceipt.amount,
          walletCurrency: walletReceipt.currency,
          walletTransactionId: walletReceipt.transactionId,
        },
      };
    } catch (err) {
      // The wallet was already debited but activation failed. Refund with a
      // deterministic key so retries cannot double-refund.
      await this.walletService
        .creditWallet(
          ACCESS_WALLET_PARTNER as any,
          {
            userId,
            amount: walletReceipt.amount,
            category: 'REFUND' as any,
            description: `Refund — ${quote.accessPlan.name} access pass`,
            reference: providerPaymentId,
            metadata: {
              accessPlanId: quote.accessPlan.id,
              businessId,
              providerPaymentId,
              reason: 'access_activation_failed',
            },
          },
          `access-refund:${idempotencyKey.trim()}`,
        )
        .catch((refundErr: any) => {
          this.logger.error(
            `Wallet refund failed for ${providerPaymentId}: ${refundErr?.message ?? refundErr}`,
          );
        });
      if (redemptionId) {
        await this.couponService.releaseReservation(redemptionId).catch(() => undefined);
      }
      throw err;
    }
  }
}
