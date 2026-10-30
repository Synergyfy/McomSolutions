import { Injectable, Logger } from '@nestjs/common';
import { CouponService } from '../coupon/coupon.service';
import { EcosystemEventsService } from '../ecosystem-events/ecosystem-events.service';
import { ServiceCaller } from '../mesh-inbound/service-caller.types';
import { MCOM_REWARDS_CLIENT_ID } from '../mesh-inbound/service-mesh.constants';
import { PartnerAuditService } from './partner-audit.service';
import { CreatePartnerCouponDto } from './dto/partner-coupon.dto';

const PARTNER_SOURCE = MCOM_REWARDS_CLIENT_ID;

/**
 * Partner coupon surface. Central coupons discount MCOM memberships and access
 * passes only — never Mall goods. Creation reuses the admin validation path.
 */
@Injectable()
export class PartnerCouponService {
  private readonly logger = new Logger(PartnerCouponService.name);

  constructor(
    private readonly coupons: CouponService,
    private readonly events: EcosystemEventsService,
    private readonly audit: PartnerAuditService,
  ) {}

  async create(dto: CreatePartnerCouponDto, caller: ServiceCaller) {
    const { issuanceId, ...couponInput } = dto;
    try {
      const coupon = await this.coupons.createPartnerCoupon(couponInput, {
        sourceApp: PARTNER_SOURCE,
        externalRef: issuanceId,
      });

      if (!coupon.replayed) {
        this.events.emitCouponCreated({
          issuanceId,
          code: coupon.code,
          lockedToUserId: coupon.lockedToUserId,
        });
      }

      await this.audit.record({
        callerClientId: caller.callerAppId,
        scope: 'central:issue',
        action: 'coupon.created',
        targetType: 'Coupon',
        targetId: coupon.id,
        issuanceId,
        outcome: 'success',
        statusCode: 200,
        metadata: { code: coupon.code, replayed: coupon.replayed },
      });

      return {
        success: true,
        id: coupon.id,
        code: coupon.code,
        status: coupon.status,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        lockedToUserId: coupon.lockedToUserId,
        validFrom: coupon.validFrom,
        expiresAt: coupon.expiresAt,
        replayed: coupon.replayed,
      };
    } catch (err) {
      await this.failure(caller, 'coupon.created', issuanceId, err);
      throw err;
    }
  }

  async inspect(code: string, caller: ServiceCaller) {
    try {
      const coupon = await this.coupons.getPartnerCoupon(code, PARTNER_SOURCE);
      return {
        success: true,
        id: coupon.id,
        code: coupon.code,
        status: coupon.status,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        appliesToAllMemberships: coupon.appliesToAllMemberships,
        membershipPlanIds: coupon.membershipPlanIds,
        appliesToAllAccess: coupon.appliesToAllAccess,
        accessPlanIds: coupon.accessPlanIds,
        timesRedeemed: coupon.timesRedeemed,
        remainingUses: coupon.remainingUses,
        maxUses: coupon.maxUses,
        maxUsesPerUser: coupon.maxUsesPerUser,
        redemptionCount: coupon.redemptionCount,
        lockedToUserId: coupon.lockedToUserId,
        validFrom: coupon.validFrom,
        expiresAt: coupon.expiresAt,
        isActive: coupon.isActive,
        sourceApp: coupon.sourceApp,
        externalRef: coupon.externalRef,
      };
    } catch (err) {
      await this.failure(caller, 'coupon.inspected', undefined, err);
      throw err;
    }
  }

  async revoke(code: string, caller: ServiceCaller) {
    try {
      const result = await this.coupons.revokePartnerCoupon(code, PARTNER_SOURCE);
      if (!result.replayed) {
        this.events.emitCouponRevoked({
          issuanceId: result.externalRef ?? '',
          code: result.code,
          revokedAt: new Date().toISOString(),
        });
      }
      await this.audit.record({
        callerClientId: caller.callerAppId,
        scope: 'central:issue',
        action: 'coupon.revoked',
        targetType: 'Coupon',
        targetId: result.code,
        outcome: 'success',
        statusCode: 200,
        metadata: { code: result.code, replayed: result.replayed },
      });
      return { ...result, success: true };
    } catch (err) {
      await this.failure(caller, 'coupon.revoked', undefined, err);
      throw err;
    }
  }

  private async failure(
    caller: ServiceCaller,
    action: string,
    issuanceId: string | undefined,
    err: unknown,
  ): Promise<void> {
    const response = (err as any)?.getResponse?.();
    const statusCode = (err as any)?.getStatus?.() ?? 500;
    const errorCode =
      (response && typeof response === 'object' && response.code) || 'INTERNAL_ERROR';
    await this.audit.record({
      callerClientId: caller?.callerAppId ?? 'unknown',
      scope: 'central:issue',
      action,
      issuanceId: issuanceId ?? null,
      outcome: 'error',
      statusCode,
      errorCode: String(errorCode),
      metadata: { message: (err as Error)?.message ?? String(err) },
    });
    this.logger.warn(
      `Partner ${action} failed (${errorCode}): ${(err as Error)?.message ?? err}`,
    );
  }
}
