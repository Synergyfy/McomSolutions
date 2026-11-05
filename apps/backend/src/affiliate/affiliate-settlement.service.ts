import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AffiliateCompensationModel,
  AffiliatePaymentStatus,
  AffiliateSettlementFunding,
  AffiliateSettlementStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

/** Internal platform identity used for escrow holds and payouts. */
const PLATFORM_CLIENT_ID = 'mcom-central';
const DEFAULT_FEE_PERCENT = '10';
const MAX_HOLD_HOURS = 24 * 365;

export interface EnsureSettlementInput {
  /** Optional per-task override, e.g. an admin negotiating the platform cut. */
  platformFeePercent?: number;
  /** Pricing/assignee overrides applied before the hold is taken. */
  compensationModel?: AffiliateCompensationModel;
  compensationAmount?: number | null;
  billableToBusiness?: boolean;
  businessChargeAmount?: number | null;
  assigneeId?: string | null;
  assigneeEmail?: string | null;
  /** Free/chargeable decision already made by the delegation quota. */
  freeDelegation?: boolean | null;
}

export interface SettlementQueryInput {
  page?: number;
  limit?: number;
  status?: AffiliateSettlementStatus;
  fundingSource?: AffiliateSettlementFunding;
  businessId?: string;
  affiliateUserId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface SettlementQuote {
  paidMembership: boolean;
  billable: boolean;
  compensationModel: AffiliateCompensationModel;
  compensationAmount: Decimal | null;
  compensationCredits: Decimal;
  businessChargeAmount: Decimal | null;
  businessChargeCredits: Decimal;
  platformFeePercent: Decimal;
  platformFeeCredits: Decimal;
  platformMarginCredits: Decimal;
  affiliatePayoutCredits: Decimal;
  fundingSource: AffiliateSettlementFunding;
  fxRate: Decimal;
  status: AffiliateSettlementStatus;
  holdId: string | null;
  holdExpiresAt: Date | null;
}

/**
 * Escrow + settlement for delegated affiliate tasks.
 *
 * Money never moves on assignment: the business wallet is *held*, then captured
 * only when the review chain approves the work. Settlement then credits the
 * affiliate's central MCOM wallet and books the platform fee.
 *
 * Active paid memberships are never charged again — the platform funds the
 * affiliate payout (`fundingSource = PLATFORM`).
 */
@Injectable()
export class AffiliateSettlementService {
  private readonly logger = new Logger(AffiliateSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────── Pricing / escrow ───────────────────────────

  /**
   * Create or refresh the settlement for a task. Idempotent: repeated calls
   * with the same pricing keep the existing hold. A changed price releases the
   * old hold and reserves the new amount before the task is updated.
   */
  async ensureForTask(taskId: string, input: EnsureSettlementInput = {}) {
    const loaded = await this.loadTask(taskId);
    const task = this.applyOverrides(loaded, input);
    const existing = task.settlement;

    if (existing?.status === AffiliateSettlementStatus.SETTLED) {
      return existing;
    }

    const quote = await this.quote(task, existing, input);
    if (quote.status === AffiliateSettlementStatus.NOT_REQUIRED) {
      if (existing?.holdId) {
        await this.releaseHoldQuietly(existing.holdId);
      }
      return this.upsert(task, existing, quote, null, null);
    }

    let holdId = existing?.holdId ?? null;
    let holdExpiresAt = existing?.holdExpiresAt ?? null;

    if (quote.fundingSource === AffiliateSettlementFunding.BUSINESS_WALLET) {
      const liveHold = existing?.holdId
        ? await this.prisma.walletHold.findUnique({ where: { id: existing.holdId } })
        : null;
      const holdIsCurrent =
        existing?.holdId &&
        liveHold?.status === 'ACTIVE' &&
        (existing.status === AffiliateSettlementStatus.HELD ||
          existing.status === AffiliateSettlementStatus.SETTLING) &&
        this.sameDecimal(existing.businessChargeCredits, quote.businessChargeCredits);

      if (!holdIsCurrent) {
        // Release a stale reservation before taking a new one.
        if (existing?.holdId) {
          await this.releaseHoldQuietly(existing.holdId);
        }
        try {
          const partner = await this.wallet.resolvePartner(PLATFORM_CLIENT_ID);
          const hold = await this.wallet.placeHold(partner, {
            userId: task.business.userId,
            amount: quote.businessChargeCredits.toNumber(),
            reference: `affiliate-task:${task.id}:hold`,
            description: `Escrow for task "${task.title}" (${task.business.businessName})`,
            ttlHours: this.holdTtlHours(task.dueAt),
          });
          holdId = hold.holdId;
          holdExpiresAt = new Date(hold.expiresAt);
        } catch (error: any) {
          const reason = this.describeHoldError(error, task.business.businessName);
          const failed = await this.upsert(
            task,
            existing,
            { ...quote, holdId: null, holdExpiresAt: null },
            null,
            reason,
          );
          // Keep the task-level message actionable for the admin UI.
          throw new UnprocessableEntityException({
            error: 'TASK_ESCROW_FAILED',
            message: reason,
            settlementId: failed.id,
            businessChargeCredits: quote.businessChargeCredits.toNumber(),
          });
        }
      }
    } else if (existing?.holdId) {
      // A membership upgrade / pricing change moved this task to platform-funded
      // work; the old business reservation must be returned.
      await this.releaseHoldQuietly(existing.holdId);
      holdId = null;
      holdExpiresAt = null;
    }

    return this.upsert(
      task,
      existing,
      { ...quote, holdId, holdExpiresAt },
      holdId,
      null,
    );
  }

  /**
   * Capture the business hold and pay the affiliate. Safe to retry: each leg
   * carries an idempotency key and terminal statuses short-circuit.
   */
  async settleTask(taskId: string) {
    let settlement = await this.prisma.affiliateTaskSettlement.findUnique({
      where: { taskId },
      include: { task: true },
    });

    if (!settlement) {
      await this.ensureForTask(taskId);
      settlement = await this.prisma.affiliateTaskSettlement.findUnique({
        where: { taskId },
        include: { task: true },
      });
    }
    if (!settlement) throw new NotFoundException('Task settlement not found');

    if (settlement.status === AffiliateSettlementStatus.SETTLED) return settlement;
    if (settlement.status === AffiliateSettlementStatus.RELEASED) {
      throw new ConflictException(
        'This task settlement was released; re-price and re-assign to escrow again.',
      );
    }

    // No money to move at all.
    if (
      settlement.status === AffiliateSettlementStatus.NOT_REQUIRED ||
      (this.decimalOf(settlement.affiliatePayoutCredits).isZero() &&
        this.decimalOf(settlement.businessChargeCredits).isZero())
    ) {
      return this.markSettled(settlement.id, {
        businessTransactionId: null,
        affiliateTransactionId: null,
      });
    }

    // A business-funded settlement must have a live reservation. Without one we
    // would pay the affiliate without collecting from the business.
    if (
      settlement.fundingSource === AffiliateSettlementFunding.BUSINESS_WALLET &&
      this.decimalOf(settlement.businessChargeCredits).greaterThan(0) &&
      !settlement.holdId
    ) {
      await this.prisma.affiliateTaskSettlement.update({
        where: { id: settlement.id },
        data: {
          status: AffiliateSettlementStatus.FAILED,
          failureReason: 'Business escrow is missing; re-assign the task to reserve funds again',
        },
      });
      await this.prisma.affiliateTask.updateMany({
        where: { id: taskId, paymentStatus: { not: AffiliatePaymentStatus.PAID } },
        data: { paymentStatus: AffiliatePaymentStatus.ON_HOLD },
      });
      throw new ConflictException(
        'Business escrow is missing. Re-assign the task so funds can be reserved before payout.',
      );
    }

    // Never take the business charge if there is nobody to pay.
    if (this.decimalOf(settlement.affiliatePayoutCredits).greaterThan(0) && !settlement.affiliateUserId) {
      await this.prisma.affiliateTaskSettlement.update({
        where: { id: settlement.id },
        data: {
          status: AffiliateSettlementStatus.FAILED,
          failureReason: 'No affiliate is linked to this payout',
        },
      });
      await this.prisma.affiliateTask.updateMany({
        where: { id: taskId, paymentStatus: { not: AffiliatePaymentStatus.PAID } },
        data: { paymentStatus: AffiliatePaymentStatus.ON_HOLD },
      });
      throw new ConflictException(
        'No affiliate is linked to this payout. Re-assign the task before approving it.',
      );
    }

    const reference = settlement.settlementReference ?? `affiliate-task:${taskId}:settle`;
    const partner = await this.wallet.resolvePartner(PLATFORM_CLIENT_ID);
    let businessTransactionId = settlement.businessTransactionId;
    let affiliateTransactionId = settlement.affiliateTransactionId;

    await this.prisma.affiliateTaskSettlement.updateMany({
      where: {
        id: settlement.id,
        status: {
          in: [
            AffiliateSettlementStatus.HELD,
            AffiliateSettlementStatus.PENDING_HOLD,
            AffiliateSettlementStatus.FAILED,
            AffiliateSettlementStatus.SETTLING,
          ],
        },
      },
      data: { status: AffiliateSettlementStatus.SETTLING, failureReason: null },
    });

    try {
      // 1) Take the reserved business money.
      if (settlement.holdId) {
        const receipt = await this.wallet.captureHold(
          partner,
          settlement.holdId,
          'HOLD_CAPTURE',
          `${reference}:business:debit`,
        );
        businessTransactionId = receipt.transactionId;
      }

      // 2) Pay the affiliate's central MCOM wallet (or platform-funded payout).
      const payout = this.decimalOf(settlement.affiliatePayoutCredits);
      if (payout.greaterThan(0) && settlement.affiliateUserId) {
        const receipt = await this.wallet.creditWallet(
          partner,
          {
            userId: settlement.affiliateUserId,
            amount: payout.toNumber(),
            category: 'TRANSFER_IN',
            reference,
            description: `Task payment: ${settlement.task.title}`,
            metadata: {
              taskId,
              businessId: settlement.businessId,
              settlementId: settlement.id,
              fundingSource: settlement.fundingSource,
            },
          },
          `${reference}:affiliate:credit`,
        );
        affiliateTransactionId = receipt.transactionId;
      }

      const settled = await this.markSettled(settlement.id, {
        businessTransactionId,
        affiliateTransactionId,
        reference,
      });

      await this.prisma.affiliateTask.update({
        where: { id: taskId },
        data: {
          paymentStatus:
            payout.greaterThan(0)
              ? AffiliatePaymentStatus.PAID
              : AffiliatePaymentStatus.NOT_APPLICABLE,
          paidAt: payout.greaterThan(0) ? new Date() : null,
          earningsRecordedAt: new Date(),
          settlementReference: reference,
        },
      });

      await this.recordEvent(taskId, {
        type: 'PAYMENT_SETTLED',
        actorRole: 'SYSTEM',
        message: payout.greaterThan(0)
          ? `Affiliate paid ${payout.toFixed(4)} MCOM; platform kept ${this.decimalOf(
              settled.platformFeeCredits,
            )
              .plus(this.decimalOf(settled.platformMarginCredits))
              .toFixed(4)} MCOM`
          : 'Task settled with no affiliate payout',
        metadata: {
          settlementId: settled.id,
          fundingSource: settled.fundingSource,
          businessChargeCredits: settlement.businessChargeCredits?.toString() ?? null,
          affiliatePayoutCredits: settlement.affiliatePayoutCredits.toString(),
          platformFeeCredits: settled.platformFeeCredits.toString(),
          platformMarginCredits: settled.platformMarginCredits.toString(),
          fxRate: settlement.fxRate.toString(),
          businessTransactionId,
          affiliateTransactionId,
        },
      });

      return settled;
    } catch (error: any) {
      const message = error?.message ?? 'Unknown settlement error';
      this.logger.error(`Settlement failed for task ${taskId}: ${message}`);
      await this.prisma.affiliateTaskSettlement.updateMany({
        where: { id: settlement.id, status: { not: AffiliateSettlementStatus.SETTLED } },
        data: {
          status: AffiliateSettlementStatus.FAILED,
          failureReason: message,
          businessTransactionId,
          affiliateTransactionId,
        },
      });
      await this.prisma.affiliateTask.updateMany({
        where: { id: taskId, paymentStatus: { not: AffiliatePaymentStatus.PAID } },
        data: { paymentStatus: AffiliatePaymentStatus.ON_HOLD },
      });
      throw error;
    }
  }

  /** Return reserved money to the business (cancel / charge declined). */
  async releaseTaskHold(taskId: string, reason: string) {
    const settlement = await this.prisma.affiliateTaskSettlement.findUnique({
      where: { taskId },
    });
    if (!settlement) return null;
    if (settlement.status === AffiliateSettlementStatus.SETTLED) {
      throw new ConflictException('Settled tasks cannot be released');
    }
    if (settlement.status === AffiliateSettlementStatus.RELEASED) return settlement;

    // Once the business debit has been captured the money is no longer a hold.
    // Releasing the (already captured) hold would silently misstate the ledger;
    // retry the payout instead, or refund through the wallet admin tools.
    if (settlement.businessTransactionId) {
      throw new ConflictException(
        'The business charge was already captured. Retry the affiliate payout or issue a wallet refund instead of releasing the escrow.',
      );
    }

    if (settlement.holdId) {
      await this.releaseHoldQuietly(settlement.holdId);
    }

    return this.prisma.affiliateTaskSettlement.update({
      where: { id: settlement.id },
      data: {
        status: AffiliateSettlementStatus.RELEASED,
        releasedAt: new Date(),
        failureReason: reason,
      },
    });
  }

  /** Admin ledger: paginated settlement rows. */
  async listSettlements(query: SettlementQueryInput = {}) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const where: Prisma.AffiliateTaskSettlementWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.fundingSource && { fundingSource: query.fundingSource }),
      ...(query.businessId && { businessId: query.businessId }),
      ...(query.affiliateUserId && { affiliateUserId: query.affiliateUserId }),
      ...(query.search && {
        OR: [
          { affiliateEmail: { contains: query.search, mode: 'insensitive' } },
          { settlementReference: { contains: query.search, mode: 'insensitive' } },
          { task: { title: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
      ...((query.dateFrom || query.dateTo) && {
        createdAt: {
          ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
          ...(query.dateTo && { lte: new Date(`${query.dateTo}T23:59:59.999Z`) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.affiliateTaskSettlement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              business: { select: { id: true, businessName: true, email: true } },
              assignee: {
                select: { id: true, email: true, firstName: true, lastName: true, role: true },
              },
            },
          },
        },
      }),
      this.prisma.affiliateTaskSettlement.count({ where }),
    ]);

    return {
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Admin ledger: headline totals for the settlement screen. */
  async getSummary() {
    const [held, settled, released, failed, notRequired, feeRows] = await Promise.all([
      this.aggregateByStatus(AffiliateSettlementStatus.HELD),
      this.aggregateByStatus(AffiliateSettlementStatus.SETTLED),
      this.aggregateByStatus(AffiliateSettlementStatus.RELEASED),
      this.aggregateByStatus(AffiliateSettlementStatus.FAILED),
      this.aggregateByStatus(AffiliateSettlementStatus.NOT_REQUIRED),
      this.prisma.affiliateTaskSettlement.aggregate({
        where: { status: AffiliateSettlementStatus.SETTLED },
        _sum: {
          businessChargeCredits: true,
          affiliatePayoutCredits: true,
          platformFeeCredits: true,
          platformMarginCredits: true,
        },
      }),
    ]);

    return {
      success: true,
      data: {
        held: held._sum.businessChargeCredits?.toNumber() ?? 0,
        heldCount: held._count,
        settledGross: feeRows._sum.businessChargeCredits?.toNumber() ?? 0,
        settledPayouts: feeRows._sum.affiliatePayoutCredits?.toNumber() ?? 0,
        platformFees: feeRows._sum.platformFeeCredits?.toNumber() ?? 0,
        platformMargin: feeRows._sum.platformMarginCredits?.toNumber() ?? 0,
        platformRetention:
          (feeRows._sum.platformFeeCredits?.toNumber() ?? 0) +
          (feeRows._sum.platformMarginCredits?.toNumber() ?? 0),
        settledCount: settled._count,
        releasedCount: released._count,
        failedCount: failed._count,
        notRequiredCount: notRequired._count,
        currency: 'MCOM',
      },
    };
  }

  async getForTask(taskId: string) {
    return this.prisma.affiliateTaskSettlement.findUnique({
      where: { taskId },
      include: { task: { select: { id: true, title: true, status: true } } },
    });
  }

  // ─────────────────────────── Reconciliation ────────────────────────────

  /**
   * Retry settlements that stopped half-way (e.g. affiliate credit failed).
   * Idempotency keys make a retry safe even if the first leg already committed.
   */
  @Cron('*/10 * * * *')
  async retryFailedSettlements(): Promise<number> {
    const rows = await this.prisma.affiliateTaskSettlement.findMany({
      where: { status: { in: [AffiliateSettlementStatus.FAILED, AffiliateSettlementStatus.SETTLING] } },
      select: { taskId: true },
      take: 25,
      orderBy: { updatedAt: 'asc' },
    });
    let retried = 0;
    for (const row of rows) {
      try {
        await this.settleTask(row.taskId);
        retried += 1;
      } catch (error: any) {
        this.logger.warn(`Retry settlement ${row.taskId} failed: ${error?.message}`);
      }
    }
    return retried;
  }

  /**
   * Flag reservations that the wallet expiry sweep released before the work
   * was approved. The task is left in ON_HOLD so an admin can re-price it.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async flagExpiredHolds(): Promise<number> {
    const now = new Date();
    const rows = await this.prisma.affiliateTaskSettlement.findMany({
      where: {
        status: AffiliateSettlementStatus.HELD,
        holdExpiresAt: { lt: now },
        holdId: { not: null },
      },
      select: { id: true, taskId: true, holdId: true },
      take: 50,
    });
    let flagged = 0;
    for (const row of rows) {
      const hold = await this.prisma.walletHold.findUnique({ where: { id: row.holdId! } });
      if (hold && hold.status === 'ACTIVE') continue;
      await this.prisma.affiliateTaskSettlement.update({
        where: { id: row.id },
        data: {
          status: AffiliateSettlementStatus.FAILED,
          failureReason: 'Escrow hold expired before the task was approved',
        },
      });
      await this.prisma.affiliateTask.update({
        where: { id: row.taskId },
        data: { paymentStatus: AffiliatePaymentStatus.ON_HOLD },
      });
      await this.recordEvent(row.taskId, {
        type: 'ESCROW_EXPIRED',
        actorRole: 'SYSTEM',
        message: 'The business escrow expired before completion. Re-price the task to reserve funds again.',
      });
      flagged += 1;
    }
    return flagged;
  }

  // ─────────────────────────── Internals ─────────────────────────────────

  private async loadTask(taskId: string) {
    const task = await this.prisma.affiliateTask.findUnique({
      where: { id: taskId },
      include: {
        business: {
          select: {
            id: true,
            userId: true,
            businessName: true,
            email: true,
            membershipStatus: true,
            membershipPlanName: true,
            membershipExpiresAt: true,
          },
        },
        assignee: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        settlement: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  /**
   * Apply assignment-time pricing to the loaded task so the hold is validated
   * *before* the task row changes. This keeps a failed escrow from leaving the
   * task assigned with unpriced work.
   */
  private applyOverrides(
    task: Awaited<ReturnType<AffiliateSettlementService['loadTask']>>,
    input: EnsureSettlementInput,
  ): Awaited<ReturnType<AffiliateSettlementService['loadTask']>> {
    return {
      ...task,
      compensationModel: input.compensationModel ?? task.compensationModel,
      compensationAmount:
        input.compensationAmount !== undefined ? input.compensationAmount : task.compensationAmount,
      billableToBusiness:
        input.billableToBusiness !== undefined ? input.billableToBusiness : task.billableToBusiness,
      businessChargeAmount:
        input.businessChargeAmount !== undefined
          ? input.businessChargeAmount
          : task.businessChargeAmount,
      assigneeId: input.assigneeId !== undefined ? input.assigneeId : task.assigneeId,
      freeDelegation:
        input.freeDelegation !== undefined ? input.freeDelegation : task.freeDelegation,
      assignee: input.assigneeEmail
        ? { ...(task.assignee as NonNullable<typeof task.assignee>), email: input.assigneeEmail }
        : task.assignee,
    };
  }

  private isPaidActiveMembership(business: {
    membershipStatus?: string | null;
    membershipPlanName?: string | null;
    membershipExpiresAt?: Date | null;
  }): boolean {
    return (
      business.membershipStatus === 'active' &&
      !!business.membershipPlanName &&
      (!business.membershipExpiresAt || business.membershipExpiresAt > new Date())
    );
  }

  private async quote(
    task: Awaited<ReturnType<AffiliateSettlementService['loadTask']>>,
    existing: {
      platformFeePercent: Decimal;
      holdId: string | null;
      holdExpiresAt: Date | null;
    } | null,
    input: EnsureSettlementInput,
  ): Promise<SettlementQuote> {
    const paidMembership = this.isPaidActiveMembership(task.business);
    // New tasks carry an explicit free/chargeable decision from the quota
    // service. Legacy tasks (decision = null) keep the old membership rule.
    const isFree = task.freeDelegation == null ? paidMembership : task.freeDelegation;
    const compensationAmount = this.compensationAmount(task);
    const fxRate = new Decimal(await this.wallet.getGbpToMcomRate());
    const compensationCredits = compensationAmount
      ? compensationAmount.times(fxRate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    const rawCharge = task.businessChargeAmount != null ? new Decimal(task.businessChargeAmount) : null;
    const billable =
      !isFree && task.billableToBusiness && rawCharge != null && rawCharge.greaterThan(0);

    if (!billable && compensationCredits.isZero()) {
      return {
        paidMembership,
        billable: false,
        compensationModel: task.compensationModel,
        compensationAmount,
        compensationCredits: new Decimal(0),
        businessChargeAmount: rawCharge,
        businessChargeCredits: new Decimal(0),
        platformFeePercent: new Decimal(0),
        platformFeeCredits: new Decimal(0),
        platformMarginCredits: new Decimal(0),
        affiliatePayoutCredits: new Decimal(0),
        fundingSource: AffiliateSettlementFunding.BUSINESS_WALLET,
        fxRate,
        status: AffiliateSettlementStatus.NOT_REQUIRED,
        holdId: existing?.holdId ?? null,
        holdExpiresAt: existing?.holdExpiresAt ?? null,
      };
    }

    const businessChargeCredits = billable
      ? rawCharge!.times(fxRate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    if (billable && compensationCredits.greaterThan(businessChargeCredits)) {
      throw new BadRequestException(
        `Affiliate pay (${compensationCredits.toFixed(2)} MCOM) cannot exceed the business charge ` +
          `(${businessChargeCredits.toFixed(2)} MCOM). Increase the charge or reduce the affiliate pay.`,
      );
    }

    const feePercent =
      input.platformFeePercent != null
        ? new Decimal(input.platformFeePercent)
        : existing?.platformFeePercent ?? new Decimal(await this.resolveFeePercent());

    const requestedFee = billable
      ? businessChargeCredits
          .times(feePercent)
          .dividedBy(100)
          .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : new Decimal(0);
    // Never let the fee create a negative payout. The spread is the hard cap.
    const maxFee = billable ? businessChargeCredits.minus(compensationCredits) : new Decimal(0);
    const platformFeeCredits = Decimal.min(Decimal.max(requestedFee, 0), maxFee);
    const platformMarginCredits = billable
      ? businessChargeCredits.minus(compensationCredits).minus(platformFeeCredits)
      : new Decimal(0);

    return {
      paidMembership,
      billable,
      compensationModel: task.compensationModel,
      compensationAmount,
      compensationCredits,
      businessChargeAmount: rawCharge,
      businessChargeCredits,
      platformFeePercent: feePercent,
      platformFeeCredits,
      platformMarginCredits,
      affiliatePayoutCredits: compensationCredits,
      fundingSource: billable
        ? AffiliateSettlementFunding.BUSINESS_WALLET
        : AffiliateSettlementFunding.PLATFORM,
      fxRate,
      status:
        compensationCredits.isZero() && businessChargeCredits.isZero()
          ? AffiliateSettlementStatus.NOT_REQUIRED
          : AffiliateSettlementStatus.HELD,
      holdId: existing?.holdId ?? null,
      holdExpiresAt: existing?.holdExpiresAt ?? null,
    };
  }

  private compensationAmount(
    task: Awaited<ReturnType<AffiliateSettlementService['loadTask']>>,
  ): Decimal | null {
    if (
      task.compensationModel === AffiliateCompensationModel.NONE ||
      task.compensationModel === AffiliateCompensationModel.MEMBERSHIP_INCLUDED ||
      task.compensationAmount == null
    ) {
      return null;
    }
    const amount = new Decimal(task.compensationAmount);
    return amount.greaterThan(0) ? amount : null;
  }

  private async upsert(
    task: Awaited<ReturnType<AffiliateSettlementService['loadTask']>>,
    existing: { id: string; heldAt?: Date | null } | null,
    quote: SettlementQuote,
    holdId: string | null,
    failureReason: string | null,
  ) {
    const data = {
      businessId: task.businessId,
      businessUserId: task.business.userId,
      affiliateUserId: task.assigneeId,
      affiliateEmail: task.assignee?.email ?? null,
      currency: task.compensationCurrency || task.businessChargeCurrency || 'GBP',
      fxBase: 'GBP',
      fxQuote: 'MCOM',
      fxRate: quote.fxRate,
      businessChargeAmount: quote.businessChargeAmount,
      businessChargeCredits: quote.businessChargeCredits,
      compensationAmount: quote.compensationAmount,
      compensationCredits: quote.compensationCredits,
      platformFeePercent: quote.platformFeePercent,
      platformFeeCredits: quote.platformFeeCredits,
      platformMarginCredits: quote.platformMarginCredits,
      affiliatePayoutCredits: quote.affiliatePayoutCredits,
      fundingSource: quote.fundingSource,
      status: failureReason ? AffiliateSettlementStatus.FAILED : quote.status,
      holdId,
      holdExpiresAt: quote.holdExpiresAt,
      failureReason,
      heldAt:
        quote.status === AffiliateSettlementStatus.HELD
          ? existing?.heldAt ?? new Date()
          : null,
    } satisfies Prisma.AffiliateTaskSettlementUncheckedUpdateInput;

    return this.prisma.affiliateTaskSettlement.upsert({
      where: { taskId: task.id },
      create: {
        taskId: task.id,
        ...data,
        status: data.status as AffiliateSettlementStatus,
        heldAt: data.heldAt as Date | null,
      },
      update: data,
    });
  }

  private async markSettled(
    id: string,
    input: {
      businessTransactionId: string | null;
      affiliateTransactionId: string | null;
      reference?: string;
    },
  ) {
    const existing = await this.prisma.affiliateTaskSettlement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Settlement not found');
    if (existing.status === AffiliateSettlementStatus.SETTLED) return existing;

    // Compare-and-set the terminal state. Concurrent retries (cron + admin) must
    // not each book the platform revenue row.
    const claimed = await this.prisma.affiliateTaskSettlement.updateMany({
      where: { id, status: { not: AffiliateSettlementStatus.SETTLED } },
      data: {
        status: AffiliateSettlementStatus.SETTLED,
        businessTransactionId: input.businessTransactionId,
        affiliateTransactionId: input.affiliateTransactionId,
        settlementReference:
          input.reference ?? existing.settlementReference ?? `affiliate-task:${existing.taskId}:settle`,
        settledAt: new Date(),
        failureReason: null,
      },
    });

    const updated = await this.prisma.affiliateTaskSettlement.findUniqueOrThrow({ where: { id } });
    if (claimed.count === 0) return updated;

    // Book the platform's total retention (explicit fee + spread) once, in GBP,
    // for the existing revenue dashboard.
    const retention = this.decimalOf(updated.platformFeeCredits).plus(
      this.decimalOf(updated.platformMarginCredits),
    );
    if (retention.greaterThan(0)) {
      const gbp = retention
        .dividedBy(this.decimalOf(updated.fxRate))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      try {
        await this.prisma.revenueRecord.create({
          data: {
            date: new Date().toISOString().slice(0, 10),
            amount: gbp,
            type: 'Affiliate Task Fee',
            source: 'AFFILIATE_TASK',
          },
        });
      } catch (error: any) {
        this.logger.warn(`Could not book affiliate task fee revenue: ${error?.message}`);
      }
    }

    // Platform-funded payouts are a real cost: the membership already covers the
    // business, so the platform absorbs the affiliate payment. Book it as a
    // negative revenue row so the finance dashboard stays honest.
    if (
      updated.fundingSource === AffiliateSettlementFunding.PLATFORM &&
      this.decimalOf(updated.affiliatePayoutCredits).greaterThan(0)
    ) {
      const costGbp = this.decimalOf(updated.affiliatePayoutCredits)
        .dividedBy(this.decimalOf(updated.fxRate))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();
      try {
        await this.prisma.revenueRecord.create({
          data: {
            date: new Date().toISOString().slice(0, 10),
            amount: -costGbp,
            type: 'Affiliate Task Payout',
            source: 'AFFILIATE_TASK',
          },
        });
      } catch (error: any) {
        this.logger.warn(`Could not book platform-funded payout cost: ${error?.message}`);
      }
    }

    return updated;
  }

  private async releaseHoldQuietly(holdId: string) {
    try {
      await this.wallet.releaseHoldInternal(holdId, 'RELEASED');
    } catch (error: any) {
      this.logger.warn(`Could not release hold ${holdId}: ${error?.message}`);
    }
  }

  private async resolveFeePercent(): Promise<string> {
    try {
      const setting = await this.prisma.programmeSetting.findUnique({
        where: { key: 'affiliate_task_fee_percent' },
      });
      if (setting?.value != null) {
        const parsed = Number(setting.value);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) return String(parsed);
      }
    } catch {
      // Programme settings are optional in fresh environments.
    }
    const env = Number(this.config.get<string>('AFFILIATE_TASK_FEE_PERCENT'));
    if (Number.isFinite(env) && env >= 0 && env <= 100) return String(env);
    return DEFAULT_FEE_PERCENT;
  }

  private holdTtlHours(dueAt: Date | null): number {
    const baseline = dueAt ? dueAt.getTime() : Date.now() + 14 * 24 * 3600_000;
    const withBuffer = baseline + 30 * 24 * 3600_000; // 30 days after the deadline
    const hours = Math.ceil((withBuffer - Date.now()) / 3600_000);
    return Math.min(MAX_HOLD_HOURS, Math.max(24, hours));
  }

  private describeHoldError(error: any, businessName: string): string {
    const available = error?.response?.availableBalance ?? error?.availableBalance;
    if (error?.response?.error === 'INSUFFICIENT_BALANCE' || error?.message?.includes('insufficient')) {
      return (
        `${businessName} does not have enough MCOM credits for this task escrow` +
        (available != null ? ` (available: ${available} MCOM).` : '.') +
        ' Ask the business to top up, then assign again.'
      );
    }
    if (error?.response?.error === 'WALLET_FROZEN') {
      return `${businessName}'s wallet is frozen. Unfreeze it before assigning paid work.`;
    }
    return `Could not reserve the business charge: ${error?.message ?? 'unknown wallet error'}`;
  }

  private async recordEvent(
    taskId: string,
    input: { type: string; message: string; actorRole?: string; metadata?: Record<string, unknown> },
  ) {
    try {
      await this.prisma.affiliateTaskEvent.create({
        data: {
          taskId,
          actorRole: input.actorRole ?? 'SYSTEM',
          type: input.type,
          message: input.message,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Could not record settlement event for ${taskId}: ${error?.message}`);
    }
  }

  private async aggregateByStatus(status: AffiliateSettlementStatus) {
    return this.prisma.affiliateTaskSettlement.aggregate({
      where: { status },
      _sum: { businessChargeCredits: true },
      _count: true,
    });
  }

  private decimalOf(value: Prisma.Decimal | Decimal | number | string | null | undefined): Decimal {
    if (value == null) return new Decimal(0);
    return new Decimal(value.toString());
  }

  private sameDecimal(a: Prisma.Decimal | Decimal | null | undefined, b: Decimal): boolean {
    if (a == null) return false;
    return new Decimal(a.toString()).equals(b);
  }
}
