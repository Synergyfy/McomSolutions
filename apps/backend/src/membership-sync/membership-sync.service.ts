import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { appSupportsRole } from '../common/profile-sync/profile-sync.constants';
import { MEMBERSHIP_UPDATED_EVENT } from '../common/membership-sync/membership-sync.constants';

/** One platform package provisioned by the membership for a bundled app. */
export interface MembershipAppGrant {
  /** Platform name exactly as stored on the membership bundle. */
  platform: string;
  /** Plan name the app should activate for the user. */
  packageName: string;
  /** App-side plan id (the app maps it to its own catalogue). */
  externalPlanId?: string | null;
  /** App-specific quotas/feature flags resolved for the purchased tier. */
  limits?: Record<string, unknown> | null;
}

export interface MembershipUpdatedInput {
  /** Central Hub user id — the identity every bundled app already knows. */
  userId?: string | null;
  /** Central BusinessProfile id (the business that owns the membership). */
  businessId: string;
  plan: {
    id?: string | null;
    name: string;
    /** Canonical tier: `Standard`, `Pro` or `Pro+`. */
    tier: string;
    /** Membership level stored on the business profile (Bronze…Platinum). */
    level?: string | null;
    status?: string;
    billingCycle?: string | null;
    amount?: number | null;
    currency?: string;
    startsAt?: Date | null;
    expiresAt?: Date | null;
  };
  /** Bundled apps provisioned by this activation. */
  apps: MembershipAppGrant[];
}

export interface MembershipEndedInput {
  userId?: string | null;
  businessId: string;
  planId?: string | null;
  planName?: string | null;
  /** Membership level (Bronze…Platinum) when known. */
  level?: string | null;
  /** Canonical tier (`Standard` / `Pro` / `Pro+`) when known. */
  tier?: string | null;
  /** Why access ended — drives `membership.status` in the event. */
  status: 'inactive' | 'expired' | 'cancelled';
  reason?: string;
}

export interface MembershipActivatedInput {
  userId?: string | null;
  businessId: string;
  planId?: string | null;
  planName?: string | null;
  level?: string | null;
  tier?: string | null;
  billingCycle?: string | null;
  amount?: number | null;
  /** New term end — also written onto every bundled platform package. */
  expiresAt?: Date | null;
}

/**
 * Event-driven membership synchronization.
 *
 * Mirrors {@link ProfileSyncService}: every membership activation/renewal that
 * provisions platform packages publishes one `membership.updated` event to
 * each bundled app that registered a `membershipSyncEndpoint` in Console.
 *
 * Routing is bundle-scoped, not broadcast: only apps included in the purchased
 * plan receive the event, so a "Gold Pro+" plan tells MCOM Mall and MCOM
 * Rewards about their packages but never touches an app the plan excludes.
 *
 * The payload carries the canonical membership summary plus the app's own
 * package grant. Delivery reuses the durable webhook pipeline (HMAC signature,
 * BullMQ retries, `AppWebhookLog` audit rows) and is fire-and-forget so a slow
 * consumer can never block or fail the purchase.
 */
