import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AffiliateRedemptionStatus,
  AffiliateVoucherStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateConversionService } from './affiliate-conversion.service';
import { AffiliateRewardService } from './affiliate-reward.service';
import {
  generateVoucherCode,
  hashIp,
  identityKey,
} from './local-affiliate.util';
import { IssueVoucherDto } from './dto/affiliate-admin.dto';
import { ValidateVoucherDto } from './dto/affiliate-redemption.dto';

export interface RedemptionActor {
  /** JWT-authenticated user, if any. */
  userId?: string | null;
  /** Business the actor is validating on behalf of, if any. */
  businessId?: string | null;
  channel: 'ONLINE' | 'POS' | 'MANUAL' | 'API';
  ip?: string;
}

/**
 * Voucher issuance and validation.
 *
 * Two beneficiaries, deliberately separate (FR-10.1):
 *   • the referred CUSTOMER receives `benefit` by presenting the code;
 *   • the AFFILIATE earns a reward when the redemption is verified.
 * One redemption can therefore produce exactly one conversion.
 */
@Injectable()
export class AffiliateRedemptionService {
  private readonly logger = new Logger(AffiliateRedemptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversions: AffiliateConversionService,
    private readonly rewards: AffiliateRewardService,
  ) {}

  // ── Issuance ───────────────────────────────────────────────────────────

