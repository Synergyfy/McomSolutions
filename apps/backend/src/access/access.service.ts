import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CouponProductType,
  Prisma,
  type AccessPlan,
  type AccessPlanAppBundle,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CouponService, type CouponChargeQuote } from '../coupon/coupon.service';
import { WalletService } from '../wallet/wallet.service';

const ACCESS_WALLET_PARTNER = {
  clientId: 'mcom-central',
  name: 'MCOM Central',
  platformSlug: 'mcom-central',
};

export type AccessProvider = 'stripe' | 'paypal' | 'wallet' | 'manual';

export interface AccessActivationOpts {
  provider: AccessProvider;
  providerPaymentId: string;
  userId?: string;
  chargedAmount: number;
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string;
  couponRedemptionId?: string;
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
  ) {}

  private addDaysUtc(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
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
    const now = new Date();
    const purchases = await this.prisma.accessPurchase.findMany({
      where: { businessId, status: 'ACTIVE', expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
      include: { accessPlan: { include: { appBundles: true } } },
    });
    return { success: true, data: purchases };
  }

  async getPurchaseHistory(businessId: string) {
    const purchases = await this.prisma.accessPurchase.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { accessPlan: { include: { appBundles: true } } },
    });
    return { success: true, data: purchases };
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
    return { ...purchase, packages, replayed: true as const };
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

    const plan = await this.getPlan(accessPlanId);
    if (!plan.appBundles || plan.appBundles.length === 0) {
      throw new BadRequestException('This access pass has no platform plans configured.');
    }

    const chargedAmount = this.roundMoney(opts.chargedAmount);
    if (!Number.isFinite(chargedAmount) || chargedAmount <= 0) {
      throw new BadRequestException('Access pass price must be greater than zero.');
    }

    const now = new Date();
    const expiresAt = this.addDaysUtc(now, plan.durationDays);
    const couponSuffix =
      opts.couponCode && opts.discountAmount
        ? `, coupon ${opts.couponCode} -£${Number(opts.discountAmount).toFixed(2)}`
        : '';

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const purchase = await tx.accessPurchase.create({
          data: {
            businessId,
            accessPlanId: plan.id,
            accessPlanName: plan.name,
            durationDays: plan.durationDays,
            amount: chargedAmount,
            currency: 'GBP',
            status: 'ACTIVE',
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
            description: `Access Pass: ${plan.name} (${plan.durationDays} days, valid until ${expiresAt
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

        await tx.ecosystemSubscription.create({
          data: {
            businessId,
            businessName: business.businessName,
            type: 'Access',
            itemName: `${plan.name} (${plan.durationDays} days)`,
            status: 'Active',
            startDate: now,
            endDate: expiresAt,
            amount: chargedAmount,
            billingCycle: 'One-time',
          },
        });

        const packages: any[] = [];
        for (const bundle of plan.appBundles) {
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
            (!existing.expiresAt || existing.expiresAt > now);
          const existingLastsLonger =
            existingIsActive &&
            (existing!.expiresAt === null || existing!.expiresAt! > expiresAt);

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
            expiresAt,
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

        return { purchase, billingId: billing.id, packages };
      });

      return {
        ...result.purchase,
        packages: result.packages,
        planName: plan.name,
        durationDays: plan.durationDays,
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
  ) {
    if (!idempotencyKey || idempotencyKey.trim().length < 8) {
      throw new BadRequestException('A valid Idempotency-Key header is required.');
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
