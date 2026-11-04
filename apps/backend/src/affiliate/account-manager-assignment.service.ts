import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { ChatService } from '../chat/services/chat.service';
import { AffiliateDirectoryService } from './affiliate-directory.service';
import { AffiliateReputationService } from './affiliate-reputation.service';
import { AffinityCandidate, rankByAffinity } from './affiliate-affinity.util';

export interface AssignedAccountManager {
  userId: string;
  profileId: string;
  name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  assignedAt: Date | null;
  reputationScore: number;
  experienceScore: number;
  completedTasksCount: number;
  ratingAverage: number | null;
  ratingCount: number;
  matchedLevel: string | null;
  proximityScore: number | null;
}

@Injectable()
export class AccountManagerAssignmentService {
  private readonly logger = new Logger(AccountManagerAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: AffiliateDirectoryService,
    private readonly reputation: AffiliateReputationService,
    private readonly mail: MailService,
    private readonly chat: ChatService,
    private readonly config: ConfigService,
  ) {}

  private frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  /**
   * Assign (or refresh) the account manager for a business. Called when a paid
   * membership activates. Idempotent: an existing active manager is kept unless
   * `force` is set.
   */
  async assignForBusiness(
    businessId: string,
    opts: { force?: boolean; notify?: boolean } = {},
  ): Promise<AssignedAccountManager | null> {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!business) throw new NotFoundException('Business profile not found');

    if (!opts.force && business.accountManagerId) {
      const existing = await this.getAssignedAccountManager(businessId);
      if (existing) return existing;
    }

