import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PrismaTx = Prisma.TransactionClient;

export const REPUTATION_POINTS = {
  taskCompleted: 10,
  taskFailed: -10,
  reportValid: -15,
  // rating 1 → -6, 2 → -3, 3 → 0, 4 → +3, 5 → +6
  ratingStep: 3,
  experiencePerCompletedTask: 2,
} as const;

export interface ReputationSummary {
  userId: string;
  role: Role;
  reputationScore: number;
  experienceScore: number;
  completedTasksCount: number;
  failedTasksCount: number;
  ratingAverage: number | null;
  ratingCount: number;
}

@Injectable()
export class AffiliateReputationService {
  private readonly logger = new Logger(AffiliateReputationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private profileDelegate(role: Role) {
    switch (role) {
      case Role.AGENT:
        return this.prisma.agentProfile;
      case Role.ACCOUNT_MANAGER:
        return this.prisma.accountManagerProfile;
      case Role.CONSULTANT:
        return this.prisma.consultantProfile;
      default:
        return null;
    }
  }

  async getSummary(userId: string): Promise<ReputationSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        agentProfile: {
          select: { reputationScore: true, experienceScore: true, completedTasksCount: true, failedTasksCount: true },
        },
        accountManagerProfile: {
          select: { reputationScore: true, experienceScore: true, completedTasksCount: true, failedTasksCount: true },
        },
        consultantProfile: {
          select: { reputationScore: true, experienceScore: true, completedTasksCount: true, failedTasksCount: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Affiliate not found');

    const profile =
      user.agentProfile || user.accountManagerProfile || user.consultantProfile || null;

    const ratings = await this.prisma.affiliateRating.aggregate({
      where: { affiliateUserId: userId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      userId: user.id,
      role: user.role,
      reputationScore: profile?.reputationScore ?? 0,
      experienceScore: profile?.experienceScore ?? 0,
      completedTasksCount: profile?.completedTasksCount ?? 0,
      failedTasksCount: profile?.failedTasksCount ?? 0,
      ratingAverage: ratings._avg.rating != null ? Math.round(ratings._avg.rating * 100) / 100 : null,
      ratingCount: ratings._count._all,
    };
  }

  /**
   * Append a reputation event and apply the delta to the affiliate's profile.
   * Safe to call with a transaction client so completion + ledger commit
   * atomically.
   */
  async applyEvent(
    params: {
      affiliateUserId: string;
      delta: number;
      reason: string;
      sourceType: string;
      sourceId?: string | null;
    },
    tx?: PrismaTx,
  ): Promise<void> {
    if (!params.delta) return;
    const db = tx ?? this.prisma;

    const user = await db.user.findUnique({
      where: { id: params.affiliateUserId },
      select: { id: true, role: true },
    });
    if (!user) {
      this.logger.warn(`Reputation event skipped — affiliate ${params.affiliateUserId} not found`);
      return;
    }

    const delegate = this.profileDelegate(user.role) as any;
    if (delegate) {
      await delegate.updateMany({
        where: { userId: params.affiliateUserId },
        data: { reputationScore: { increment: params.delta } },
      });
    }

    await db.affiliateReputationEvent.create({
      data: {
        affiliateUserId: params.affiliateUserId,
        delta: params.delta,
        reason: params.reason,
        sourceType: params.sourceType,
        sourceId: params.sourceId ?? null,
      },
    });
  }

  /** Completion: reputation + experience/throughput counters. */
  async recordTaskCompleted(
    affiliateUserId: string,
    sourceId: string,
    tx?: PrismaTx,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const user = await db.user.findUnique({
      where: { id: affiliateUserId },
      select: { role: true },
    });
    if (user) {
      const delegate = this.profileDelegate(user.role) as any;
      if (delegate) {
        await delegate.updateMany({
          where: { userId: affiliateUserId },
          data: {
            completedTasksCount: { increment: 1 },
            experienceScore: { increment: REPUTATION_POINTS.experiencePerCompletedTask },
          },
        });
      }
    }
    await this.applyEvent(
      {
        affiliateUserId,
        delta: REPUTATION_POINTS.taskCompleted,
        reason: 'Task completed and approved',
        sourceType: 'TASK_COMPLETED',
        sourceId,
      },
      tx,
    );
  }

  /** Rejection / failure: reputation + failed-task counter. */
  async recordTaskFailed(
    affiliateUserId: string,
    sourceId: string,
    reason = 'Task rejected by admin',
    tx?: PrismaTx,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const user = await db.user.findUnique({
      where: { id: affiliateUserId },
      select: { role: true },
    });
    if (user) {
      const delegate = this.profileDelegate(user.role) as any;
      if (delegate) {
        await delegate.updateMany({
          where: { userId: affiliateUserId },
          data: { failedTasksCount: { increment: 1 } },
        });
      }
    }
    await this.applyEvent(
      {
        affiliateUserId,
        delta: REPUTATION_POINTS.taskFailed,
        reason,
        sourceType: 'TASK_FAILED',
        sourceId,
      },
      tx,
    );
  }

  /** Positive/negative rating from a business (1..5). */
  async recordRating(
    affiliateUserId: string,
    rating: number,
    sourceId: string,
    tx?: PrismaTx,
  ): Promise<void> {
    const delta = (rating - 3) * REPUTATION_POINTS.ratingStep;
    if (!delta) return;
    await this.applyEvent(
      {
        affiliateUserId,
        delta,
        reason: `Business rating of ${rating}/5`,
        sourceType: 'RATING',
        sourceId,
      },
      tx,
    );
  }

  async recordValidReport(
    affiliateUserId: string,
    sourceId: string,
    tx?: PrismaTx,
  ): Promise<void> {
    await this.applyEvent(
      {
        affiliateUserId,
        delta: REPUTATION_POINTS.reportValid,
        reason: 'Validated business report',
        sourceType: 'REPORT',
        sourceId,
      },
      tx,
    );
  }
}