@Injectable()
export class MembershipSyncService {
  private readonly logger = new Logger(MembershipSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  /**
   * Publishes a `membership.updated` event to every bundled app. Never throws —
   * membership writes must not fail because a downstream app is unavailable.
   */
  async emitMembershipUpdated(input: MembershipUpdatedInput): Promise<void> {
    try {
      if (!input?.userId || !input.plan?.name) return;

      const grants = (input.apps ?? []).filter(
        (app) => Boolean(app?.platform?.trim()),
      );
      if (grants.length === 0) return;

      const clients = await this.prisma.ssoClient.findMany({
        where: {
          isActive: true,
          membershipSyncEndpoint: { not: null },
        },
        select: {
          clientId: true,
          name: true,
          platformSlug: true,
          supportedRoles: true,
          membershipSyncEndpoint: true,
        },
      });

      if (clients.length === 0) return;

      const occurredAt = new Date();
      const eventId = crypto.randomUUID();
      const membership = {
        planId: input.plan.id ?? null,
        planName: input.plan.name,
        tier: input.plan.tier,
        level: input.plan.level ?? null,
        status: input.plan.status ?? 'active',
        billingCycle: input.plan.billingCycle ?? null,
        amount: input.plan.amount ?? null,
        currency: input.plan.currency ?? 'GBP',
        startsAt: input.plan.startsAt
          ? new Date(input.plan.startsAt).toISOString()
          : null,
        expiresAt: input.plan.expiresAt
          ? new Date(input.plan.expiresAt).toISOString()
          : null,
      };

      let dispatched = 0;
      for (const client of clients) {
        // Memberships belong to businesses. Never send one to an app that
        // only serves customers/agents.
        if (
          !appSupportsRole(
            (client.supportedRoles ?? []) as Role[],
            Role.BUSINESS,
          )
        ) {
          continue;
        }

        const endpoint = client.membershipSyncEndpoint?.trim();
        if (!endpoint) continue;

        const grant = grants.find((app) =>
          this.matchesClientPlatform(client, app.platform),
        );
        if (!grant) continue;

        const data: Record<string, unknown> = {
          eventId,
          occurredAt: occurredAt.toISOString(),
          userId: input.userId,
          businessId: input.businessId,
          membership,
          package: {
            platform: grant.platform,
            packageName: grant.packageName,
            externalPlanId: grant.externalPlanId ?? null,
            status: membership.status,
            limits: grant.limits ?? {},
            expiresAt: membership.expiresAt,
          },
        };

        this.dispatcher.dispatchAsync(
          client.clientId,
          MEMBERSHIP_UPDATED_EVENT,
          data,
          { targetUrl: endpoint },
        );
        dispatched += 1;
      }

      if (dispatched > 0) {
        this.logger.log(
          `Queued ${MEMBERSHIP_UPDATED_EVENT} for ${input.plan.name} (${input.plan.tier}) business ${input.businessId} to ${dispatched} app(s)`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${MEMBERSHIP_UPDATED_EVENT} for business ${input?.businessId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Ensures every bundled platform package is active for the new term and
   * publishes `membership.updated` with `status: active`.
   *
   * Used by the recurring engine (first charge + renewals) because recurring
   * memberships do not pass through `PricingService.finalizeMembershipActivation`.
   * Also restores packages that a previous lapse marked `expired`.
   */
  async syncActiveMembership(input: MembershipActivatedInput): Promise<void> {
    try {
      const businessId = input?.businessId;
      if (!businessId) return;

      const userId =
        input.userId ??
        (
          await this.prisma.businessProfile.findUnique({
            where: { id: businessId },
            select: { userId: true },
          })
        )?.userId ??
        null;

      const plan = await this.findPlan(input.planId, input.planName);
      const bundledApps = this.extractBundledApps(plan?.includedApps);
      if (bundledApps.length === 0) {
        if (!plan) {
          this.logger.warn(
            `Cannot sync membership packages for business ${businessId}: plan "${input.planName ?? input.planId ?? 'unknown'}" was not found`,
          );
        }
        return;
      }

      const billingCycle =
        input.billingCycle ?? this.defaultBillingCycle(input.tier);
      const expiresAt = input.expiresAt ?? null;
      const grants: MembershipAppGrant[] = [];

      for (const app of bundledApps) {
        const limits = (app.limits ?? {}) as Prisma.InputJsonValue;
        const pkg = await this.prisma.platformPackage.upsert({
          where: {
            businessId_platform: { businessId, platform: app.platform },
          },
          create: {
            businessId,
            platform: app.platform,
            packageName: app.packageName,
            externalPlanId: app.externalPlanId ?? null,
            status: 'active',
            limits,
            amount: 0,
            currency: 'GBP',
            billingCycle,
            expiresAt,
          },
          update: {
            packageName: app.packageName,
            externalPlanId: app.externalPlanId ?? null,
            status: 'active',
            limits,
            billingCycle,
            expiresAt,
          },
        });

        grants.push({
          platform: app.platform,
          packageName: pkg.packageName,
          externalPlanId: pkg.externalPlanId ?? app.externalPlanId ?? null,
          limits: (pkg.limits as Record<string, unknown> | null) ?? app.limits ?? {},
        });
      }

      if (!userId) return;

      await this.emitMembershipUpdated({
        userId,
        businessId,
        plan: {
          id: plan?.id ?? input.planId ?? null,
          name: plan?.name ?? input.planName ?? 'Membership',
          tier: input.tier ?? 'Standard',
          level: input.level ?? null,
          status: 'active',
          billingCycle,
          amount: input.amount ?? null,
          currency: 'GBP',
          expiresAt,
        },
        apps: grants,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to sync active membership for business ${input?.businessId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Retires a membership: expires the platform packages provisioned by its
   * plan and notifies every bundled app with `membership.status` =
   * `expired` / `cancelled` / `inactive`.
   *
   * Never throws — expiry runs inside the recurring scheduler and must not
   * fail because a downstream app is unavailable.
   */
  async endMembership(input: MembershipEndedInput): Promise<void> {
    try {
      const businessId = input?.businessId;
      if (!businessId) return;

      const userId =
        input.userId ??
        (
          await this.prisma.businessProfile.findUnique({
            where: { id: businessId },
            select: { userId: true },
          })
        )?.userId ??
        null;

      const plan = await this.findPlan(input.planId, input.planName);
      const bundledApps = this.extractBundledApps(plan?.includedApps);

      let grants: MembershipAppGrant[] = [];
      if (bundledApps.length > 0) {
        const packages = await this.prisma.platformPackage.findMany({
          where: { businessId },
          select: {
            id: true,
            platform: true,
            packageName: true,
            externalPlanId: true,
            limits: true,
          },
        });

        grants = bundledApps.map((app) => {
          const pkg = packages.find((candidate) =>
            this.platformNamesMatch(candidate.platform, app.platform),
          );
          return {
            platform: app.platform,
            packageName: pkg?.packageName ?? app.packageName,
            externalPlanId: pkg?.externalPlanId ?? app.externalPlanId ?? null,
            limits:
              (pkg?.limits as Record<string, unknown> | null) ?? app.limits ?? {},
          };
        });

        // Expire the packages this membership provisioned. Direct standalone
        // packages share the same (businessId, platform) row, so this mirrors
        // the existing platform-mandate behaviour.
        const bundledPackageIds = packages
          .filter((pkg) =>
            bundledApps.some((app) =>
              this.platformNamesMatch(pkg.platform, app.platform),
            ),
          )
          .map((pkg) => pkg.id);

        if (bundledPackageIds.length > 0) {
          await this.prisma.platformPackage.updateMany({
            where: { id: { in: bundledPackageIds } },
            data: { status: 'expired', autoRenew: false },
          });
        }
      }

      if (!plan) {
        this.logger.warn(
          `Cannot fully retire membership for business ${businessId}: plan "${input.planName ?? input.planId ?? 'unknown'}" was not found`,
        );
      }

      if (!userId || grants.length === 0) return;

      await this.emitMembershipUpdated({
        userId,
        businessId,
        plan: {
          id: plan?.id ?? input.planId ?? null,
          name: plan?.name ?? input.planName ?? 'Membership',
          tier: input.tier ?? 'Standard',
          level: input.level ?? null,
          status: input.status,
          billingCycle: null,
          amount: null,
          currency: 'GBP',
          expiresAt: null,
        },
        apps: grants,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to retire membership for business ${input?.businessId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async findPlan(
    planId?: string | null,
    planName?: string | null,
  ): Promise<{
    id: string;
    name: string;
    includedApps: unknown;
  } | null> {
    if (planId) {
      const byId = await this.prisma.membershipPlan.findUnique({
        where: { id: planId },
        select: { id: true, name: true, includedApps: true },
      });
      if (byId) return byId;
    }

    if (planName) {
      return this.prisma.membershipPlan.findFirst({
        where: {
          name: { equals: planName, mode: 'insensitive' },
          archived: false,
        },
        select: { id: true, name: true, includedApps: true },
      });
    }

    return null;
  }

  private extractBundledApps(includedApps: unknown): MembershipAppGrant[] {
    if (!Array.isArray(includedApps)) return [];

    return (includedApps as Array<Record<string, unknown>>)
      .map((app): MembershipAppGrant | null => {
        const platform = String(app?.platform ?? app?.platformName ?? '').trim();
        if (!platform) return null;
        const limits =
          app?.quotas && typeof app.quotas === 'object'
            ? (app.quotas as Record<string, unknown>)
            : app?.limits && typeof app.limits === 'object'
              ? (app.limits as Record<string, unknown>)
              : {};
        return {
          platform,
          packageName: String(
            app?.planName ?? app?.name ?? platform,
          ),
          externalPlanId:
            app?.planId != null
              ? String(app.planId)
              : app?.externalPlanId != null
                ? String(app.externalPlanId)
                : app?.id != null
                  ? String(app.id)
                  : null,
          limits,
        } satisfies MembershipAppGrant;
      })
      .filter((app): app is MembershipAppGrant => app !== null);
  }

  /**
   * Matches a bundle platform label ("MCOM Mall") against a registered app's
   * name, slug or client id, tolerating casing, punctuation and the common
   * "MCOM " prefix variance.
   */
  private matchesClientPlatform(
    client: {
      clientId: string;
      name: string;
      platformSlug?: string | null;
    },
    platform: string,
  ): boolean {
    const candidates = [client.name, client.platformSlug, client.clientId]
      .filter((value): value is string => Boolean(value));

    return candidates.some((candidate) =>
      this.platformNamesMatch(candidate, platform),
    );
  }

  private defaultBillingCycle(tier?: string | null): string {
    const normalized = String(tier ?? '').toUpperCase().replace(/[^A-Z+]/g, '');
    if (normalized === 'PRO+' || normalized === 'PROPLUS') return 'Annually';
    if (normalized === 'PRO') return '180 Days';
    return '90 Days';
  }

  private platformNamesMatch(left: string, right: string): boolean {    const norm = (value: string) =>
      value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
    const target = norm(right?.trim() ?? '');
    if (!target) return false;

    const candidate = norm(left?.trim() ?? '');
    if (!candidate) return false;
    if (candidate === target) return true;

    // Substring fallback for decorated names ("MCOM Mall" vs "Mall"). Guard
    // against very short names matching everything.
    return (
      candidate.length >= 4 &&
      (candidate.includes(target) || target.includes(candidate))
    );
  }
}
