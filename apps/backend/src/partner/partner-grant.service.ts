import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MembershipTier, PartnerGrant, PartnerGrantKind, PartnerGrantStatus, Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { EcosystemEventsService } from '../ecosystem-events/ecosystem-events.service';
import { normalizeTier, getTierDurationDays } from '../pricing/tier-duration.util';
import { planTierDisplay } from '../pricing/payment-option.util';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceCaller } from '../mesh-inbound/service-caller.types';
import { MCOM_REWARDS_CLIENT_ID } from '../mesh-inbound/service-mesh.constants';
import { PartnerAuditService } from './partner-audit.service';
import { partnerError, PARTNER_ERRORS, PARTNER_HTTP } from './partner-error.util';
import { PartnerRecipientService } from './partner-recipient.service';

const PARTNER_SOURCE = MCOM_REWARDS_CLIENT_ID;

function displayBusinessTier(tier: MembershipTier): string {
  if (tier === MembershipTier.Pro) return 'Pro';
  if (tier === MembershipTier.ProPlus) return 'Pro+';
  return 'Standard';
}

/**
 * Partner grant orchestration (membership + access-pass code).
 *
 * Idempotency is layered:
 *  1. `PartnerGrant (sourceApp, issuanceId)` unique — replay returns the row.
 *  2. `BillingTransaction.providerPaymentId = rewards:<issuanceId>` unique —
 *     replay returns the existing entitlement.
 *  3. `AccessPassCode (sourceApp, externalRef)` unique — replay returns the code.
 */
@Injectable()
export class PartnerGrantService {
  private readonly logger = new Logger(PartnerGrantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipients: PartnerRecipientService,
    private readonly pricing: PricingService,
    private readonly access: AccessService,
    private readonly events: EcosystemEventsService,
    private readonly audit: PartnerAuditService,
  ) {}

