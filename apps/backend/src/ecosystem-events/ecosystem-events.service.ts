import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CouponRedemptionStatus, PartnerGrantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import {
  PARTNER_EVENT_TARGET,
  PartnerFeature,
} from '../mesh-inbound/service-mesh.constants';

export interface PartnerEventPayload {
  issuanceId: string;
  [key: string]: unknown;
}

/**
 * Central → Rewards lifecycle events.
 *
 * Transport: the existing webhook dispatcher (signed with
 * `X-Mcom-Webhook-Signature`, retried with backoff, logged in AppWebhookLog).
 * Delivery is at-least-once; consumers dedupe on `(issuanceId, event)`, which
 * is also carried as `eventId`.
 *
 * Never blocks the synchronous partner response: dispatchAsync enqueues to
 * BullMQ and returns immediately.
 */
@Injectable()
export class EcosystemEventsService {
  private readonly logger = new Logger(EcosystemEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: WebhookDispatcherService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    const raw = (this.config.get<string>(PartnerFeature.EVENTS) ?? '')
      .trim()
      .toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  emit(event: string, payload: PartnerEventPayload): void {
    if (!this.isEnabled()) return;
    if (!payload?.issuanceId) {
      this.logger.warn(`Skipping ${event}: payload has no issuanceId`);
      return;
    }
    try {
      this.dispatcher.dispatchAsync(PARTNER_EVENT_TARGET, event, {
        ...payload,
        eventId: `${payload.issuanceId}:${event}`,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue ${event} for ${payload.issuanceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  emitMembershipGranted(payload: PartnerEventPayload): void {
    this.emit('central.membership.granted', payload);
  }

  emitMembershipExpired(payload: PartnerEventPayload): void {
    this.emit('central.membership.expired', payload);
  }

  emitAccessCodeCreated(payload: PartnerEventPayload): void {
    this.emit('central.access_pass.code_created', payload);
  }

  emitAccessPassRedeemed(payload: PartnerEventPayload): void {
    this.emit('central.access_pass.redeemed', payload);
  }

  emitCouponCreated(payload: PartnerEventPayload): void {
    this.emit('central.coupon.created', payload);
  }

  emitCouponExpired(payload: PartnerEventPayload): void {
    this.emit('central.coupon.expired', payload);
  }

  emitCouponRevoked(payload: PartnerEventPayload): void {
    this.emit('central.coupon.revoked', payload);
  }

  emitGrantRevoked(payload: PartnerEventPayload): void {
    this.emit('central.grant.revoked', payload);
  }

  /**
   * Emits `central.coupon.redeemed` for a completed redemption, but only when
   * the coupon was partner-issued (`sourceApp` set). Safe to call after the
   * activation transaction commits.
   */
  async emitCouponRedeemedForRedemption(redemptionId: string): Promise<void> {
    if (!this.isEnabled() || !redemptionId) return;
    try {
      const redemption = await this.prisma.couponRedemption.findUnique({
        where: { id: redemptionId },
        include: {
          coupon: {
            select: { code: true, sourceApp: true, externalRef: true },
          },
        },
      });
      if (!redemption || !redemption.coupon.sourceApp) return;
      const issuanceId = redemption.coupon.externalRef;
      if (!issuanceId) return;

      this.emit('central.coupon.redeemed', {
        issuanceId,
        code: redemption.coupon.code,
        couponCode: redemption.coupon.code,
        userId: redemption.userId,
        businessId: redemption.businessId,
        redemptionId: redemption.id,
        discountAmount: Number(redemption.discountAmount),
        redeemedAt: (redemption.redeemedAt ?? new Date()).toISOString(),
      });
    } catch (err) {
      this.logger.warn(
        `Could not emit coupon redemption event for ${redemptionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Idempotent expiry sweep. Claims each row before emitting so a restart or
   * overlapping cron run cannot double-send.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepLifecycleEvents(): Promise<{ coupons: number; grants: number }> {
    if (!this.isEnabled()) return { coupons: 0, grants: 0 };
    const now = new Date();
    let coupons = 0;
    let grants = 0;

    const expiringCoupons = await this.prisma.coupon.findMany({
      where: {
        sourceApp: { not: null },
        externalRef: { not: null },
        expiresAt: { lte: now },
        expiryEventSentAt: null,
      },
      select: { id: true, code: true, externalRef: true },
      take: 200,
    });
    for (const coupon of expiringCoupons) {
      const claimed = await this.prisma.coupon.updateMany({
        where: { id: coupon.id, expiryEventSentAt: null },
        data: { expiryEventSentAt: now },
      });
      if (claimed.count === 0) continue;
      this.emit('central.coupon.expired', {
        issuanceId: coupon.externalRef!,
        code: coupon.code,
        expiredAt: now.toISOString(),
      });
      coupons += 1;
    }

    const expiringGrants = await this.prisma.partnerGrant.findMany({
      where: {
        status: PartnerGrantStatus.GRANTED,
        expiresAt: { lte: now },
      },
      select: { id: true, issuanceId: true, businessId: true, kind: true },
      take: 200,
    });
    for (const grant of expiringGrants) {
      const claimed = await this.prisma.partnerGrant.updateMany({
        where: { id: grant.id, status: PartnerGrantStatus.GRANTED },
        data: {
          status: PartnerGrantStatus.EXPIRED,
          expiryNotifiedAt: now,
        },
      });
      if (claimed.count === 0) continue;
      if (grant.kind === 'MEMBERSHIP') {
        this.emit('central.membership.expired', {
          issuanceId: grant.issuanceId,
          businessId: grant.businessId,
          expiredAt: now.toISOString(),
        });
      }
      grants += 1;
    }

    if (coupons || grants) {
      this.logger.log(`Lifecycle sweep emitted ${coupons} coupon + ${grants} grant events`);
    }
    return { coupons, grants };
  }

  /** Used by the coupon flow: completed-but-scheduled redemptions also emit. */
  async emitCouponRedeemedByPaymentId(
    providerPaymentId: string,
  ): Promise<void> {
    if (!this.isEnabled() || !providerPaymentId) return;
    const redemption = await this.prisma.couponRedemption.findFirst({
      where: {
        providerPaymentId,
        status: CouponRedemptionStatus.COMPLETED,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (redemption) await this.emitCouponRedeemedForRedemption(redemption.id);
  }
}