    const candidates = await this.prisma.accountManagerProfile.findMany({
      where: { deletedAt: null, status: 'Active', user: { deletedAt: null } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!candidates.length) {
      this.logger.warn(`No active account managers available for business ${businessId}`);
      return null;
    }

    const ranked = rankByAffinity(
      {
        cityId: business.cityId,
        boroughId: business.boroughId,
        highStreetId: business.highStreetId,
        localMallId: business.localMallId,
        postcode: business.postcode,
      },
      candidates.map<AffinityCandidate>((p) => ({
        id: p.id,
        userId: p.userId,
        role: Role.ACCOUNT_MANAGER,
        cityId: p.cityId,
        boroughId: p.boroughId,
        highStreetId: p.highStreetId,
        localMallId: p.localMallId,
        postcode: p.postcode,
        reputationScore: p.reputationScore,
        experienceScore: p.experienceScore,
        completedTasksCount: p.completedTasksCount,
        assignedBusinesses: p.assignedBusinesses,
      })),
    );

    const best = ranked[0];
    if (!best) return null;
    const chosen = candidates.find((c) => c.userId === best.candidate.userId);
    if (!chosen) return null;

    const previousManagerId = business.accountManagerId;

    await this.prisma.$transaction(async (tx) => {
      await tx.businessProfile.update({
        where: { id: businessId },
        data: {
          accountManagerId: chosen.userId,
          accountManagerAssignedAt: new Date(),
        },
      });

      if (previousManagerId && previousManagerId !== chosen.userId) {
        await tx.accountManagerProfile.updateMany({
          where: { userId: previousManagerId, assignedBusinesses: { gt: 0 } },
          data: { assignedBusinesses: { decrement: 1 } },
        });
      }
      if (previousManagerId !== chosen.userId) {
        await tx.accountManagerProfile.update({
          where: { id: chosen.id },
          data: { assignedBusinesses: { increment: 1 } },
        });
      }
    });

    // Open the direct chat thread so messaging works immediately, and notify
    // both parties. Neither step may fail the assignment transaction.
    let conversationId: string | null = null;
    try {
      const conversation = await this.chat.getOrCreateDirectConversation(
        business.userId,
        chosen.userId,
      );
      conversationId = conversation?.id ?? null;
    } catch (error: any) {
      this.logger.warn(
        `Could not open account-manager conversation for business ${businessId}: ${error?.message}`,
      );
    }

    if (opts.notify !== false) {
      await this.notifyAssignment({
        business,
        manager: {
          userId: chosen.userId,
          email: chosen.user.email,
          firstName: chosen.user.firstName,
          lastName: chosen.user.lastName,
        },
        conversationId,
        matchedLevel: best.score.matchedLevel,
      });
    }

    this.logger.log(
      `Assigned account manager ${chosen.userId} to business ${businessId} ` +
        `(${best.score.matchedLevel}, score ${best.score.total})`,
    );

    return this.getAssignedAccountManager(businessId);
  }

  async getAssignedAccountManager(businessId: string): Promise<AssignedAccountManager | null> {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        accountManagerId: true,
        accountManagerAssignedAt: true,
        cityId: true,
        boroughId: true,
        highStreetId: true,
        localMallId: true,
        postcode: true,
        accountManager: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            deletedAt: true,
            accountManagerProfile: {
              select: {
                id: true,
                phone: true,
                postcode: true,
                cityId: true,
                boroughId: true,
                highStreetId: true,
                localMallId: true,
                reputationScore: true,
                experienceScore: true,
                completedTasksCount: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!business?.accountManager || !business.accountManager.accountManagerProfile) {
      return null;
    }
    const manager = business.accountManager;
    const profile = manager.accountManagerProfile;
    if (manager.deletedAt || profile.deletedAt || profile.status !== 'Active') return null;

    const summary = await this.reputation.getSummary(manager.id);
    // Recompute proximity for display purposes.
    const ranked = rankByAffinity(
      {
        cityId: business.cityId,
        boroughId: business.boroughId,
        highStreetId: business.highStreetId,
        localMallId: business.localMallId,
        postcode: business.postcode,
      },
      [
        {
          id: profile.id,
          userId: manager.id,
          role: Role.ACCOUNT_MANAGER,
          cityId: profile.cityId,
          boroughId: profile.boroughId,
          highStreetId: profile.highStreetId,
          localMallId: profile.localMallId,
          postcode: profile.postcode,
          reputationScore: profile.reputationScore,
          experienceScore: profile.experienceScore,
          completedTasksCount: profile.completedTasksCount,
        },
      ],
    );
    const score = ranked[0]?.score;

    return {
      userId: manager.id,
      profileId: profile.id,
      name:
        [manager.firstName, manager.lastName].filter(Boolean).join(' ') || manager.email,
      email: manager.email,
      phone: profile.phone ?? null,
      postcode: profile.postcode ?? null,
      assignedAt: business.accountManagerAssignedAt,
      reputationScore: summary.reputationScore,
      experienceScore: summary.experienceScore,
      completedTasksCount: summary.completedTasksCount,
      ratingAverage: summary.ratingAverage,
      ratingCount: summary.ratingCount,
      matchedLevel: score?.matchedLevel ?? null,
      proximityScore: score?.total ?? null,
    };
  }

  private async notifyAssignment(input: {
    business: {
      id: string;
      businessName: string;
      email: string;
      userId: string;
    };
    manager: {
      userId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    conversationId: string | null;
    matchedLevel: string;
  }): Promise<void> {
    const { business, manager, conversationId, matchedLevel } = input;
    const managerName =
      [manager.firstName, manager.lastName].filter(Boolean).join(' ') || manager.email;
    const messagesUrl = `${this.frontendUrl()}/dashboard/messages`;
    const tasksUrl = `${this.frontendUrl()}/dashboard/tasks`;

    await Promise.allSettled([
      this.prisma.notification.create({
        data: {
          businessId: business.id,
          userId: business.userId,
          type: 'account_manager_assigned',
          title: 'Your account manager is ready',
          message: `${managerName} has been assigned as your dedicated account manager. You can message them any time.`,
          data: { accountManagerUserId: manager.userId, conversationId },
        },
      }),
      this.prisma.notification.create({
        data: {
          userId: manager.userId,
          type: 'account_manager_assigned',
          title: 'New business assigned',
          message: `${business.businessName} has been assigned to you as their account manager.`,
          data: { businessId: business.id, conversationId },
        },
      }),
      this.sendMail({
        to: business.email,
        subject: `Your account manager is ${managerName}`,
        html: `
          <p>Hi ${business.businessName},</p>
          <p><strong>${managerName}</strong> is now your dedicated account manager (matched by ${this.humaniseLevel(matchedLevel)}).</p>
          <p>You can chat with them directly and delegate tasks from your dashboard.</p>
          <p><a href="${messagesUrl}">Open messages</a> · <a href="${tasksUrl}">Delegate a task</a></p>
        `,
      }),
      this.sendMail({
        to: manager.email,
        subject: `You have a new account: ${business.businessName}`,
        html: `
          <p>Hi ${managerName},</p>
          <p>You have been assigned as the account manager for <strong>${business.businessName}</strong>.</p>
          <p>Start the conversation from the shared messaging thread, and watch for delegated tasks.</p>
          <p><a href="${this.frontendUrl()}/dashboard/messages">Open messages</a></p>
        `,
      }),
    ]);
  }

  /**
   * Nightly backfill for businesses that have never had an account manager
   * (e.g. memberships activated before the assignment flow existed).
   *
   * Only paid, currently-active memberships are eligible — trial and access
   * pass businesses are intentionally excluded. Each run is capped so a large
   * backlog is cleared gradually without email/chat spikes.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async backfillMissingAccountManagers(limit?: number) {
    const configured = Number(
      this.config.get<string>('ACCOUNT_MANAGER_BACKFILL_BATCH') || 100,
    );
    const batchSize = Math.min(500, Math.max(1, Number(limit) || configured || 100));
    const now = new Date();

    const candidates = await this.prisma.businessProfile.findMany({
      where: {
        deletedAt: null,
        accountManagerId: null,
        // "never had one" — a previous assignment leaves this timestamp set.
        accountManagerAssignedAt: null,
        membershipStatus: MembershipStatus.active,
        membershipPlanName: { not: null },
        OR: [
          { membershipExpiresAt: null },
          { membershipExpiresAt: { gt: now } },
        ],
      },
      select: { id: true, businessName: true },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    if (!candidates.length) {
      this.logger.log('Account-manager backfill: no eligible businesses found');
      return { candidates: 0, assigned: 0, skipped: 0, failed: 0 };
    }

    let assigned = 0;
    let skipped = 0;
    let failed = 0;

    for (const business of candidates) {
      try {
        const result = await this.assignForBusiness(business.id, { notify: true });
        if (result) {
          assigned += 1;
        } else {
          skipped += 1;
        }
      } catch (error: any) {
        failed += 1;
        this.logger.error(
          `Account-manager backfill failed for ${business.businessName} (${business.id}): ${error?.message}`,
        );
      }
    }

    const summary = { candidates: candidates.length, assigned, skipped, failed };
    this.logger.log(
      `Account-manager backfill complete: ${assigned} assigned, ${skipped} skipped, ${failed} failed ` +
        `(of ${candidates.length} candidates)`,
    );
    return summary;
  }

  private humaniseLevel(level: string): string {
    switch (level) {
      case 'local_mall':
        return 'local mall proximity';
      case 'high_street':
        return 'high-street proximity';
      case 'borough':
        return 'borough proximity';
      case 'city':
        return 'city proximity';
      case 'postcode':
        return 'postcode proximity';
      default:
        return 'reputation and availability';
    }
  }

  private async sendMail(input: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.mail.send(input);
    } catch (error: any) {
      // Email transport may be unconfigured locally — never fail the assignment.
      this.logger.warn(`Assignment email to ${input.to} failed: ${error?.message}`);
    }
  }
}
