import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CouponDiscountType,
  CouponProductType,
  CouponRedemptionStatus,
  CouponSource,
  Prisma,
  TaskAssignmentStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import {
  COUPON_CODE_REGEX,
  CreateCouponDto,
  QueryCouponRedemptionsDto,
  QueryCouponsDto,
  UpdateCouponDto,
} from './dto/coupon.dto';

export const COUPON_RESERVATION_MINUTES = 30;
const COUPON_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MINIMUM_CHARGE_GBP = 0.5;

export interface CouponSummary {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  appliesToAllMemberships: boolean;
  membershipPlanIds: string[];
  appliesToAllAccess: boolean;
  accessPlanIds: string[];
  validFrom: string;
  expiresAt: string | null;
  lockedToUserId: string | null;
  source: CouponSource;
}

export interface CouponChargeQuote {
  coupon: CouponSummary;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: 'GBP';
}

export interface CouponChargeInput {
  code: string;
  userId: string;
  planId: string;
  planName?: string;
  amount: number;
  productType?: CouponProductType;
}

export interface ReserveCouponInput extends CouponChargeInput {
  businessId: string;
  planName: string;
  provider: 'stripe' | 'paypal' | 'wallet';
  providerPaymentId: string;
}

export interface CouponReservation extends CouponChargeQuote {
  redemptionId: string;
  reservedUntil: string;
}

const couponInclude = {
  membershipPlans: {
    include: {
      plan: { select: { id: true, name: true, archived: true, deletedAt: true } },
    },
  },
  accessPlans: {
    include: {
      accessPlan: { select: { id: true, name: true, archived: true, deletedAt: true } },
    },
  },
  lockedToUser: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      businessProfile: { select: { id: true, businessName: true } },
    },
  },
} satisfies Prisma.CouponInclude;

type CouponWithRelations = Prisma.CouponGetPayload<{ include: typeof couponInclude }>;

const redemptionInclude = {
  coupon: {
    select: {
      id: true,
      code: true,
      source: true,
      discountType: true,
      discountValue: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      businessProfile: { select: { id: true, businessName: true } },
    },
  },
  business: { select: { id: true, businessName: true } },
  plan: { select: { id: true, name: true } },
  accessPlan: { select: { id: true, name: true } },
} satisfies Prisma.CouponRedemptionInclude;

