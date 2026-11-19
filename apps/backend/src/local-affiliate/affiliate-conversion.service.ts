import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AffiliateAttributionMethod,
  AffiliateConversionStatus,
  AffiliateQualifyingEvent,
  AffiliateRewardStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateRewardService } from './affiliate-reward.service';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  PURCHASE_LIKE_EVENTS,
  explain,
} from './local-affiliate.constants';
import { IngestConversionDto } from './dto/affiliate-partner.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AffiliateConversionService {
  private readonly logger = new Logger(AffiliateConversionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: AffiliateTrackingService,
    private readonly rewards: AffiliateRewardService,
  ) {}

  // ── Ingest ─────────────────────────────────────────────────────────────

  /**
   * Provider → Central conversion push. Idempotent on
   * (providerId, providerTransactionId, eventType); a replay returns the
   * existing row with `duplicate: true`.
   */
  async ingest(dto: IngestConversionDto) {
    const provider = await this.prisma.affiliateProvider.findUnique({
      where: { code: dto.provider },
    });
    if (!provider) {
      throw new NotFoundException(`Unknown provider: ${dto.provider}`);
    }

    const existing = await this.prisma.affiliateConversion.findFirst({
      where: {
        providerId: provider.id,
        providerTransactionId: dto.providerOrderId,
        eventType: dto.eventType,
      },
    });
    if (existing) {
      return { conversion: existing, duplicate: true };
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    let conversion;
    try {
      conversion = await this.prisma.affiliateConversion.create({
        data: {
          providerId: provider.id,
          providerTransactionId: dto.providerOrderId,
          providerOrderRef: dto.providerOrderId,
          eventType: dto.eventType,
          amountMinor: dto.amountMinor ?? null,
          currency: dto.currency ?? 'GBP',
          occurredAt,
          status: AffiliateConversionStatus.RECEIVED,
          customerUserId: dto.customerRef ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Concurrent replay lost the race — return the winner.
        const winner = await this.prisma.affiliateConversion.findFirst({
          where: {
            providerId: provider.id,
            providerTransactionId: dto.providerOrderId,
            eventType: dto.eventType,
          },
        });
        return { conversion: winner!, duplicate: true };
      }
      throw error;
    }

    if (dto.trackingCode) {
      await this.attribute(conversion.id, dto.trackingCode, {
        method: AffiliateAttributionMethod.INTERNAL_LAST_CLICK,
        reason: 'Tracking code supplied by the provider',
      });
    }

    const fresh = await this.prisma.affiliateConversion.findUnique({
      where: { id: conversion.id },
    });
    return { conversion: fresh!, duplicate: false };
  }

  // ── Attribution ────────────────────────────────────────────────────────

  /**
   * Commits an attribution decision and immediately evaluates the reward.
   *
   * Purchase-like events require a click inside the window. Events that can
   * only happen after an explicit code was presented (redemption, lead) are
   * attributed without a click, at MEDIUM confidence.
   */
  async attribute(
    conversionId: string,
    trackingCode: string,
    opts: {
      method?: AffiliateAttributionMethod;
      reason?: string;
      decidedByUserId?: string | null;
    } = {},
  ) {
    const conversion = await this.prisma.affiliateConversion.findUnique({
      where: { id: conversionId },
      include: { attribution: true },
    });
    if (!conversion) throw new NotFoundException('Conversion not found');

    if (conversion.attribution) {
      return {
        attributed: true,
        alreadyAttributed: true,
        conversion,
      };
    }

    const link = await this.prisma.affiliateTrackingLink.findUnique({
      where: { code: trackingCode },
      include: {
        localAffiliate: { select: { id: true, userId: true, status: true } },
        offer: {
          select: {
            id: true,
            integrationLevel: true,
            status: true,
            campaignLinks: { select: { campaignId: true } },
          },
        },
      },
    });

    if (!link || !link.isActive) {
      await this.prisma.affiliateConversion.update({
        where: { id: conversionId },
        data: {
          status: AffiliateConversionStatus.UNMATCHED,
          explanationText: 'Tracking code not recognised',
        },
      });
      return { attributed: false, reason: 'TRACKING_CODE_UNKNOWN', conversion };
    }

    // Self-referral: the buyer is the affiliate.
    if (conversion.customerUserId && conversion.customerUserId === link.localAffiliate.userId) {
      await this.prisma.affiliateConversion.update({
        where: { id: conversionId },
        data: {
          status: AffiliateConversionStatus.REJECTED,
          rejectionReason: 'SELF_REFERRAL',
          explanationText: explain('SELF_REFERRAL'),
        },
      });
      return { attributed: false, reason: 'SELF_REFERRAL', conversion };
    }

    const campaign = conversion.campaignId
      ? await this.prisma.affiliateCampaign.findUnique({
          where: { id: conversion.campaignId },
        })
      : null;
    const windowDays =
      campaign?.defaultAttributionWindowDays ?? DEFAULT_ATTRIBUTION_WINDOW_DAYS;

    let clickedAt: Date | null = null;
    if (PURCHASE_LIKE_EVENTS.includes(conversion.eventType)) {
      clickedAt = await this.tracking.lastClickAt(link.id);
      if (clickedAt) {
        const delta = conversion.occurredAt.getTime() - clickedAt.getTime();
        if (delta > windowDays * DAY_MS) {
          await this.prisma.affiliateConversion.update({
            where: { id: conversionId },
            data: {
              status: AffiliateConversionStatus.EXPIRED_UNATTRIBUTED,
              trackingLinkId: link.id,
              attributionWindowDays: windowDays,
              explanationText: explain('OUTSIDE_WINDOW'),
            },
          });
          return { attributed: false, reason: 'OUTSIDE_WINDOW', conversion };
        }
      }
    }

    const method =
      opts.method ?? AffiliateAttributionMethod.INTERNAL_LAST_CLICK;
    const confidence = clickedAt ? 'HIGH' : 'MEDIUM';

    const result = await this.prisma.$transaction(async (tx) => {
      const attribution = await tx.affiliateAttribution.create({
        data: {
          conversionId,
          trackingLinkId: link.id,
          localAffiliateId: link.localAffiliateId,
          attributionMethod: method,
          windowDays,
          clickedAt,
          convertedAt: conversion.occurredAt,
          confidence,
          reason:
            opts.reason ??
            (clickedAt
              ? `Last eligible click within ${windowDays} days`
              : 'Explicit tracking code presented; no click recorded'),
          decidedByUserId: opts.decidedByUserId ?? null,
        },
      });

      const updated = await tx.affiliateConversion.update({
        where: { id: conversionId },
        data: {
          trackingLinkId: link.id,
          localAffiliateId: link.localAffiliateId,
          offerId: link.offerId,
          campaignId: link.campaignId ?? conversion.campaignId,
          status: AffiliateConversionStatus.ATTRIBUTED,
          attributionMethod: method,
          attributionWindowDays: windowDays,
        },
      });

      return { attribution, updated };
    });

    await this.tracking.markConverted(link.id, conversion.occurredAt);

    // Evaluate the reward immediately; failures are logged, not fatal — the
    // admin reconciliation queue will surface them.
    try {
      await this.rewards.applyToConversion(conversionId);
    } catch (error) {
      this.logger.error(
        `Reward evaluation failed for conversion ${conversionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return { attributed: true, conversion: result.updated };
  }

  async adminAttribute(
    conversionId: string,
    trackingCode: string,
    adminUserId: string,
    reason?: string,
  ) {
    const result = await this.attribute(conversionId, trackingCode, {
      method: AffiliateAttributionMethod.MANUAL,
      reason: reason ?? 'Attributed manually by admin',
      decidedByUserId: adminUserId,
    });
    if (!result.attributed && result.reason) {
      throw new UnprocessableEntityException(result.reason);
    }
    return { success: true, data: result.conversion };
  }

  // ── Admin actions ──────────────────────────────────────────────────────

  async approveConversion(conversionId: string, adminUserId: string, reason?: string) {
    const conversion = await this.requireConversion(conversionId);

    let pending = await this.prisma.affiliateRewardLedger.findMany({
      where: { conversionId, status: AffiliateRewardStatus.PENDING },
    });

    if (pending.length === 0) {
      const existing = await this.prisma.affiliateRewardLedger.count({
        where: { conversionId },
      });
      if (existing === 0) {
        await this.rewards.applyToConversion(conversionId);
        pending = await this.prisma.affiliateRewardLedger.findMany({
          where: { conversionId, status: AffiliateRewardStatus.PENDING },
        });
      }
    }

    for (const row of pending) {
      await this.rewards.approve(row.id, adminUserId, reason ?? 'Approved by admin');
    }

    return {
      success: true,
      data: { conversionId: conversion.id, approved: pending.length },
    };
  }

  async rejectConversion(
    conversionId: string,
    adminUserId: string,
    reasonCode = 'NOT_ELIGIBLE',
    reason?: string,
  ) {
    await this.requireConversion(conversionId);

    const pending = await this.prisma.affiliateRewardLedger.findMany({
      where: {
        conversionId,
        status: {
          in: [AffiliateRewardStatus.PENDING, AffiliateRewardStatus.APPROVED],
        },
      },
    });

    for (const row of pending) {
      await this.rewards.reject(row.id, reasonCode, adminUserId, reason);
    }

    await this.prisma.affiliateConversion.update({
      where: { id: conversionId },
      data: {
        status: AffiliateConversionStatus.REJECTED,
        rejectionReason: reasonCode,
        explanationText: explain(reasonCode) ?? reason ?? null,
      },
    });

    return { success: true, data: { conversionId, rejected: pending.length } };
  }

  async reverseConversion(conversionId: string, adminUserId: string, reasonCode = 'REFUNDED') {
    await this.requireConversion(conversionId);
    const result = await this.rewards.reverseConversion(
      conversionId,
      reasonCode,
      adminUserId,
    );
    return { success: true, data: result };
  }

  // ── Maintenance ────────────────────────────────────────────────────────

  /**
   * Marks unmatched conversions past the retention window as expired so the
   * reconciliation queue stays meaningful.
   */
  async expireStaleUnmatched(days = 45): Promise<number> {
    const cutoff = new Date(Date.now() - days * DAY_MS);
    const result = await this.prisma.affiliateConversion.updateMany({
      where: {
        status: AffiliateConversionStatus.UNMATCHED,
        occurredAt: { lt: cutoff },
      },
      data: {
        status: AffiliateConversionStatus.EXPIRED_UNATTRIBUTED,
        explanationText: 'No tracking attribution within the retention window',
      },
    });
    return result.count;
  }

  private async requireConversion(id: string) {
    const conversion = await this.prisma.affiliateConversion.findUnique({
      where: { id },
    });
    if (!conversion) throw new NotFoundException('Conversion not found');
    return conversion;
  }

  /** Convenience for tests and for the redemption service. */
  async createRedemptionConversion(input: {
    providerId: string;
    redemptionId: string;
    offerId: string;
    campaignId?: string | null;
    amountMinor?: number | null;
    customerUserId?: string | null;
    trackingCode?: string | null;
    occurredAt?: Date;
  }) {
    const existing = await this.prisma.affiliateConversion.findFirst({
      where: {
        providerId: input.providerId,
        providerTransactionId: `redemption:${input.redemptionId}`,
        eventType: AffiliateQualifyingEvent.VERIFIED_REDEMPTION,
      },
    });
    if (existing) return existing;

    const conversion = await this.prisma.affiliateConversion.create({
      data: {
        providerId: input.providerId,
        providerTransactionId: `redemption:${input.redemptionId}`,
        providerOrderRef: `redemption:${input.redemptionId}`,
        eventType: AffiliateQualifyingEvent.VERIFIED_REDEMPTION,
        amountMinor: input.amountMinor ?? null,
        currency: 'GBP',
        occurredAt: input.occurredAt ?? new Date(),
        status: AffiliateConversionStatus.RECEIVED,
        customerUserId: input.customerUserId ?? null,
        offerId: input.offerId,
        campaignId: input.campaignId ?? null,
      },
    });

    if (input.trackingCode) {
      await this.attribute(conversion.id, input.trackingCode, {
        method: AffiliateAttributionMethod.INTERNAL_LAST_CLICK,
        reason: 'Voucher presented at the provider',
      });
    }

    return (
      (await this.prisma.affiliateConversion.findUnique({
        where: { id: conversion.id },
      })) ?? conversion
    );
  }
}