  async grantMembership(
    dto: {
      issuanceId: string;
      recipientMcomUserId: string;
      planId: string;
      tier?: string;
      durationDays?: number;
      extendExisting?: boolean;
      replaceExisting?: boolean;
      note?: string;
    },
    caller: ServiceCaller,
  ) {
    const issuanceId = dto.issuanceId.trim();
    const existing = await this.findGrant(issuanceId);
    if (existing) return this.toMembershipResponse(existing, true);

    try {
      const { user, business } = await this.recipients.resolveBusiness(
        dto.recipientMcomUserId,
      );

      const plan = await this.prisma.membershipPlan.findFirst({
        where: { id: dto.planId, archived: false, deletedAt: null },
        include: { tiers: true },
      });
      if (!plan) {
        throw partnerError(
          PARTNER_HTTP.UNPROCESSABLE,
          PARTNER_ERRORS.PLAN_NOT_AVAILABLE,
          'The membership plan is not available.',
        );
      }

      const requestedTier = normalizeTier(dto.tier ?? 'Standard');
      const tierRow = (plan.tiers ?? []).find(
        (row) => planTierDisplay(row.tier) === requestedTier,
      );
      if ((plan.tiers ?? []).length > 0 && !tierRow) {
        throw partnerError(
          PARTNER_HTTP.UNPROCESSABLE,
          PARTNER_ERRORS.TIER_NOT_AVAILABLE,
          `Tier "${requestedTier}" is not available for this plan.`,
        );
      }

      const durationDays =
        dto.durationDays ?? tierRow?.durationDays ?? getTierDurationDays(requestedTier);
      if (!Number.isInteger(durationDays) || durationDays <= 0) {
        throw partnerError(
          PARTNER_HTTP.UNPROCESSABLE,
          PARTNER_ERRORS.INVALID_DURATION,
          'durationDays must be a positive integer.',
        );
      }

      const now = new Date();
      const activeMembership = this.isActiveMembership(business, now);
      const samePlan =
        activeMembership &&
        (business.membershipPlanName ?? '').toLowerCase() === plan.name.toLowerCase();
      const sameTier =
        samePlan &&
        displayBusinessTier(business.membershipTier) === requestedTier;

      let baseDate = now;
      if (activeMembership && !(samePlan && sameTier)) {
        if (!dto.replaceExisting) {
          throw partnerError(
            PARTNER_HTTP.CONFLICT,
            PARTNER_ERRORS.MEMBERSHIP_CONFLICT,
            'The recipient already has a different membership. Set replaceExisting=true to replace it.',
          );
        }
      } else if (samePlan && sameTier && dto.extendExisting) {
        baseDate = business.membershipExpiresAt
          ? new Date(business.membershipExpiresAt)
          : now;
      }

      const listPrice = tierRow ? Number(tierRow.fullPrice) : Number(plan.price);
      const providerPaymentId = `rewards:${issuanceId}`;
      const metadata: Record<string, unknown> = {
        issuanceId,
        planId: plan.id,
        planName: plan.name,
        tier: requestedTier,
        listPrice,
        originalAmount: listPrice,
        durationDays,
        note: dto.note ?? null,
        requestedBy: caller.callerAppId,
        delegatedUserId: caller.userId ?? null,
      };

      const result = await this.pricing.subscribeMembership(
        business.id,
        plan.id,
        requestedTier,
        'monthly',
        {
          provider: PARTNER_SOURCE,
          providerPaymentId,
          chargedAmount: 0,
          allowZeroAmount: true,
          durationDays,
          baseDate,
          source: PARTNER_SOURCE,
          metadata,
        },
      );

      const expiresAt: Date =
        result?.expiresAt ??
        business.membershipExpiresAt ??
        new Date(baseDate.getTime() + durationDays * 86_400_000);
      const startsAt: Date = result?.startsAt ?? baseDate;

      const grant = await this.createGrant({
        issuanceId,
        kind: PartnerGrantKind.MEMBERSHIP,
        callerClientId: caller.callerAppId,
        businessId: business.id,
        planId: plan.id,
        tier: requestedTier,
        durationDays,
        providerPaymentId,
        expiresAt,
        metadata: { ...metadata, startsAt: startsAt.toISOString() },
      });

      // Lifecycle event (post-commit, non-blocking).
      this.events.emitMembershipGranted({
        issuanceId,
        businessId: business.id,
        planId: plan.id,
        tier: requestedTier,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      await this.audit.record({
        callerClientId: caller.callerAppId,
        scope: 'central:issue',
        action: 'grant.membership',
        targetType: 'BusinessProfile',
        targetId: business.id,
        issuanceId,
        outcome: 'success',
        statusCode: 200,
        metadata: { planId: plan.id, tier: requestedTier, grantId: grant.id },
      });

      return {
        success: true,
        grantId: grant.id,
        businessId: business.id,
        planId: plan.id,
        planName: plan.name,
        tier: requestedTier,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        replayed: grant.replayed ?? false,
        recipientMcomUserId: user.id,
      };
    } catch (err) {
      await this.recordFailure(caller, 'grant.membership', issuanceId, err);
      throw err;
    }
  }

  async issueAccessPassCode(
    dto: {
      issuanceId: string;
      accessPlanId: string;
      recipientEmail?: string;
      recipientMcomUserId?: string;
      mode?: 'GIFT' | 'CODE';
      sendEmail?: boolean;
      note?: string;
    },
    caller: ServiceCaller,
  ) {
    const issuanceId = dto.issuanceId.trim();
    const existingGrant = await this.findGrant(issuanceId);

    try {
      const result = await this.access.issuePartnerAccessCode({
        issuanceId,
        accessPlanId: dto.accessPlanId,
        recipientEmail: dto.recipientEmail,
        recipientMcomUserId: dto.recipientMcomUserId,
        mode: dto.mode ?? 'CODE',
        sendEmail: dto.sendEmail ?? false,
        sourceApp: PARTNER_SOURCE,
        note: dto.note,
      });

      let grant = existingGrant;
      if (!grant) {
        grant = await this.createGrant({
          issuanceId,
          kind: PartnerGrantKind.ACCESS_PASS,
          callerClientId: caller.callerAppId,
          businessId: null,
          planId: dto.accessPlanId,
          tier: null,
          durationDays: result.durationDays ?? null,
          accessPassCodeId: result.codeId,
          metadata: {
            code: result.code,
            planName: result.planName,
            recipientEmail: result.recipientEmail,
            mode: result.mode,
            note: dto.note ?? null,
            requestedBy: caller.callerAppId,
          },
        });
      }

      const replayed = Boolean(result.replayed || existingGrant);
      if (!replayed) {
        this.events.emitAccessCodeCreated({
          issuanceId,
          code: result.code,
          accessPlanId: result.accessPlanId,
        });
      }

      await this.audit.record({
        callerClientId: caller.callerAppId,
        scope: 'central:issue',
        action: 'access_pass.code_created',
        targetType: 'AccessPassCode',
        targetId: result.codeId,
        issuanceId,
        outcome: 'success',
        statusCode: 200,
        metadata: { accessPlanId: result.accessPlanId, replayed: replayed },
      });

      return {
        success: true,
        code: result.code,
        accessPlanId: result.accessPlanId,
        planName: result.planName,
        durationDays: result.durationDays,
        status: result.status,
        recipientEmail: result.recipientEmail,
        expiresAt: result.expiresAt,
        replayed,
        grantId: grant?.id ?? null,
      };
    } catch (err) {
      await this.recordFailure(caller, 'access_pass.code_created', issuanceId, err);
      throw err;
    }
  }

  async revokeGrant(grantId: string, caller: ServiceCaller) {
    const grant = await this.prisma.partnerGrant.findUnique({ where: { id: grantId } });
    if (!grant) {
      throw new NotFoundException({
        code: PARTNER_ERRORS.GRANT_NOT_FOUND,
        message: 'Grant not found',
      });
    }
    if (grant.status === PartnerGrantStatus.REVOKED) {
      return { success: true, grantId, status: 'REVOKED', replayed: true };
    }

    try {
      if (grant.kind === PartnerGrantKind.ACCESS_PASS) {
        if (!grant.accessPassCodeId) {
          throw new ConflictException({
            code: PARTNER_ERRORS.GRANT_NOT_REVOCABLE,
            message: 'This grant has no access-pass code attached.',
          });
        }
        await this.access.revokePartnerAccessCode(grant.accessPassCodeId);
      } else {
        await this.revokeMembershipGrant(grant);
      }

      await this.prisma.partnerGrant.update({
        where: { id: grant.id },
        data: { status: PartnerGrantStatus.REVOKED },
      });

      this.events.emitGrantRevoked({
        issuanceId: grant.issuanceId,
        grantId: grant.id,
        kind: grant.kind,
        revokedAt: new Date().toISOString(),
      });

      await this.audit.record({
        callerClientId: caller.callerAppId,
        scope: 'central:issue',
        action: 'grant.revoked',
        targetType: 'PartnerGrant',
        targetId: grant.id,
        issuanceId: grant.issuanceId,
        outcome: 'success',
        statusCode: 200,
        metadata: { kind: grant.kind },
      });

      return { success: true, grantId: grant.id, status: 'REVOKED', replayed: false };
    } catch (err) {
      await this.recordFailure(caller, 'grant.revoked', grant.issuanceId, err);
      throw err;
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  async listGrants(query: { issuanceId?: string; status?: PartnerGrantStatus; page?: number; limit?: number }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const where: Prisma.PartnerGrantWhereInput = {
      ...(query.issuanceId ? { issuanceId: query.issuanceId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.partnerGrant.count({ where }),
      this.prisma.partnerGrant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true,
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listAccessCodesAdmin(query: {
    sourceApp?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const where: Prisma.AccessPassCodeWhereInput = {
      ...(query.sourceApp ? { sourceApp: query.sourceApp } : {}),
      ...(query.status ? { status: query.status as any } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.accessPassCode.count({ where }),
      this.prisma.accessPassCode.findMany({
        where,
        include: { accessPlan: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        accessPlanId: row.accessPlanId,
        planName: row.accessPlan.name,
        status: row.status,
        sourceApp: row.sourceApp,
        externalRef: row.externalRef,
        recipientEmail: row.recipientEmail,
        mode: row.mode,
        redeemedAt: row.redeemedAt,
        createdAt: row.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async revokeMembershipGrant(grant: PartnerGrant): Promise<void> {
    const billing = grant.providerPaymentId
      ? await this.prisma.billingTransaction.findUnique({
          where: { providerPaymentId: grant.providerPaymentId },
        })
      : null;

    // Only zero-amount reward grants are revocable — never a paid/recurring sub.
    if (
      !billing ||
      billing.provider !== PARTNER_SOURCE ||
      Math.abs(Number(billing.amount)) > 0.005
    ) {
      throw new ConflictException({
        code: PARTNER_ERRORS.GRANT_NOT_REVOCABLE,
        message: 'Only zero-amount reward membership grants can be revoked.',
      });
    }

    const business = await this.prisma.businessProfile.findFirst({
      where: { id: billing.businessId, deletedAt: null },
      select: {
        id: true,
        membershipPlanName: true,
        membershipTier: true,
        membershipRecurringId: true,
        membershipExpiresAt: true,
      },
    });
    if (!business) {
      throw new ConflictException({
        code: PARTNER_ERRORS.GRANT_NOT_REVOCABLE,
        message: 'The grant recipient no longer exists.',
      });
    }
    if (business.membershipRecurringId) {
      throw new ConflictException({
        code: PARTNER_ERRORS.GRANT_NOT_REVOCABLE,
        message: 'This membership has an active recurring mandate and cannot be revoked.',
      });
    }
    const installment = await this.prisma.membershipInstallmentSubscription.findFirst({
      where: { businessId: business.id, status: 'active' },
      select: { id: true },
    });
    if (installment) {
      throw new ConflictException({
        code: PARTNER_ERRORS.GRANT_NOT_REVOCABLE,
        message: 'This membership has an active instalment plan and cannot be revoked.',
      });
    }

    const planMismatch =
      (business.membershipPlanName ?? '').toLowerCase() !==
      (String((grant.metadata as any)?.planName ?? '') || '').toLowerCase();
    const tierMismatch =
      displayBusinessTier(business.membershipTier) !== (grant.tier ?? '');
    if (!planMismatch && !tierMismatch) {
      await this.prisma.businessProfile.update({
        where: { id: business.id },
        data: {
          membershipStatus: 'inactive',
          membershipExpiresAt: new Date(),
        },
      });
    }
  }

  private isActiveMembership(
    business: {
      membershipStatus: string;
      membershipPlanName: string | null;
      membershipExpiresAt: Date | null;
    },
    now: Date,
  ): boolean {
    const status = (business.membershipStatus || '').toLowerCase();
    if (!['active', 'trial', 'past_due'].includes(status)) return false;
    if (!business.membershipPlanName) return false;
    return !business.membershipExpiresAt || business.membershipExpiresAt > now;
  }

  private async findGrant(issuanceId: string): Promise<PartnerGrant | null> {
    return this.prisma.partnerGrant.findUnique({
      where: {
        sourceApp_issuanceId: { sourceApp: PARTNER_SOURCE, issuanceId },
      },
    });
  }

  private async createGrant(input: {
    issuanceId: string;
    kind: PartnerGrantKind;
    callerClientId: string;
    businessId: string | null;
    planId: string;
    tier: string | null;
    durationDays: number | null;
    providerPaymentId?: string | null;
    accessPassCodeId?: string | null;
    expiresAt?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<PartnerGrant & { replayed?: boolean }> {
    try {
      const grant = await this.prisma.partnerGrant.create({
        data: {
          issuanceId: input.issuanceId,
          sourceApp: PARTNER_SOURCE,
          callerClientId: input.callerClientId,
          kind: input.kind,
          businessId: input.businessId,
          planId: input.planId,
          tier: input.tier,
          durationDays: input.durationDays,
          status: PartnerGrantStatus.GRANTED,
          providerPaymentId: input.providerPaymentId ?? null,
          accessPassCodeId: input.accessPassCodeId ?? null,
          expiresAt: input.expiresAt ?? null,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      return grant;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.findGrant(input.issuanceId);
        if (raced) return { ...raced, replayed: true };
      }
      throw err;
    }
  }

  private toMembershipResponse(grant: PartnerGrant, replayed: boolean) {
    const meta = (grant.metadata ?? {}) as Record<string, any>;
    return {
      success: true,
      grantId: grant.id,
      businessId: grant.businessId,
      planId: grant.planId,
      planName: meta.planName ?? grant.planId,
      tier: grant.tier,
      startsAt: meta.startsAt ?? grant.createdAt.toISOString(),
      expiresAt: grant.expiresAt?.toISOString() ?? null,
      replayed,
    };
  }

  private async recordFailure(
    caller: ServiceCaller,
    action: string,
    issuanceId: string,
    err: unknown,
  ): Promise<void> {
    const response = (err as any)?.getResponse?.();
    const statusCode = (err as any)?.getStatus?.() ?? 500;
    const errorCode =
      (response && typeof response === 'object' && response.code) ||
      (err as any)?.code ||
      'INTERNAL_ERROR';
    await this.audit.record({
      callerClientId: caller?.callerAppId ?? 'unknown',
      scope: 'central:issue',
      action,
      issuanceId,
      outcome: 'error',
      statusCode,
      errorCode: String(errorCode),
      metadata: {
        message: (err as Error)?.message ?? String(err),
      },
    });
    this.logger.warn(
      `Partner ${action} failed for ${issuanceId} (${errorCode}): ${
        (err as Error)?.message ?? err
      }`,
    );
  }
}
