import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ReferralCommission,
  ReferralCommissionSourceType,
  ReferralCommissionStatus,
  ReferralRewardType,
  TransactionCategory,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralConfigService } from './referral-config.service';

const MCOM_CENTRAL_PARTNER = {
  clientId: 'mcom-central',
  name: 'MCOM Central',
  platformSlug: 'mcom-central',
};

export interface RecordReferralPurchaseInput {
  businessId: string;
  sourceType: ReferralCommissionSourceType;
  sourceId: string;
  sourceName?: string | null;
  planId?: string | null;
  amountGbp: number;
  paymentReference?: string | null;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

const round = (value: number, places = 4) =>
  Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;

@Injectable()
export class ReferralCommissionService {
  private readonly logger = new Logger(ReferralCommissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly referralConfig: ReferralConfigService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * Evaluate one business purchase against the latest referral configuration.
   *
   * Always records an auditable row when the buyer has a referrer, including
   * skipped rows (ineligible role, unqualified plan, one-time already used).
   * Never throws into the payment flow.
   */
  async recordBusinessPurchase(
    input: RecordReferralPurchaseInput,
  ): Promise<ReferralCommission | null> {
    const amountGbp = round(Number(input.amountGbp));
    if (!Number.isFinite(amountGbp) || amountGbp <= 0) return null;

    try {
      const buyer = await this.prisma.businessProfile.findFirst({
        where: { id: input.businessId, deletedAt: null },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              role: true,
              email: true,
              firstName: true,
              lastName: true,
              referredById: true,
              referredBy: {
                select: {
                  id: true,
                  role: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      const referred = buyer?.user;
      if (!referred?.referredById || !referred.referredBy) return null;
      const referrer = referred.referredBy;
      // A self-referral is never a commission event.
      if (referrer.id === referred.id) return null;

      const idempotencyKey = `referral:${input.sourceType}:${input.sourceId}`;
      const existing = await this.prisma.referralCommission.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing;

      const config = await this.referralConfig.getCurrent();
      const referredName =
        [referred.firstName, referred.lastName].filter(Boolean).join(' ') ||
        referred.email;

      const base = {
        referrerUserId: referrer.id,
        referredUserId: referred.id,
        referrerRole: referrer.role,
        referredRole: referred.role,
        referredEmail: referred.email,
        referredName,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceName: input.sourceName ?? null,
        planId: input.planId ?? null,
        purchaseAmountGbp: new Prisma.Decimal(amountGbp),
        idempotencyKey,
        metadata: {
          ...(input.metadata ?? {}),
          paymentReference: input.paymentReference ?? null,
          occurredAt: (input.occurredAt ?? new Date()).toISOString(),
        } as Prisma.InputJsonValue,
      };

      if (!config || !config.isActive) {
        return this.createSkipped(base, ReferralCommissionStatus.SKIPPED_NO_CONFIG);
      }
      if (!this.referralConfig.isRoleEligible(config, referrer.role)) {
        return this.createSkipped(
          { ...base, configVersion: config.version },
          ReferralCommissionStatus.SKIPPED_ROLE,
        );
      }
      if (!this.referralConfig.qualifiesPlan(config, input.sourceType, input.planId)) {
        return this.createSkipped(
          { ...base, configVersion: config.version },
          ReferralCommissionStatus.SKIPPED_PLAN,
        );
      }
      if (config.commissionFrequency === 'ONE_TIME') {
        const previousEarning = await this.prisma.referralCommission.findFirst({
          where: {
            referrerUserId: referrer.id,
            referredUserId: referred.id,
            status: {
              in: [
                ReferralCommissionStatus.CREDITED,
                ReferralCommissionStatus.PENDING,
              ],
            },
          },
          select: { id: true },
        });
        if (previousEarning) {
          return this.createSkipped(
            { ...base, configVersion: config.version },
            ReferralCommissionStatus.SKIPPED_ONE_TIME,
          );
        }
      }

      const reward = this.referralConfig.resolveReward(config, referrer.role);
      const commissionGbp = round(
        reward.rewardType === ReferralRewardType.PERCENTAGE
          ? (amountGbp * reward.value) / 100
          : reward.value,
      );
      if (!Number.isFinite(commissionGbp) || commissionGbp <= 0) {
        return this.createSkipped(
          {
            ...base,
            rewardType: reward.rewardType,
            rewardValue: new Prisma.Decimal(reward.value),
            configVersion: config.version,
          },
          ReferralCommissionStatus.SKIPPED_ZERO,
        );
      }

      const fxRate = await this.wallet.getGbpToMcomRate();
      const commissionCredits = round(commissionGbp * fxRate);
      if (!Number.isFinite(commissionCredits) || commissionCredits <= 0) {
        return this.createSkipped(
          {
            ...base,
            rewardType: reward.rewardType,
            rewardValue: new Prisma.Decimal(reward.value),
            configVersion: config.version,
          },
          ReferralCommissionStatus.SKIPPED_ZERO,
        );
      }

      let commission: ReferralCommission;
      try {
        commission = await this.prisma.referralCommission.create({
          data: {
            ...base,
            rewardType: reward.rewardType,
            rewardValue: new Prisma.Decimal(reward.value),
            commissionAmountGbp: new Prisma.Decimal(commissionGbp),
            fxRate: new Prisma.Decimal(fxRate),
            commissionCredits: new Prisma.Decimal(commissionCredits),
            status: ReferralCommissionStatus.PENDING,
            configVersion: config.version,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return this.prisma.referralCommission.findUnique({
            where: { idempotencyKey },
          });
        }
        throw error;
      }

      try {
        const receipt = await this.wallet.creditWallet(
          MCOM_CENTRAL_PARTNER,
          {
            userId: referrer.id,
            amount: commissionCredits,
            category: TransactionCategory.REWARD,
            description: `Referral commission — ${referredName} (${input.sourceName ?? input.sourceType.replaceAll('_', ' ').toLowerCase()})`,
            reference: `referral-commission:${commission.id}`,
            metadata: {
              referralCommissionId: commission.id,
              referredUserId: referred.id,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              configVersion: config.version,
            },
          },
          `referral-payout:${commission.id}`,
        );

        return this.prisma.referralCommission.update({
          where: { id: commission.id },
          data: {
            status: ReferralCommissionStatus.CREDITED,
            walletTransactionId: receipt.transactionId,
          },
        });
      } catch (error) {
        const failureReason =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Referral payout failed for commission ${commission.id}: ${failureReason}`,
        );
        return this.prisma.referralCommission.update({
          where: { id: commission.id },
          data: {
            status: ReferralCommissionStatus.FAILED,
            failureReason,
          },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Could not evaluate referral purchase ${input.sourceType}:${input.sourceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async createSkipped(
    data: Omit<
      Prisma.ReferralCommissionCreateInput,
      'rewardType' | 'rewardValue' | 'status'
    > & {
      rewardType?: ReferralRewardType;
      rewardValue?: Prisma.Decimal;
      configVersion?: number;
    },
    status: ReferralCommissionStatus,
  ): Promise<ReferralCommission> {
    try {
      return await this.prisma.referralCommission.create({
        data: {
          ...data,
          status,
          rewardType: data.rewardType ?? ReferralRewardType.PERCENTAGE,
          rewardValue: data.rewardValue ?? new Prisma.Decimal(0),
          commissionAmountGbp: new Prisma.Decimal(0),
          commissionCredits: new Prisma.Decimal(0),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.referralCommission.findUnique({
          where: { idempotencyKey: data.idempotencyKey as string },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async getEarningsForUser(userId: string, historyLimit = 20) {
    const safeLimit = Math.min(Math.max(1, historyLimit), 100);
    const [totalReferrals, referredUsers, creditedAggregate, history, config] =
      await Promise.all([
        this.prisma.user.count({ where: { referredById: userId } }),
        this.prisma.user.findMany({
          where: { referredById: userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
            businessProfile: { select: { businessName: true } },
          },
        }),
        this.prisma.referralCommission.aggregate({
          where: {
            referrerUserId: userId,
            status: ReferralCommissionStatus.CREDITED,
          },
          _sum: { commissionCredits: true, commissionAmountGbp: true },
          _count: true,
        }),
        this.prisma.referralCommission.findMany({
          where: { referrerUserId: userId },
          orderBy: { createdAt: 'desc' },
          take: safeLimit,
        }),
        this.referralConfig.getPublicConfig(),
      ]);

    const grouped = await this.prisma.referralCommission.groupBy({
      by: ['referredUserId', 'status'],
      where: { referrerUserId: userId },
      _sum: { commissionCredits: true, commissionAmountGbp: true },
      _count: true,
      _max: { createdAt: true },
    });

    const byReferred = new Map<
      string,
      {
        earnedCredits: number;
        earnedGbp: number;
        creditedCount: number;
        evaluationCount: number;
        lastActivityAt: Date | null;
      }
    >();
    for (const row of grouped) {
      const entry = byReferred.get(row.referredUserId) ?? {
        earnedCredits: 0,
        earnedGbp: 0,
        creditedCount: 0,
        evaluationCount: 0,
        lastActivityAt: null,
      };
      entry.evaluationCount += row._count;
      if (row.status === ReferralCommissionStatus.CREDITED) {
        entry.creditedCount += row._count;
        entry.earnedCredits += Number(row._sum.commissionCredits ?? 0);
        entry.earnedGbp += Number(row._sum.commissionAmountGbp ?? 0);
      }
      if (row._max.createdAt && (!entry.lastActivityAt || row._max.createdAt > entry.lastActivityAt)) {
        entry.lastActivityAt = row._max.createdAt;
      }
      byReferred.set(row.referredUserId, entry);
    }

    return {
      summary: {
        totalReferrals,
        creditedReferrals: referredUsers.filter(
          (user) => (byReferred.get(user.id)?.creditedCount ?? 0) > 0,
        ).length,
        totalEarnedCredits: Number(creditedAggregate._sum.commissionCredits ?? 0),
        totalEarnedGbp: Number(creditedAggregate._sum.commissionAmountGbp ?? 0),
        creditedCommissionCount: creditedAggregate._count,
        configActive: Boolean(config?.isActive),
        configVersion: config?.version ?? null,
      },
      referredUsers: referredUsers.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName:
          user.businessProfile?.businessName ||
          [user.firstName, user.lastName].filter(Boolean).join(' ') ||
          user.email,
        role: user.role,
        joinedAt: user.createdAt.toISOString(),
        earnedCredits: round(byReferred.get(user.id)?.earnedCredits ?? 0),
        earnedGbp: round(byReferred.get(user.id)?.earnedGbp ?? 0),
        creditedCount: byReferred.get(user.id)?.creditedCount ?? 0,
        evaluationCount: byReferred.get(user.id)?.evaluationCount ?? 0,
        lastActivityAt: byReferred.get(user.id)?.lastActivityAt?.toISOString() ?? null,
      })),
      history: history.map((row) => this.serializeCommission(row)),
      config,
    };
  }

  async getReferrerAdminSummary(userId: string) {
    const earnings = await this.getEarningsForUser(userId, 200);
    return earnings;
  }

  async getAdminReferrers(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
    const search = params.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      referrals: { some: {} },
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { referralCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          referralCode: true,
          createdAt: true,
          _count: { select: { referrals: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const ids = users.map((user) => user.id);
    const grouped = ids.length
      ? await this.prisma.referralCommission.groupBy({
          by: ['referrerUserId', 'status'],
          where: { referrerUserId: { in: ids } },
          _sum: { commissionCredits: true, commissionAmountGbp: true },
          _count: true,
          _max: { createdAt: true },
        })
      : [];

    const byReferrer = new Map<string, {
      earnedCredits: number;
      earnedGbp: number;
      creditedCount: number;
      skippedCount: number;
      lastActivityAt: Date | null;
    }>();
    for (const row of grouped) {
      const entry = byReferrer.get(row.referrerUserId) ?? {
        earnedCredits: 0,
        earnedGbp: 0,
        creditedCount: 0,
        skippedCount: 0,
        lastActivityAt: null,
      };
      if (row.status === ReferralCommissionStatus.CREDITED) {
        entry.creditedCount += row._count;
        entry.earnedCredits += Number(row._sum.commissionCredits ?? 0);
        entry.earnedGbp += Number(row._sum.commissionAmountGbp ?? 0);
      } else if (String(row.status).startsWith('SKIPPED_')) {
        entry.skippedCount += row._count;
      }
      if (row._max.createdAt && (!entry.lastActivityAt || row._max.createdAt > entry.lastActivityAt)) {
        entry.lastActivityAt = row._max.createdAt;
      }
      byReferrer.set(row.referrerUserId, entry);
    }

    return {
      success: true,
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        role: user.role,
        referralCode: user.referralCode,
        joinedAt: user.createdAt.toISOString(),
        totalReferrals: user._count.referrals,
        creditedCommissions: byReferrer.get(user.id)?.creditedCount ?? 0,
        skippedEvaluations: byReferrer.get(user.id)?.skippedCount ?? 0,
        earnedCredits: round(byReferrer.get(user.id)?.earnedCredits ?? 0),
        earnedGbp: round(byReferrer.get(user.id)?.earnedGbp ?? 0),
        lastActivityAt: byReferrer.get(user.id)?.lastActivityAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  serializeCommission(row: ReferralCommission) {
    return {
      id: row.id,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      planId: row.planId,
      purchaseAmountGbp: Number(row.purchaseAmountGbp),
      rewardType: row.rewardType,
      rewardValue: Number(row.rewardValue),
      commissionAmountGbp: Number(row.commissionAmountGbp),
      fxRate: row.fxRate != null ? Number(row.fxRate) : null,
      commissionCredits: Number(row.commissionCredits),
      status: row.status,
      referredUserId: row.referredUserId,
      referredName: row.referredName,
      referredEmail: row.referredEmail,
      walletTransactionId: row.walletTransactionId,
      configVersion: row.configVersion,
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