type RedemptionWithRelations = Prisma.CouponRedemptionGetPayload<{
  include: typeof redemptionInclude;
}>;

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ─── Shared helpers ───────────────────────────────────────────────

  roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private now(): Date {
    return new Date();
  }

  /** Percentage is 1–99; fixed must leave at least the minimum charge. */
  computeDiscount(
    amount: number,
    discountType: CouponDiscountType,
    discountValue: number,
  ): { originalAmount: number; discountAmount: number; finalAmount: number } {
    const originalAmount = this.roundMoney(Math.max(0, amount));
    const raw =
      discountType === CouponDiscountType.PERCENTAGE
        ? (originalAmount * discountValue) / 100
        : discountValue;
    const discountAmount = this.roundMoney(Math.min(originalAmount, Math.max(0, raw)));
    const finalAmount = this.roundMoney(Math.max(0, originalAmount - discountAmount));
    return { originalAmount, discountAmount, finalAmount };
  }

  private assertPayable(finalAmount: number): void {
    if (finalAmount < MINIMUM_CHARGE_GBP) {
      throw new BadRequestException(
        `This coupon leaves less than £${MINIMUM_CHARGE_GBP.toFixed(2)} to pay. Please use a smaller discount for this membership.`,
      );
    }
  }

  private serializeCoupon(coupon: CouponWithRelations): CouponSummary & {
    membershipPlans: Array<{ id: string; name: string; archived: boolean }>;
    accessPlans: Array<{ id: string; name: string; archived: boolean }>;
    lockedToUser: CouponWithRelations['lockedToUser'];
    status: string;
    timesRedeemed: number;
    maxUses: number | null;
    maxUsesPerUser: number | null;
    isActive: boolean;
  } {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      appliesToAllMemberships: coupon.appliesToAllMemberships,
      membershipPlanIds: coupon.membershipPlans.map((link) => link.planId),
      appliesToAllAccess: coupon.appliesToAllAccess ?? false,
      accessPlanIds: (coupon.accessPlans ?? []).map((link) => link.accessPlanId),
      validFrom: coupon.validFrom.toISOString(),
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      lockedToUserId: coupon.lockedToUserId,
      source: coupon.source,
      membershipPlans: coupon.membershipPlans.map((link) => ({
        id: link.plan.id,
        name: link.plan.name,
        archived: link.plan.archived,
      })),
      accessPlans: (coupon.accessPlans ?? []).map((link) => ({
        id: link.accessPlan.id,
        name: link.accessPlan.name,
        archived: link.accessPlan.archived,
      })),
      lockedToUser: coupon.lockedToUser,
      status: this.deriveStatus(coupon),
      timesRedeemed: coupon.timesRedeemed,
      maxUses: coupon.maxUses,
      maxUsesPerUser: coupon.maxUsesPerUser,
      isActive: coupon.isActive,
    };
  }

  private deriveStatus(coupon: {
    isActive: boolean;
    validFrom: Date;
    expiresAt: Date | null;
    maxUses: number | null;
    timesRedeemed: number;
  }): 'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive' {
    const now = this.now();
    if (!coupon.isActive) return 'inactive';
    if (coupon.validFrom > now) return 'scheduled';
    if (coupon.expiresAt && coupon.expiresAt <= now) return 'expired';
    if (coupon.maxUses !== null && coupon.timesRedeemed >= coupon.maxUses) return 'exhausted';
    return 'active';
  }

  private async assertCouponRedeemable(
    coupon: CouponWithRelations,
    input: CouponChargeInput,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<CouponChargeQuote> {
    const now = this.now();

    if (!coupon.isActive) {
      throw new BadRequestException('This coupon is not active.');
    }
    if (coupon.validFrom > now) {
      throw new BadRequestException('This coupon is not active yet.');
    }
    if (coupon.expiresAt && coupon.expiresAt <= now) {
      throw new BadRequestException('This coupon has expired.');
    }
    const productType = input.productType ?? CouponProductType.MEMBERSHIP;
    if (productType === CouponProductType.ACCESS) {
      const allowed =
        coupon.appliesToAllAccess ||
        (coupon.accessPlans ?? []).some(
          (link) =>
            link.accessPlanId === input.planId &&
            !link.accessPlan.archived &&
            !link.accessPlan.deletedAt,
        );
      if (!allowed) {
        throw new BadRequestException('This coupon cannot be used with the selected access pass.');
      }
    } else if (
      !coupon.appliesToAllMemberships &&
      !coupon.membershipPlans.some(
        (link) => link.planId === input.planId && !link.plan.archived && !link.plan.deletedAt,
      )
    ) {
      throw new BadRequestException('This coupon cannot be used with the selected membership.');
    }
    if (coupon.lockedToUserId && coupon.lockedToUserId !== input.userId) {
      throw new BadRequestException('This coupon is not valid for your account.');
    }

    // Pending reservations held by other shoppers count against the total.
    const otherPending = coupon.maxUses
      ? await client.couponRedemption.count({
          where: {
            couponId: coupon.id,
            status: CouponRedemptionStatus.PENDING,
            reservedUntil: { gt: now },
            userId: { not: input.userId },
          },
        })
      : 0;

    if (
      coupon.maxUses !== null &&
      coupon.timesRedeemed + otherPending >= coupon.maxUses
    ) {
      throw new BadRequestException('This coupon has reached its usage limit.');
    }

    if (coupon.maxUsesPerUser !== null && input.userId) {
      const userCompleted = await client.couponRedemption.count({
        where: {
          couponId: coupon.id,
          userId: input.userId,
          status: CouponRedemptionStatus.COMPLETED,
        },
      });
      if (userCompleted >= coupon.maxUsesPerUser) {
        throw new BadRequestException('You have already used this coupon the maximum number of times.');
      }
    }

    const amounts = this.computeDiscount(
      input.amount,
      coupon.discountType,
      Number(coupon.discountValue),
    );
    this.assertPayable(amounts.finalAmount);

    return {
      coupon: this.serializeCoupon(coupon),
      ...amounts,
      currency: 'GBP',
    };
  }

  private async findCouponByCode(
    code: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<CouponWithRelations> {
    const coupon = await client.coupon.findUnique({
      where: { code: this.normalizeCode(code) },
      include: couponInclude,
    });
    if (!coupon) {
      throw new BadRequestException('This coupon code is not valid.');
    }
    return coupon;
  }

  // ─── Checkout validation / reservation ────────────────────────────

  async validateForCharge(input: CouponChargeInput): Promise<CouponChargeQuote> {
    const coupon = await this.findCouponByCode(input.code);
    return this.assertCouponRedeemable(coupon, input, this.prisma);
  }

  /**
   * Reserve one redemption while the customer completes payment. Locking the
   * coupon row serialises concurrent reservations so maxUses cannot overbook.
   */
  async reserveForCharge(input: ReserveCouponInput): Promise<CouponReservation> {
    return this.prisma.$transaction(async (tx) => {
      const coupon = await this.findCouponByCode(input.code, tx);
      await tx.$queryRaw`SELECT "id" FROM "coupons" WHERE "id" = ${coupon.id} FOR UPDATE`;
      const lockedCoupon =
        (await tx.coupon.findUnique({
          where: { id: coupon.id },
          include: couponInclude,
        })) ?? coupon;

      const quote = await this.assertCouponRedeemable(lockedCoupon, input, tx);
      const now = this.now();
      const reservedUntil = new Date(
        now.getTime() + COUPON_RESERVATION_MINUTES * 60 * 1000,
      );

      // A retry replaces this user's own pending hold; it never blocks them.
      await tx.couponRedemption.updateMany({
        where: {
          couponId: lockedCoupon.id,
          userId: input.userId,
          status: CouponRedemptionStatus.PENDING,
        },
        data: { status: CouponRedemptionStatus.EXPIRED, reservedUntil: null },
      });

      const redemption = await tx.couponRedemption.create({
        data: {
          couponId: lockedCoupon.id,
          couponCode: lockedCoupon.code,
          userId: input.userId,
          businessId: input.businessId,
          planId:
            (input.productType ?? CouponProductType.MEMBERSHIP) === CouponProductType.MEMBERSHIP
              ? input.planId
              : null,
          planName:
            (input.productType ?? CouponProductType.MEMBERSHIP) === CouponProductType.MEMBERSHIP
              ? input.planName ?? null
              : null,
          productType: input.productType ?? CouponProductType.MEMBERSHIP,
          accessPlanId:
            input.productType === CouponProductType.ACCESS ? input.planId : null,
          accessPlanName:
            input.productType === CouponProductType.ACCESS ? input.planName ?? null : null,
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          originalAmount: quote.originalAmount,
          discountAmount: quote.discountAmount,
          finalAmount: quote.finalAmount,
          status: CouponRedemptionStatus.PENDING,
          reservedUntil,
        },
      });

      return {
        ...quote,
        redemptionId: redemption.id,
        reservedUntil: reservedUntil.toISOString(),
      };
    });
  }

  async findReservationForPayment(provider: string, providerPaymentId: string) {
    return this.prisma.couponRedemption.findFirst({
      where: { provider, providerPaymentId },
      select: {
        id: true,
        couponId: true,
        couponCode: true,
        businessId: true,
        userId: true,
        planId: true,
        planName: true,
        productType: true,
        accessPlanId: true,
        accessPlanName: true,
        originalAmount: true,
        discountAmount: true,
        finalAmount: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Release a pending hold after a failed synchronous payment (e.g. wallet). */
  async releaseReservation(redemptionId: string): Promise<void> {
    await this.prisma.couponRedemption.updateMany({
      where: { id: redemptionId, status: CouponRedemptionStatus.PENDING },
      data: { status: CouponRedemptionStatus.EXPIRED, reservedUntil: null },
    });
  }

  /**
   * Reconciliation fallback: a provider payment succeeded but its reservation
   * is missing (e.g. an older in-flight intent). Record the paid discount so
   * the ledger stays complete even though the coupon may now be exhausted.
   */
  async recordPaidRedemption(input: {
    couponCode: string;
    userId?: string;
    businessId?: string;
    planId?: string;
    planName?: string;
    productType?: CouponProductType;
    accessPlanId?: string;
    accessPlanName?: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    provider: string;
    providerPaymentId: string;
  }): Promise<string | null> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: this.normalizeCode(input.couponCode) },
      select: { id: true, code: true },
    });
    if (!coupon) return null;

    return this.prisma.$transaction(async (tx) => {
      const billing = await tx.billingTransaction.findUnique({
        where: { providerPaymentId: input.providerPaymentId },
        select: { id: true },
      });
      if (billing) {
        const existing = await tx.couponRedemption.findUnique({
          where: { billingTransactionId: billing.id },
          select: { id: true },
        });
        if (existing) return existing.id;
      }

      const redemption = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          couponCode: coupon.code,
          userId: input.userId ?? null,
          businessId: input.businessId ?? null,
          planId: input.planId ?? null,
          planName: input.planName ?? null,
          productType: input.productType ?? CouponProductType.MEMBERSHIP,
          accessPlanId: input.accessPlanId ?? null,
          accessPlanName: input.accessPlanName ?? null,
          billingTransactionId: billing?.id ?? null,
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          originalAmount: this.roundMoney(input.originalAmount),
          discountAmount: this.roundMoney(input.discountAmount),
          finalAmount: this.roundMoney(input.finalAmount),
          status: CouponRedemptionStatus.COMPLETED,
          redeemedAt: this.now(),
        },
      });
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { timesRedeemed: { increment: 1 } },
      });
      this.logger.warn(
        `Recorded paid coupon redemption without a reservation: ${coupon.code} (${input.providerPaymentId})`,
      );
      return redemption.id;
    });
  }

  /**
   * Completes a reservation inside the membership activation transaction.
   * Already-completed rows are a no-op (idempotent payment replays).
   */
  async completeRedemption(
    tx: Prisma.TransactionClient,
    redemptionId: string,
    billingTransactionId: string,
    guard?: { businessId?: string; userId?: string },
  ): Promise<void> {
    const redemption = await tx.couponRedemption.findUnique({
      where: { id: redemptionId },
    });
    if (!redemption) {
      throw new NotFoundException('Coupon reservation not found.');
    }
    if (guard?.businessId && redemption.businessId && guard.businessId !== redemption.businessId) {
      throw new ConflictException('Coupon reservation belongs to a different business.');
    }
    if (guard?.userId && redemption.userId && guard.userId !== redemption.userId) {
      throw new ConflictException('Coupon reservation belongs to a different user.');
    }
    if (redemption.status === CouponRedemptionStatus.COMPLETED) return;

    await tx.couponRedemption.update({
      where: { id: redemption.id },
      data: {
        status: CouponRedemptionStatus.COMPLETED,
        redeemedAt: this.now(),
        reservedUntil: null,
        billingTransactionId,
      },
    });
    await tx.coupon.update({
      where: { id: redemption.couponId },
      data: { timesRedeemed: { increment: 1 } },
    });
  }

  /** Expire abandoned checkout holds. Runs every 10 minutes. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStaleReservations(): Promise<number> {
    const result = await this.prisma.couponRedemption.updateMany({
      where: {
        status: CouponRedemptionStatus.PENDING,
        reservedUntil: { lt: this.now() },
      },
      data: { status: CouponRedemptionStatus.EXPIRED, reservedUntil: null },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale coupon reservation(s)`);
    }
    return result.count;
  }

  // ─── Task reward coupons ──────────────────────────────────────────

  private generateCode(prefix: 'MCOM' | 'TASK'): string {
    let suffix = '';
    for (let i = 0; i < 8; i += 1) {
      suffix += COUPON_ALPHABET[crypto.randomInt(0, COUPON_ALPHABET.length)];
    }
    return `${prefix}-${suffix}`;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private discountLabel(type: CouponDiscountType, value: number): string {
    return type === CouponDiscountType.PERCENTAGE
      ? `${value}% off`
      : `£${this.roundMoney(value).toFixed(2)} off`;
  }

  async issueTaskRewardCoupon(assignmentId: string): Promise<{
    couponId: string;
    code: string;
    emailed: boolean;
  } | null> {
    const assignment = await this.prisma.userTaskAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        task: {
          include: {
            rewardCouponPlans: { include: { plan: { select: { id: true, name: true } } } },
            rewardCouponAccessPlans: {
              include: { accessPlan: { select: { id: true, name: true } } },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            businessProfile: { select: { id: true } },
          },
        },
      },
    });

    if (!assignment) {
      this.logger.warn(`Cannot issue task coupon: assignment ${assignmentId} not found`);
      return null;
    }
    if (assignment.status !== TaskAssignmentStatus.COMPLETED) {
      this.logger.warn(
        `Skipping task coupon for assignment ${assignmentId}: status is ${assignment.status}`,
      );
      return null;
    }

    const task = assignment.task;
    if (!task.rewardCouponEnabled) return null;

    const existing = await this.prisma.coupon.findUnique({
      where: { taskAssignmentId: assignmentId },
      include: couponInclude,
    });

    if (existing) {
      if (!existing.emailSentAt) {
        await this.sendTaskCouponEmail(existing, assignment, task.title);
      }
      return { couponId: existing.id, code: existing.code, emailed: true };
    }

    const now = this.now();
    let expiresAt: Date | null = null;
    if (task.rewardCouponValidDays) {
      expiresAt = this.addDays(now, task.rewardCouponValidDays);
    }
    if (task.rewardCouponExpiresAt) {
      expiresAt = expiresAt
        ? new Date(Math.min(expiresAt.getTime(), task.rewardCouponExpiresAt.getTime()))
        : task.rewardCouponExpiresAt;
    }
    if (expiresAt && expiresAt <= now) {
      this.logger.warn(
        `Task ${task.id} reward coupon expiry has passed; skipping issuance for assignment ${assignmentId}`,
      );
      return null;
    }

    const planIds = task.rewardCouponAppliesToAll
      ? []
      : task.rewardCouponPlans.map((link) => link.planId);
    const accessPlanIds = task.rewardCouponAppliesToAllAccess
      ? []
      : (task.rewardCouponAccessPlans ?? []).map((link) => link.accessPlanId);

    const hasMembershipScope = task.rewardCouponAppliesToAll || planIds.length > 0;
    const hasAccessScope = task.rewardCouponAppliesToAllAccess || accessPlanIds.length > 0;

    if (!hasMembershipScope && !hasAccessScope) {
      this.logger.warn(
        `Task ${task.id} reward coupon has no remaining membership or access plans; skipping issuance for assignment ${assignmentId}`,
      );
      return null;
    }

    if (!task.rewardCouponDiscountType || task.rewardCouponValue === null) {
      this.logger.warn(`Task ${task.id} has incomplete coupon reward config; skipping`);
      return null;
    }

    let created: CouponWithRelations | null = null;
    for (let attempt = 0; attempt < 6 && !created; attempt += 1) {
      try {
        created = await this.prisma.coupon.create({
          data: {
            code: this.generateCode('TASK'),
            description: `Reward for completing "${task.title}"`,
            discountType: task.rewardCouponDiscountType,
            discountValue: Number(task.rewardCouponValue),
            appliesToAllMemberships: task.rewardCouponAppliesToAll,
            appliesToAllAccess: task.rewardCouponAppliesToAllAccess,
            maxUses: 1,
            maxUsesPerUser: 1,
            validFrom: now,
            expiresAt,
            isActive: true,
            source: CouponSource.TASK_REWARD,
            lockedToUserId: assignment.userId,
            taskDefinitionId: task.id,
            taskAssignmentId: assignment.id,
            createdByName: 'Task Engine',
            ...(planIds.length > 0
              ? {
                  membershipPlans: {
                    createMany: { data: planIds.map((planId) => ({ planId })) },
                  },
                }
              : {}),
            ...(accessPlanIds.length > 0
              ? {
                  accessPlans: {
                    createMany: {
                      data: accessPlanIds.map((accessPlanId) => ({ accessPlanId })),
                    },
                  },
                }
              : {}),
          },
          include: couponInclude,
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const raced = await this.prisma.coupon.findUnique({
            where: { taskAssignmentId: assignmentId },
            include: couponInclude,
          });
          if (raced) {
            created = raced;
            break;
          }
          continue;
        }
        throw err;
      }
    }

    if (!created) {
      this.logger.error(`Failed to allocate a unique task coupon code for ${assignmentId}`);
      return null;
    }

    await this.sendTaskCouponEmail(created, assignment, task.title);
    return { couponId: created.id, code: created.code, emailed: true };
  }

  private async sendTaskCouponEmail(
    coupon: CouponWithRelations,
    assignment: {
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        businessProfile: { id: string } | null;
      };
    },
    taskTitle: string,
  ): Promise<void> {
    const planNames = coupon.membershipPlans.map((link) => link.plan.name);
    const accessPlanNames = (coupon.accessPlans ?? []).map((link) => link.accessPlan.name);
    const membershipScope = coupon.appliesToAllMemberships
      ? 'any MCOM membership'
      : planNames.length > 0
        ? planNames.join(', ')
        : null;
    const accessScope = coupon.appliesToAllAccess
      ? 'any MCOM access pass'
      : accessPlanNames.length > 0
        ? accessPlanNames.join(', ')
        : null;
    const scope = [membershipScope, accessScope].filter(Boolean).join(' · ') ||
      'selected MCOM products';
    const expiry = coupon.expiresAt
      ? coupon.expiresAt.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'No expiry date';
    const name = assignment.user.firstName?.trim() || 'there';
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const safeTitle = this.escapeHtml(taskTitle);
    const safeCode = this.escapeHtml(coupon.code);
    const safeScope = this.escapeHtml(scope);
    const safeDiscount = this.escapeHtml(
      this.discountLabel(coupon.discountType, Number(coupon.discountValue)),
    );

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; color: #111827;">
        <h2 style="color: #ea580c; text-align: center; margin: 0 0 20px;">Central Hub Solution</h2>
        <p>Hi ${this.escapeHtml(name)},</p>
        <p>You completed <strong>${safeTitle}</strong> — here is your reward coupon.</p>
        <div style="background-color: #fff7ed; border: 1px dashed #fb923c; border-radius: 12px; text-align: center; padding: 20px; margin: 24px 0;">
          <div style="font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #9a3412; font-weight: bold;">Your reward code</div>
          <div style="font-size: 30px; font-weight: bold; letter-spacing: 4px; color: #c2410c; margin-top: 8px;">${safeCode}</div>
          <div style="font-size: 14px; color: #7c2d12; margin-top: 10px;">${safeDiscount} · valid on ${safeScope}</div>
        </div>
        <p style="font-size: 14px; color: #4b5563;">This code is personal to you, can be used once, and expires on <strong>${this.escapeHtml(expiry)}</strong>.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${appUrl}/membership" style="display: inline-block; background: #ea580c; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: bold;">Use my coupon</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">© 2026 Central Hub Solution. All rights reserved.</p>
      </div>
    `;

    await this.mailService.send({
      to: assignment.user.email,
      subject: `Your ${this.discountLabel(coupon.discountType, Number(coupon.discountValue))} MCOM coupon`,
      html,
      text: `You completed "${taskTitle}". Your one-time ${this.discountLabel(
        coupon.discountType,
        Number(coupon.discountValue),
      )} coupon is ${coupon.code}, valid on ${scope}. Expires: ${expiry}.`,
    });

    await this.prisma.coupon.update({
      where: { id: coupon.id },
      data: { emailSentAt: this.now() },
    });

    try {
      await this.prisma.notification.create({
        data: {
          userId: assignment.user.id,
          businessId: assignment.user.businessProfile?.id ?? null,
          type: 'reward',
          title: 'Membership coupon unlocked 🎉',
          message: `You earned ${this.discountLabel(
            coupon.discountType,
            Number(coupon.discountValue),
          )} for completing "${taskTitle}". Code: ${coupon.code}.`,
          read: false,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Task coupon ${coupon.code} issued but in-app notification failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async resendTaskCouponEmail(couponId: string, adminName: string): Promise<{ sent: boolean }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        ...couponInclude,
        taskAssignment: {
          include: {
            task: { select: { title: true } },
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                businessProfile: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.source !== CouponSource.TASK_REWARD || !coupon.taskAssignment) {
      throw new BadRequestException('Only task reward coupons can be emailed');
    }

    await this.sendTaskCouponEmail(coupon, coupon.taskAssignment, coupon.taskAssignment.task.title);
    await this.logAudit(
      'Coupon Reward Email Resent',
      coupon.code,
      `Resent reward email for task assignment ${coupon.taskAssignmentId}`,
      adminName,
    );
    return { sent: true };
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────

  private async logAudit(
    action: string,
    targetName: string,
    details: string,
    adminName = 'Admin',
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          adminName,
          targetType: 'Coupon',
          targetName,
          details,
          category: 'Billing',
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write coupon audit log: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async assertPlansExist(planIds: string[]): Promise<void> {
    if (planIds.length === 0) {
      throw new BadRequestException('Select at least one membership plan.');
    }
    const unique = [...new Set(planIds)];
    const count = await this.prisma.membershipPlan.count({
      where: { id: { in: unique }, deletedAt: null },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more selected membership plans do not exist.');
    }
  }

  private async assertAccessPlansExist(accessPlanIds: string[]): Promise<void> {
    if (accessPlanIds.length === 0) {
      throw new BadRequestException('Select at least one access plan.');
    }
    const unique = [...new Set(accessPlanIds)];
    const count = await this.prisma.accessPlan.count({
      where: { id: { in: unique }, deletedAt: null },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more selected access plans do not exist.');
    }
  }

  private async assertLockedUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('The selected user does not exist.');
  }

  private validateDiscount(type: CouponDiscountType, value: number): void {
    if (type === CouponDiscountType.PERCENTAGE) {
      if (!Number.isFinite(value) || value <= 0 || value >= 100) {
        throw new BadRequestException('Percentage discounts must be between 1% and 99%.');
      }
    } else if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Fixed discounts must be greater than £0.');
    }
  }

  private validateWindow(validFrom: Date, expiresAt: Date | null): void {
    if (expiresAt && expiresAt <= validFrom) {
      throw new BadRequestException('The expiry date must be after the valid-from date.');
    }
  }

  async createCoupon(dto: CreateCouponDto, adminName = 'Admin') {
    const code = this.normalizeCode(dto.code);
    if (!COUPON_CODE_REGEX.test(code)) {
      throw new BadRequestException('Coupon code format is invalid.');
    }
    this.validateDiscount(dto.discountType, dto.discountValue);

    const appliesToAllMemberships = dto.appliesToAllMemberships ?? true;
    const membershipPlanIds = appliesToAllMemberships
      ? []
      : [...new Set(dto.membershipPlanIds ?? [])];
    const appliesToAllAccess = dto.appliesToAllAccess ?? false;
    const accessPlanIds = appliesToAllAccess ? [] : [...new Set(dto.accessPlanIds ?? [])];

    const hasMembershipScope = appliesToAllMemberships || membershipPlanIds.length > 0;
    const hasAccessScope = appliesToAllAccess || accessPlanIds.length > 0;
    if (!hasMembershipScope && !hasAccessScope) {
      throw new BadRequestException(
        'Select at least one membership or access plan for this coupon.',
      );
    }
    if (!appliesToAllMemberships && membershipPlanIds.length > 0) {
      await this.assertPlansExist(membershipPlanIds);
    }
    if (!appliesToAllAccess && accessPlanIds.length > 0) {
      await this.assertAccessPlansExist(accessPlanIds);
    }

    if (dto.lockedToUserId) await this.assertLockedUserExists(dto.lockedToUserId);

    if (dto.maxUses != null && dto.maxUsesPerUser != null && dto.maxUsesPerUser > dto.maxUses) {
      throw new BadRequestException('Per-user limit cannot exceed the total usage limit.');
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : this.now();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    this.validateWindow(validFrom, expiresAt);

    try {
      const coupon = await this.prisma.coupon.create({
        data: {
          code,
          description: dto.description?.trim() || null,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          appliesToAllMemberships,
          appliesToAllAccess,
          maxUses: dto.maxUses ?? null,
          maxUsesPerUser: dto.maxUsesPerUser === undefined ? 1 : dto.maxUsesPerUser,
          validFrom,
          expiresAt,
          isActive: dto.isActive ?? true,
          source: CouponSource.ADMIN,
          lockedToUserId: dto.lockedToUserId || null,
          createdByName: adminName,
          ...(membershipPlanIds.length > 0
            ? {
                membershipPlans: {
                  createMany: { data: membershipPlanIds.map((planId) => ({ planId })) },
                },
              }
            : {}),
          ...(accessPlanIds.length > 0
            ? {
                accessPlans: {
                  createMany: {
                    data: accessPlanIds.map((accessPlanId) => ({ accessPlanId })),
                  },
                },
              }
            : {}),
        },
        include: couponInclude,
      });

      await this.logAudit(
        'Coupon Created',
        coupon.code,
        `${this.discountLabel(coupon.discountType, Number(coupon.discountValue))}; scope=${
          [
            appliesToAllMemberships ? 'all memberships' : membershipPlanIds.join(', '),
            appliesToAllAccess ? 'all access' : accessPlanIds.join(', '),
          ]
            .filter(Boolean)
            .join(' + ') || 'none'
        }; maxUses=${coupon.maxUses ?? 'unlimited'}`,
        adminName,
      );
      return { success: true, data: this.serializeCoupon(coupon) };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Coupon code "${code}" already exists.`);
      }
      throw err;
    }
  }

  async updateCoupon(id: string, dto: UpdateCouponDto, adminName = 'Admin') {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
      include: couponInclude,
    });
    if (!existing) throw new NotFoundException('Coupon not found');
    if (existing.source === CouponSource.TASK_REWARD) {
      throw new BadRequestException('Task reward coupons are managed by the task that issued them.');
    }

    const code = dto.code !== undefined ? this.normalizeCode(dto.code) : existing.code;
    if (code !== existing.code && existing.timesRedeemed > 0) {
      throw new BadRequestException('The code cannot be changed after it has been redeemed.');
    }

    const discountType = dto.discountType ?? existing.discountType;
    const discountValue = dto.discountValue ?? Number(existing.discountValue);
    this.validateDiscount(discountType, discountValue);

    const appliesToAllMemberships =
      dto.appliesToAllMemberships ?? existing.appliesToAllMemberships;
    const appliesToAllAccess = dto.appliesToAllAccess ?? existing.appliesToAllAccess ?? false;

    const membershipPlanIds = appliesToAllMemberships
      ? []
      : dto.membershipPlanIds !== undefined
        ? [...new Set(dto.membershipPlanIds)]
        : existing.membershipPlans.map((link) => link.planId);
    const accessPlanIds = appliesToAllAccess
      ? []
      : dto.accessPlanIds !== undefined
        ? [...new Set(dto.accessPlanIds)]
        : (existing.accessPlans ?? []).map((link) => link.accessPlanId);

    const hasMembershipScope = appliesToAllMemberships || membershipPlanIds.length > 0;
    const hasAccessScope = appliesToAllAccess || accessPlanIds.length > 0;
    if (!hasMembershipScope && !hasAccessScope) {
      throw new BadRequestException(
        'Select at least one membership or access plan for this coupon.',
      );
    }
    if (!appliesToAllMemberships && membershipPlanIds.length > 0) {
      await this.assertPlansExist(membershipPlanIds);
    }
    if (!appliesToAllAccess && accessPlanIds.length > 0) {
      await this.assertAccessPlansExist(accessPlanIds);
    }

    if (dto.lockedToUserId) await this.assertLockedUserExists(dto.lockedToUserId);

    const maxUses = dto.maxUses !== undefined ? dto.maxUses : existing.maxUses;
    const maxUsesPerUser =
      dto.maxUsesPerUser !== undefined ? dto.maxUsesPerUser : existing.maxUsesPerUser;
    if (maxUses != null && maxUsesPerUser != null && maxUsesPerUser > maxUses) {
      throw new BadRequestException('Per-user limit cannot exceed the total usage limit.');
    }
    if (maxUses != null && maxUses < existing.timesRedeemed) {
      throw new BadRequestException(
        `This coupon has already been redeemed ${existing.timesRedeemed} times — the limit cannot be lower.`,
      );
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : existing.validFrom;
    const expiresAt =
      dto.expiresAt !== undefined
        ? dto.expiresAt
          ? new Date(dto.expiresAt)
          : null
        : existing.expiresAt;
    this.validateWindow(validFrom, expiresAt);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.couponMembershipPlan.deleteMany({ where: { couponId: id } });
      await tx.couponAccessPlan.deleteMany({ where: { couponId: id } });
      return tx.coupon.update({
        where: { id },
        data: {
          code,
          description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
          discountType,
          discountValue,
          appliesToAllMemberships,
          appliesToAllAccess,
          maxUses,
          maxUsesPerUser,
          validFrom,
          expiresAt,
          isActive: dto.isActive ?? existing.isActive,
          lockedToUserId:
            dto.lockedToUserId !== undefined ? dto.lockedToUserId || null : existing.lockedToUserId,
          ...(membershipPlanIds.length > 0
            ? {
                membershipPlans: {
                  createMany: { data: membershipPlanIds.map((planId) => ({ planId })) },
                },
              }
            : {}),
          ...(accessPlanIds.length > 0
            ? {
                accessPlans: {
                  createMany: {
                    data: accessPlanIds.map((accessPlanId) => ({ accessPlanId })),
                  },
                },
              }
            : {}),
        },
        include: couponInclude,
      });
    });

    await this.logAudit(
      'Coupon Updated',
      updated.code,
      `Updated coupon "${updated.code}" (${this.discountLabel(
        updated.discountType,
        Number(updated.discountValue),
      )})`,
      adminName,
    );
    return { success: true, data: this.serializeCoupon(updated) };
  }

  async setCouponStatus(id: string, isActive: boolean, adminName = 'Admin') {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { isActive },
      include: couponInclude,
    });
    await this.logAudit(
      isActive ? 'Coupon Activated' : 'Coupon Deactivated',
      updated.code,
      `${isActive ? 'Activated' : 'Deactivated'} coupon "${updated.code}"`,
      adminName,
    );
    return { success: true, data: this.serializeCoupon(updated) };
  }

  async getCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: couponInclude,
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return { success: true, data: this.serializeCoupon(coupon) };
  }

  private async exhaustedCouponIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "coupons"
      WHERE "max_uses" IS NOT NULL AND "times_redeemed" >= "max_uses"
    `;
    return rows.map((row) => row.id);
  }

  async listCoupons(query: QueryCouponsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const now = this.now();
    const where: Prisma.CouponWhereInput = {};
    const and: Prisma.CouponWhereInput[] = [];

    if (query.search) {
      and.push({
        OR: [
          { code: { contains: query.search.trim().toUpperCase(), mode: 'insensitive' } },
          { description: { contains: query.search.trim(), mode: 'insensitive' } },
        ],
      });
    }
    if (query.source) and.push({ source: query.source });
    if (query.discountType) and.push({ discountType: query.discountType });
    if (query.planId) {
      and.push({ membershipPlans: { some: { planId: query.planId } } });
    }
    if (query.accessPlanId) {
      and.push({ accessPlans: { some: { accessPlanId: query.accessPlanId } } });
    }

    if (query.status) {
      switch (query.status) {
        case 'inactive':
          and.push({ isActive: false });
          break;
        case 'scheduled':
          and.push({ isActive: true, validFrom: { gt: now } });
          break;
        case 'expired':
          and.push({ isActive: true, expiresAt: { lte: now } });
          break;
        case 'exhausted': {
          const ids = await this.exhaustedCouponIds();
          and.push({ id: { in: ids } });
          break;
        }
        case 'active': {
          const exhausted = await this.exhaustedCouponIds();
          and.push({
            isActive: true,
            validFrom: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            ...(exhausted.length > 0 ? { id: { notIn: exhausted } } : {}),
          });
          break;
        }
      }
    }

    if (and.length > 0) where.AND = and;

    const [total, rows] = await Promise.all([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        include: couponInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: rows.map((row) => this.serializeCoupon(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats() {
    const now = this.now();
    const [total, active, scheduled, expired, redemptions, discountAgg, monthAgg] =
      await Promise.all([
        this.prisma.coupon.count(),
        this.prisma.coupon.count({
          where: {
            isActive: true,
            validFrom: { lte: now },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        }),
        this.prisma.coupon.count({ where: { isActive: true, validFrom: { gt: now } } }),
        this.prisma.coupon.count({ where: { expiresAt: { lte: now } } }),
        this.prisma.couponRedemption.count({
          where: { status: CouponRedemptionStatus.COMPLETED },
        }),
        this.prisma.couponRedemption.aggregate({
          where: { status: CouponRedemptionStatus.COMPLETED },
          _sum: { discountAmount: true },
        }),
        this.prisma.couponRedemption.aggregate({
          where: {
            status: CouponRedemptionStatus.COMPLETED,
            redeemedAt: {
              gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
            },
          },
          _sum: { discountAmount: true },
          _count: { _all: true },
        }),
      ]);

    return {
      success: true,
      data: {
        totalCoupons: total,
        activeCoupons: active,
        scheduledCoupons: scheduled,
        expiredCoupons: expired,
        totalRedemptions: redemptions,
        totalDiscountGiven: this.roundMoney(discountAgg._sum.discountAmount ?? 0),
        redemptionsThisMonth: monthAgg._count._all,
        discountThisMonth: this.roundMoney(monthAgg._sum.discountAmount ?? 0),
      },
    };
  }

  async listRedemptions(query: QueryCouponRedemptionsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const and: Prisma.CouponRedemptionWhereInput[] = [];

    if (query.status) and.push({ status: query.status });
    if (query.couponId) and.push({ couponId: query.couponId });
    if (query.planId) and.push({ planId: query.planId });
    if (query.accessPlanId) and.push({ accessPlanId: query.accessPlanId });
    if (query.businessId) and.push({ businessId: query.businessId });
    if (query.source) and.push({ coupon: { source: query.source } });
    if (query.search) {
      const term = query.search.trim();
      and.push({
        OR: [
          { couponCode: { contains: term, mode: 'insensitive' } },
          { user: { email: { contains: term, mode: 'insensitive' } } },
          { user: { firstName: { contains: term, mode: 'insensitive' } } },
          { user: { lastName: { contains: term, mode: 'insensitive' } } },
          { business: { businessName: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    if (from || to) {
      const range = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
      and.push({
        OR: [
          { redeemedAt: range },
          {
            status: { not: CouponRedemptionStatus.COMPLETED },
            createdAt: range,
          },
        ],
      });
    }

    const where: Prisma.CouponRedemptionWhereInput = and.length > 0 ? { AND: and } : {};

    const [total, rows] = await Promise.all([
      this.prisma.couponRedemption.count({ where }),
      this.prisma.couponRedemption.findMany({
        where,
        include: redemptionInclude,
        orderBy: [{ redeemedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: rows.map((row) => this.serializeRedemption(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private serializeRedemption(row: RedemptionWithRelations) {
    const name = [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ');
    return {
      id: row.id,
      couponId: row.couponId,
      couponCode: row.couponCode,
      source: row.coupon.source,
      discountType: row.coupon.discountType,
      discountValue: Number(row.coupon.discountValue),
      user: row.user
        ? {
            id: row.user.id,
            email: row.user.email,
            name: name || row.user.email,
            businessName: row.user.businessProfile?.businessName ?? null,
          }
        : null,
      business: row.business
        ? { id: row.business.id, businessName: row.business.businessName }
        : null,
      plan: row.plan ? { id: row.plan.id, name: row.plan.name } : null,
      planName: row.planName,
      productType: row.productType,
      accessPlan: row.accessPlan ? { id: row.accessPlan.id, name: row.accessPlan.name } : null,
      accessPlanName: row.accessPlanName,
      provider: row.provider,
      providerPaymentId: row.providerPaymentId,
      originalAmount: Number(row.originalAmount),
      discountAmount: Number(row.discountAmount),
      finalAmount: Number(row.finalAmount),
      status: row.status,
      reservedUntil: row.reservedUntil?.toISOString() ?? null,
      redeemedAt: row.redeemedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async lookupUsers(search: string) {
    const term = search.trim();
    if (term.length < 2) return { success: true, data: [] };

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { businessProfile: { businessName: { contains: term, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        businessProfile: { select: { id: true, businessName: true } },
      },
      orderBy: { email: 'asc' },
      take: 20,
    });

    return {
      success: true,
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        role: user.role,
        businessName: user.businessProfile?.businessName ?? null,
      })),
    };
  }

  /**
   * Business-dashboard wallet of coupons: codes assigned to this user plus any
   * public coupon they have already redeemed (shown as usage history).
   */
  async listMyCoupons(userId: string) {
    const coupons = await this.prisma.coupon.findMany({
      where: {
        OR: [
          { lockedToUserId: userId },
          {
            redemptions: {
              some: {
                userId,
                status: CouponRedemptionStatus.COMPLETED,
              },
            },
          },
        ],
      },
      include: {
        membershipPlans: {
          include: { plan: { select: { id: true, name: true, archived: true } } },
        },
        accessPlans: {
          include: { accessPlan: { select: { id: true, name: true, archived: true } } },
        },
        redemptions: {
          where: { userId, status: CouponRedemptionStatus.COMPLETED },
          select: {
            id: true,
            redeemedAt: true,
            discountAmount: true,
            finalAmount: true,
            planName: true,
          },
          orderBy: { redeemedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = coupons.map((coupon) => {
      const status = this.deriveStatus(coupon);
      const usedCount = coupon.redemptions.length;
      const perUserLimitReached =
        coupon.maxUsesPerUser !== null && usedCount >= coupon.maxUsesPerUser;
      const canUse = status === 'active' && !perUserLimitReached;
      const usageStatus = perUserLimitReached
        ? 'used'
        : status === 'active'
          ? usedCount > 0
            ? 'partially_used'
            : 'available'
          : status;

      return {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        appliesToAllMemberships: coupon.appliesToAllMemberships,
        membershipPlans: coupon.membershipPlans.map((link) => link.plan.name),
        appliesToAllAccess: coupon.appliesToAllAccess ?? false,
        accessPlans: (coupon.accessPlans ?? []).map((link) => link.accessPlan.name),
        validFrom: coupon.validFrom.toISOString(),
        expiresAt: coupon.expiresAt?.toISOString() ?? null,
        source: coupon.source,
        isPersonal: coupon.lockedToUserId === userId,
        couponStatus: status,
        usageStatus,
        used: usedCount > 0,
        usedCount,
        maxUsesPerUser: coupon.maxUsesPerUser,
        canUse,
        lastUsedAt: coupon.redemptions[0]?.redeemedAt?.toISOString() ?? null,
        totalSaved: this.roundMoney(
          coupon.redemptions.reduce(
            (sum, redemption) => sum + Number(redemption.discountAmount),
            0,
          ),
        ),
        redemptions: coupon.redemptions.map((redemption) => ({
          id: redemption.id,
          redeemedAt: redemption.redeemedAt?.toISOString() ?? null,
          discountAmount: Number(redemption.discountAmount),
          finalAmount: Number(redemption.finalAmount),
          planName: redemption.planName,
        })),
      };
    });

    const rank = (coupon: (typeof data)[number]): number => {
      if (coupon.canUse) return 0;
      if (coupon.used) return 1;
      if (coupon.couponStatus === 'scheduled') return 2;
      return 3;
    };

    data.sort((a, b) => {
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      const aExpiry = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aExpiry - bExpiry;
    });

    return { success: true, data };
  }
}