  async issueVoucher(dto: IssueVoucherDto, opts?: { localAffiliateId?: string }) {
    const offer = await this.prisma.affiliateOffer.findUnique({
      where: { id: dto.offerId },
      select: { id: true, status: true, providerId: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    let trackingLinkCode: string | null = null;
    if (opts?.localAffiliateId) {
      const link = await this.prisma.affiliateTrackingLink.findFirst({
        where: { localAffiliateId: opts.localAffiliateId, offerId: offer.id },
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });
      trackingLinkCode = link?.code ?? null;
    }

    const voucher = await this.prisma.affiliateVoucher.create({
      data: {
        code: await this.allocateCode(),
        offerId: offer.id,
        localAffiliateId: opts?.localAffiliateId ?? null,
        trackingLinkCode,
        benefit: dto.benefit as Prisma.InputJsonValue,
        maxUses: dto.maxUses ?? 1,
        maxUsesPerCustomer: dto.maxUsesPerCustomer ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return { success: true, data: voucher };
  }

  async revokeVoucher(id: string, reason?: string) {
    const voucher = await this.prisma.affiliateVoucher.findUnique({
      where: { id },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');

    const updated = await this.prisma.affiliateVoucher.update({
      where: { id },
      data: {
        status: AffiliateVoucherStatus.REVOKED,
        revokedAt: new Date(),
        revokeReason: reason ?? 'Revoked by admin',
      },
    });
    return { success: true, data: updated };
  }

  private async allocateCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateVoucherCode();
      const clash = await this.prisma.affiliateVoucher.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    throw new Error('Could not allocate a unique voucher code');
  }

  // ── Validation ─────────────────────────────────────────────────────────

  /**
   * Validates and consumes one use of a voucher.
   *
   * Idempotent per (voucher, customer): a second presentation by the same
   * customer returns `ALREADY_REDEEMED` with the original timestamp instead of
   * throwing, so a double-tap at a POS is harmless.
   */
  async validate(dto: ValidateVoucherDto, actor: RedemptionActor) {
    const code = dto.code.trim().toUpperCase();

    const voucher = await this.prisma.affiliateVoucher.findUnique({
      where: { code },
      include: {
        offer: {
          select: {
            id: true,
            providerId: true,
            businessId: true,
            status: true,
            title: true,
          },
        },
      },
    });
    if (!voucher) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'VOUCHER_NOT_FOUND',
        errors: ['No voucher matches this code.'],
      });
    }

    if (
      voucher.offer?.businessId &&
      actor.businessId &&
      voucher.offer.businessId !== actor.businessId
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'NOT_YOUR_OFFER',
        errors: ['This voucher belongs to another business.'],
      });
    }

    if (voucher.status === AffiliateVoucherStatus.REVOKED) {
      throw new ConflictException({
        statusCode: 409,
        message: 'VOUCHER_REVOKED',
        errors: ['This voucher was cancelled.'],
      });
    }
    if (
      voucher.expiresAt &&
      voucher.expiresAt.getTime() < Date.now()
    ) {
      await this.prisma.affiliateVoucher
        .update({
          where: { id: voucher.id },
          data: { status: AffiliateVoucherStatus.EXPIRED },
        })
        .catch(() => undefined);
      throw new GoneException({
        statusCode: 410,
        message: 'VOUCHER_EXPIRED',
        errors: ['This voucher has expired.'],
      });
    }
    // Order matters: the per-customer replay lookup must run BEFORE the
    // overall usage guard, so a second presentation by the same customer is
    // idempotent even after the voucher is exhausted. A different customer
    // then correctly receives VOUCHER_USE_LIMIT_REACHED.
    const customerKey = dto.customerRef
      ? identityKey(dto.customerRef)
      : `anon:${(globalThis as any).crypto?.randomUUID?.() ?? Date.now()}`;

    const existing = await this.prisma.affiliateRedemption.findUnique({
      where: {
        voucherId_customerKey: { voucherId: voucher.id, customerKey },
      },
    });
    if (existing) {
      return {
        success: true,
        data: {
          status: 'ALREADY_REDEEMED',
          redemptionId: existing.id,
          voucherCode: voucher.code,
          validatedAt: existing.validatedAt,
          benefit: voucher.benefit,
          message: 'This voucher has already been used for this customer.',
        },
      };
    }

    // Per-customer limit for multi-use vouchers.
    if (voucher.maxUsesPerCustomer > 0) {
      const usedByCustomer = await this.prisma.affiliateRedemption.count({
        where: {
          voucherId: voucher.id,
          customerUserId: dto.customerRef ?? undefined,
        },
      });
      if (usedByCustomer >= voucher.maxUsesPerCustomer) {
        return {
          success: true,
          data: {
            status: 'ALREADY_REDEEMED',
            voucherCode: voucher.code,
            benefit: voucher.benefit,
            message: 'This customer has reached the per-customer limit.',
          },
        };
      }
    }

    if (voucher.usedCount >= voucher.maxUses) {
      throw new ConflictException({
        statusCode: 409,
        message: 'VOUCHER_USE_LIMIT_REACHED',
        errors: ['This voucher has reached its usage limit.'],
      });
    }

    const redemption = await this.prisma.$transaction(async (tx) => {
      // Serialise concurrent validations of the same voucher.
      await tx.$queryRawUnsafe(
        `SELECT id FROM affiliate_vouchers WHERE id = $1 FOR UPDATE`,
        voucher.id,
      );

      const fresh = await tx.affiliateVoucher.findUnique({
        where: { id: voucher.id },
      });
      if (!fresh || fresh.usedCount >= fresh.maxUses) {
        throw new ConflictException({
          statusCode: 409,
          message: 'VOUCHER_USE_LIMIT_REACHED',
          errors: ['This voucher has reached its usage limit.'],
        });
      }

      const created = await tx.affiliateRedemption.create({
        data: {
          voucherId: voucher.id,
          customerUserId: dto.customerRef ?? null,
          customerKey,
          status: AffiliateRedemptionStatus.VALIDATED,
          channel: actor.channel,
          validatedByUserId: actor.userId ?? null,
          validatedByBusinessId: actor.businessId ?? null,
          amountMinor: dto.amountMinor ?? null,
          posReference: dto.posReference ?? null,
          ipHash: hashIp(actor.ip),
        },
      });

      const newCount = fresh.usedCount + 1;
      await tx.affiliateVoucher.update({
        where: { id: voucher.id },
        data: {
          usedCount: newCount,
          status:
            newCount >= fresh.maxUses
              ? AffiliateVoucherStatus.REDEEMED
              : AffiliateVoucherStatus.PARTIALLY_REDEEMED,
        },
      });

      return created;
    });

    // The affiliate reward is driven by the redemption, not by the customer.
    //
    // The voucher's OWNER is authoritative. The stored tracking code is only a
    // pointer, and a stale or mismatched pointer must never credit a different
    // affiliate — so the code is re-resolved from (owner, offer) at validation
    // time. If the owner has no link for this offer there is nothing to
    // attribute, and no reward is created.
    if (voucher.localAffiliateId && voucher.offer) {
      const ownerLink = await this.prisma.affiliateTrackingLink.findFirst({
        where: {
          localAffiliateId: voucher.localAffiliateId,
          offerId: voucher.offer.id,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });

      if (!ownerLink) {
        this.logger.warn(
          `Voucher ${voucher.code} redeemed but the owning affiliate has no active link for offer ${voucher.offer.id}; no reward will be created.`,
        );
      }

      try {
        await this.conversions.createRedemptionConversion({
          providerId: voucher.offer.providerId,
          redemptionId: redemption.id,
          offerId: voucher.offer.id,
          trackingCode: ownerLink?.code ?? null,
          amountMinor: dto.amountMinor ?? null,
          customerUserId: dto.customerRef ?? null,
          occurredAt: redemption.validatedAt,
        });
      } catch (error) {
        this.logger.error(
          `Reward attribution failed for redemption ${redemption.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      success: true,
      data: {
        status: 'VALIDATED',
        redemptionId: redemption.id,
        voucherCode: voucher.code,
        validatedAt: redemption.validatedAt,
        benefit: voucher.benefit,
        remainingUses: Math.max(0, voucher.maxUses - (voucher.usedCount + 1)),
      },
    };
  }

  // ── Reversal ───────────────────────────────────────────────────────────

  /**
   * Reverses a redemption inside the allowed window. The voucher usage is
   * released and the affiliate reward is clawed back.
   */
  async reverse(redemptionId: string, actor: RedemptionActor, reason?: string) {
    const redemption = await this.prisma.affiliateRedemption.findUnique({
      where: { id: redemptionId },
      include: { voucher: { include: { offer: true } } },
    });
    if (!redemption) throw new NotFoundException('Redemption not found');
    if (redemption.status === AffiliateRedemptionStatus.REVERSED) {
      return { success: true, data: redemption };
    }

    if (
      redemption.voucher.offer?.businessId &&
      actor.businessId &&
      redemption.voucher.offer.businessId !== actor.businessId
    ) {
      throw new ForbiddenException('This redemption belongs to another business');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT id FROM affiliate_vouchers WHERE id = $1 FOR UPDATE`,
        redemption.voucherId,
      );

      const voucher = await tx.affiliateVoucher.findUnique({
        where: { id: redemption.voucherId },
      });

      await tx.affiliateVoucher.update({
        where: { id: redemption.voucherId },
        data: {
          usedCount: Math.max(0, (voucher?.usedCount ?? 1) - 1),
          status: AffiliateVoucherStatus.ISSUED,
        },
      });

      return tx.affiliateRedemption.update({
        where: { id: redemptionId },
        data: {
          status: AffiliateRedemptionStatus.REVERSED,
          reversedAt: new Date(),
          rejectionReason: reason ?? 'Reversed',
        },
      });
    });

    const conversion = await this.prisma.affiliateConversion.findFirst({
      where: {
        providerId: redemption.voucher.offer?.providerId ?? undefined,
        providerTransactionId: `redemption:${redemptionId}`,
      },
    });
    if (conversion) {
      try {
        await this.conversions.reverseConversion(
          conversion.id,
          actor.userId ?? 'system',
          'REFUNDED',
        );
      } catch (error) {
        this.logger.error(
          `Reward reversal failed for redemption ${redemptionId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { success: true, data: updated };
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async listVouchers(query: {
    page?: number;
    limit?: number;
    status?: string;
    offerId?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.AffiliateVoucherWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.offerId ? { offerId: query.offerId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.affiliateVoucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { offer: { select: { id: true, title: true, slug: true } } },
      }),
      this.prisma.affiliateVoucher.count({ where }),
    ]);
    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listRedemptions(query: {
    page?: number;
    limit?: number;
    status?: string;
    businessId?: string | null;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.AffiliateRedemptionWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.businessId
        ? { validatedByBusinessId: query.businessId }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.affiliateRedemption.findMany({
        where,
        orderBy: { validatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          voucher: {
            select: {
              code: true,
              benefit: true,
              offer: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.affiliateRedemption.count({ where }),
    ]);
    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** The affiliate's own reward redemptions (what they spent). */
  async listOwnRedemptions(
    localAffiliateId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const [items, total] = await Promise.all([
      this.prisma.affiliateRewardRedemption.findMany({
        where: { localAffiliateId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.affiliateRewardRedemption.count({
        where: { localAffiliateId },
      }),
    ]);
    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Affiliate-facing redemption of their own reward balance. */  async redeemReward(
    localAffiliateId: string,
    input: {
      rewardType: 'VOUCHER' | 'POINTS';
      units: number;
      offerId?: string;
    },
  ) {
    const offer = input.offerId
      ? await this.prisma.affiliateOffer.findUnique({
          where: { id: input.offerId },
          select: { id: true, status: true },
        })
      : await this.prisma.affiliateOffer.findFirst({
          where: { status: 'ACTIVE', redemptionMethod: 'PLATFORM_CODE' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true },
        });

    if (!offer) {
      throw new UnprocessableEntityException(
        'No redemption option is available right now.',
      );
    }

    const debit = await this.rewards.debit(localAffiliateId, 'POINTS', input.units, {
      description: `Reward redemption — ${input.units} points`,
      idempotencyKey: `redeem:${localAffiliateId}:${input.units}:${Date.now()}`,
      metadata: { offerId: offer.id },
    });

    const voucher = await this.issueVoucher(
      {
        offerId: offer.id,
        benefit: {
          type: 'POINTS_REDEMPTION',
          points: input.units,
          label: `${input.units} point reward voucher`,
        },
        maxUses: 1,
        maxUsesPerCustomer: 1,
      },
      { localAffiliateId },
    );

    const redemption = await this.prisma.affiliateRewardRedemption.create({
      data: {
        localAffiliateId,
        rewardType: input.rewardType === 'VOUCHER' ? 'VOUCHER' : 'POINTS',
        unit: 'POINTS',
        unitsSpent: new Prisma.Decimal(input.units),
        status: 'FULFILLED',
        voucherId: voucher.data.id,
        allocation: {
          ledgerId: debit.ledgerId,
          balanceAfter: debit.balanceAfter,
        },
        fulfilledAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        redemptionId: redemption.id,
        voucherCode: voucher.data.code,
        unitsSpent: input.units,
        balanceAfter: debit.balanceAfter,
        offerId: offer.id,
      },
    };
  }
}
