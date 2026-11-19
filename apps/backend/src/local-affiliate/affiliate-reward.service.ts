import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AffiliateConversion,
  AffiliateIntegrationLevel,
  AffiliateLedgerEntryType,
  AffiliateQualifyingEvent,
  AffiliateRewardCalculation,
  AffiliateRewardRule,
  AffiliateRewardStatus,
  AffiliateRewardUnit,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEBITING_ENTRY_TYPES,
  LEDGER_TRANSITIONS,
  VERIFIABLE_EVENTS,
  explain,
} from './local-affiliate.constants';
import {
  minorToMajor,
  roundUnits,
  toDecimal,
} from './local-affiliate.util';

export interface RewardBalances {
  unit: AffiliateRewardUnit;
  pending: number;
  approved: number;
  available: number;
  redeemed: number;
  expired: number;
  reversed: number;
  totalEarned: number;
}

export interface AppliedReward {
  ledgerId: string;
  units: number;
  unit: AffiliateRewardUnit;
  status: AffiliateRewardStatus;
  skipped: boolean;
  reasonCode?: string;
}

/**
 * Reward engine.
 *
 * Invariants enforced here (not in the UI, not in the provider adapters):
 *   • Units are never updated after insert — only status moves.
 *   • Reductions (spending, expiry, reversal) are separate DEBIT/EXPIRY/REVERSAL
 *     rows so a credit row never silently changes value.
 *   • Every write carries a unique idempotency key, so a replayed provider event
 *     cannot credit twice.
 *   • A qualifying event that the provider's integration level cannot verify is
 *     rejected — a LINK_ONLY provider can never promise a sale reward.
 */
@Injectable()
export class AffiliateRewardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Verifiability ──────────────────────────────────────────────────────

  canVerify(
    level: AffiliateIntegrationLevel,
    event: AffiliateQualifyingEvent,
  ): boolean {
    return (VERIFIABLE_EVENTS[level] ?? []).includes(event);
  }

  assertVerifiable(
    level: AffiliateIntegrationLevel,
    event: AffiliateQualifyingEvent,
  ): void {
    if (!this.canVerify(level, event)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'REWARD_EVENT_NOT_VERIFIABLE',
        errors: [
          `A ${level} provider cannot verify ${event}. ` +
            `Rewards may only be offered on events the integration can confirm.`,
        ],
      });
    }
  }

  // ── Calculation ────────────────────────────────────────────────────────

  /**
   * Pure calculation — no I/O. Kept separate so it can be unit-tested and so
   * the admin rule editor can preview a result without writing anything.
   */
  calculate(
    rule: Pick<
      AffiliateRewardRule,
      | 'calculation'
      | 'unit'
      | 'fixedUnits'
      | 'percentage'
      | 'pointsPerCurrencyUnit'
      | 'tiers'
      | 'maxRewardUnits'
    >,
    amountMinor: number | null | undefined,
  ): { units: Prisma.Decimal; meta: Record<string, unknown> } {
    const amount = minorToMajor(amountMinor);
    let units = new Prisma.Decimal(0);
    const meta: Record<string, unknown> = {
      calculation: rule.calculation,
      amountMinor: amountMinor ?? 0,
    };

    if (rule.calculation === AffiliateRewardCalculation.FIXED) {
      units = toDecimal(rule.fixedUnits);
    } else if (rule.calculation === AffiliateRewardCalculation.PERCENTAGE) {
      const pct = toDecimal(rule.percentage).dividedBy(100);
      if (rule.unit === AffiliateRewardUnit.CREDIT) {
        units = amount.times(pct);
      } else {
        const rate = toDecimal(rule.pointsPerCurrencyUnit);
        units = amount.times(rate).times(pct);
      }
    } else if (rule.calculation === AffiliateRewardCalculation.TIERED) {
      const tiers = Array.isArray(rule.tiers) ? (rule.tiers as any[]) : [];
      const minor = amountMinor ?? 0;
      const tier = tiers.find(
        (t) =>
          minor >= Number(t?.minMinor ?? 0) &&
          (t?.maxMinor === null ||
            t?.maxMinor === undefined ||
            minor < Number(t.maxMinor)),
      );
      if (tier) {
        meta.tier = tier;
        if (tier.fixedUnits !== undefined && tier.fixedUnits !== null) {
          units = toDecimal(tier.fixedUnits);
        } else if (tier.percentage !== undefined && tier.percentage !== null) {
          const pct = toDecimal(tier.percentage).dividedBy(100);
          units =
            rule.unit === AffiliateRewardUnit.CREDIT
              ? amount.times(pct)
              : amount.times(toDecimal(tier.pointsPerCurrencyUnit)).times(pct);
        }
      }
    }

    units = roundUnits(units, rule.unit);

    const max = rule.maxRewardUnits;
    if (max !== null && max !== undefined && units.greaterThan(toDecimal(max))) {
      units = toDecimal(max);
      meta.capped = true;
    }

    return { units, meta };
  }

  // ── Apply a rule to a conversion ───────────────────────────────────────

  /**
   * Creates the PENDING ledger row for an attributed conversion.
   * Returns `skipped: true` with a reason when no reward is due — the row is
   * still retained so Admin can see that the event happened.
   */
  async applyToConversion(
    conversionId: string,
    ruleOverride?: AffiliateRewardRule | null,
  ): Promise<AppliedReward | null> {
    const conversion = await this.prisma.affiliateConversion.findUnique({
      where: { id: conversionId },
    });
    if (!conversion) {
      throw new NotFoundException('Conversion not found');
    }
    if (!conversion.localAffiliateId) {
      // Not attributed yet — nothing to reward. The matcher will retry.
      return null;
    }

    const offer = conversion.offerId
      ? await this.prisma.affiliateOffer.findUnique({
          where: { id: conversion.offerId },
        })
      : null;

    const rule =
      ruleOverride ??
      (offer?.rewardRuleId
        ? await this.prisma.affiliateRewardRule.findUnique({
            where: { id: offer.rewardRuleId },
          })
        : null);

    if (!rule) {
      // The offer promises no affiliate reward (e.g. a LINK_ONLY traffic offer).
      return null;
    }

    // The reward event must match the rule, and the provider must be able to
    // verify it. Both checks are repeated here even though offer activation
    // also validates them — defence in depth.
    if (rule.qualifyingEvent !== conversion.eventType) {
      return this.writeSkipped(
        conversion,
        rule,
        'NOT_ELIGIBLE',
        `Event ${conversion.eventType} does not match the rule event ${rule.qualifyingEvent}`,
      );
    }

    if (offer) {
      this.assertVerifiable(offer.integrationLevel, rule.qualifyingEvent);
    }

    if (
      rule.minPurchaseMinor !== null &&
      rule.minPurchaseMinor !== undefined &&
      (conversion.amountMinor ?? 0) < rule.minPurchaseMinor
    ) {
      return this.writeSkipped(
        conversion,
        rule,
        'BELOW_MIN_PURCHASE',
        `Purchase ${conversion.amountMinor ?? 0} below minimum ${rule.minPurchaseMinor}`,
      );
    }

    const { units, meta } = this.calculate(rule, conversion.amountMinor);

    if (units.lessThanOrEqualTo(0)) {
      return this.writeSkipped(
        conversion,
        rule,
        'NOT_ELIGIBLE',
        'Calculated reward was zero',
      );
    }

    if (rule.unit === AffiliateRewardUnit.CREDIT && rule.rewardType === 'CREDIT') {
      // Cashback is modelled but disabled in Phase 1: no settlement exists yet.
      return this.writeSkipped(
        conversion,
        rule,
        'NOT_ELIGIBLE',
        'Cashback materialisation is not enabled in this release',
      );
    }

    const idempotencyKey = `conversion:${conversion.id}:${rule.version}`;
    const existing = await this.prisma.affiliateRewardLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ledgerId: existing.id,
        units: Number(existing.units),
        unit: existing.unit,
        status: existing.status,
        skipped: existing.entryType !== AffiliateLedgerEntryType.CREDIT,
        reasonCode: existing.explanationCode ?? undefined,
      };
    }

    // Affiliate-level cap.
    const capped = await this.capUnits(
      conversion.localAffiliateId,
      rule,
      units,
    );
    if (capped.lessThanOrEqualTo(0)) {
      return this.writeSkipped(
        conversion,
        rule,
        'CAP_REACHED',
        'The affiliate reward cap for this rule has been reached',
      );
    }

    const finalUnits = capped;

    // A validated redemption IS the verification: when the rule's approval
    // basis is REDEMPTION_VALIDATION and the event is a verified redemption,
    // there is nothing left to confirm, so the reward skips the wait.
    const autoApprove =
      rule.approvalMode === 'AUTOMATIC' ||
      (rule.approvalMode === 'REDEMPTION_VALIDATION' &&
        conversion.eventType === AffiliateQualifyingEvent.VERIFIED_REDEMPTION);

    const status = autoApprove
      ? AffiliateRewardStatus.APPROVED
      : AffiliateRewardStatus.PENDING;

    const explanationCode = autoApprove
      ? null
      : rule.approvalMode === 'REDEMPTION_VALIDATION'
        ? 'AWAITING_REDEMPTION'
        : rule.approvalMode === 'PROVIDER_CONFIRMATION'
          ? 'AWAITING_PROVIDER_CONFIRMATION'
          : 'AWAITING_ADMIN_CONFIRMATION';

    const entry = await this.prisma.$transaction(async (tx) => {
      if (conversion.campaignId && finalUnits.greaterThan(0)) {
        const campaign = await tx.affiliateCampaign.findUnique({
          where: { id: conversion.campaignId },
        });
        if (campaign?.rewardCapUnits) {
          const updated = await tx.affiliateCampaign.updateMany({
            where: {
              id: conversion.campaignId,
              OR: [
                { rewardCapUnits: null },
                {
                  budgetUnitsIssued: {
                    lte: toDecimal(campaign.rewardCapUnits).minus(finalUnits),
                  },
                },
              ],
            },
            data: { budgetUnitsIssued: { increment: finalUnits } },
          });
          if (updated.count === 0) {
            // Cap reached mid-transaction: record the attempt, pause the
            // campaign, and do not grant the reward.
            await tx.affiliateCampaign.update({
              where: { id: conversion.campaignId },
              data: { status: 'PAUSED' },
            });
            return { cappedOut: true as const };
          }
        }
      }

      const created = await tx.affiliateRewardLedger.create({
        data: {
          localAffiliateId: conversion.localAffiliateId!,
          conversionId: conversion.id,
          rewardRuleId: rule.id,
          rewardRuleVersion: rule.version,
          campaignId: conversion.campaignId ?? null,
          offerId: conversion.offerId ?? null,
          entryType: AffiliateLedgerEntryType.CREDIT,
          unit: rule.unit,
          units: finalUnits,
          status,
          idempotencyKey,
          description: this.describeCredit(rule, finalUnits, conversion),
          explanationCode,
          explanationText: explain(explanationCode),
          metadata: {
            ...meta,
            rewardType: rule.rewardType,
            conversionEvent: conversion.eventType,
          },
          approvedAt:
            status === AffiliateRewardStatus.APPROVED ? new Date() : null,
        },
      });

      await tx.affiliateLedgerEvent.create({
        data: {
          ledgerId: created.id,
          fromStatus: null,
          toStatus: status,
          actorType: 'SYSTEM',
          reason: 'Reward evaluated from conversion',
        },
      });

      return { cappedOut: false as const, created };
    });

    if (!('created' in entry) || !entry.created) {
      return this.writeSkipped(
        conversion,
        rule,
        'CAP_REACHED',
        'The campaign reward budget has been reached',
      );
    }

    // Rules that are already verified skip the approval wait entirely.
    if (status === AffiliateRewardStatus.APPROVED) {
      await this.transition(entry.created.id, AffiliateRewardStatus.AVAILABLE, {
        actorType: 'SYSTEM',
        reason: 'Approval mode AUTOMATIC',
      });
    }

    await this.prisma.localAffiliateProfile
      .update({
        where: { id: conversion.localAffiliateId },
        data: { firstRewardAt: new Date() },
      })
      .catch(() => undefined);

    return {
      ledgerId: entry.created.id,
      units: Number(entry.created.units),
      unit: entry.created.unit,
      status,
      skipped: false,
    };
  }

  private describeCredit(
    rule: AffiliateRewardRule,
    units: Prisma.Decimal,
    conversion: AffiliateConversion,
  ): string {
    const unitLabel = rule.unit === AffiliateRewardUnit.POINTS ? 'points' : 'credits';
    return `Reward: ${Number(units)} ${unitLabel} for ${conversion.eventType
      .replaceAll('_', ' ')
      .toLowerCase()}`;
  }

  private async writeSkipped(
    conversion: AffiliateConversion,
    rule: AffiliateRewardRule,
    reasonCode: string,
    detail: string,
  ): Promise<AppliedReward> {
    const idempotencyKey = `skipped:${conversion.id}:${rule.version}:${reasonCode}`;
    const existing = await this.prisma.affiliateRewardLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ledgerId: existing.id,
        units: Number(existing.units),
        unit: existing.unit,
        status: existing.status,
        skipped: true,
        reasonCode,
      };
    }

    const row = await this.prisma.affiliateRewardLedger.create({
      data: {
        localAffiliateId: conversion.localAffiliateId!,
        conversionId: conversion.id,
        rewardRuleId: rule.id,
        rewardRuleVersion: rule.version,
        campaignId: conversion.campaignId ?? null,
        offerId: conversion.offerId ?? null,
        entryType: AffiliateLedgerEntryType.CREDIT,
        unit: rule.unit,
        units: new Prisma.Decimal(0),
        status: AffiliateRewardStatus.REJECTED,
        idempotencyKey,
        description: 'No reward: ' + detail,
        explanationCode: reasonCode,
        explanationText: explain(reasonCode),
        metadata: { detail },
      },
    });

    await this.prisma.affiliateLedgerEvent.create({
      data: {
        ledgerId: row.id,
        fromStatus: null,
        toStatus: AffiliateRewardStatus.REJECTED,
        actorType: 'SYSTEM',
        reason: detail,
      },
    });

    return {
      ledgerId: row.id,
      units: 0,
      unit: row.unit,
      status: row.status,
      skipped: true,
      reasonCode,
    };
  }

  /** Applies the per-affiliate cap to a proposed reward. */
  private async capUnits(
    localAffiliateId: string,
    rule: AffiliateRewardRule,
    proposed: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    if (
      rule.capPerAffiliateUnits === null ||
      rule.capPerAffiliateUnits === undefined
    ) {
      return proposed;
    }
    const granted = await this.prisma.affiliateRewardLedger.aggregate({
      where: {
        localAffiliateId,
        rewardRuleId: rule.id,
        entryType: AffiliateLedgerEntryType.CREDIT,
        status: {
          notIn: [AffiliateRewardStatus.REJECTED, AffiliateRewardStatus.CANCELLED],
        },
      },
      _sum: { units: true },
    });
    const remaining = toDecimal(rule.capPerAffiliateUnits).minus(
      toDecimal(granted._sum.units),
    );
    if (remaining.lessThanOrEqualTo(0)) return new Prisma.Decimal(0);
    return proposed.lessThan(remaining) ? proposed : remaining;
  }

  // ── State transitions ──────────────────────────────────────────────────

  async transition(
    ledgerId: string,
    to: AffiliateRewardStatus,
    opts: {
      actorType?: 'SYSTEM' | 'ADMIN' | 'PROVIDER';
      actorUserId?: string | null;
      reason?: string;
    } = {},
  ) {
    const row = await this.prisma.affiliateRewardLedger.findUnique({
      where: { id: ledgerId },
    });
    if (!row) throw new NotFoundException('Reward not found');

    const allowed = LEDGER_TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(to)) {
      throw new UnprocessableEntityException(
        `Cannot move reward from ${row.status} to ${to}`,
      );
    }

    const data: Prisma.AffiliateRewardLedgerUpdateInput = {
      status: to,
      events: {
        create: {
          fromStatus: row.status,
          toStatus: to,
          actorType: opts.actorType ?? 'SYSTEM',
          actorUserId: opts.actorUserId ?? null,
          reason: opts.reason ?? null,
        },
      },
    };

    if (to === AffiliateRewardStatus.APPROVED) {
      data.approvedAt = new Date();
    }
    if (to === AffiliateRewardStatus.AVAILABLE) {
      data.availableAt = new Date();
      // The pending explanation must not survive approval: the dashboard would
      // otherwise tell the affiliate to wait for something that already happened.
      data.explanationCode = 'APPROVED';
      data.explanationText = explain('APPROVED');
      if (row.rewardRuleId) {
        const rule = await this.prisma.affiliateRewardRule.findUnique({
          where: { id: row.rewardRuleId },
        });
        if (rule?.expiryDays) {
          data.expiresAt = new Date(
            Date.now() + rule.expiryDays * 24 * 60 * 60 * 1000,
          );
        }
      }
    }
    if (
      to === AffiliateRewardStatus.REJECTED ||
      to === AffiliateRewardStatus.CANCELLED ||
      to === AffiliateRewardStatus.REVERSED ||
      to === AffiliateRewardStatus.EXPIRED
    ) {
      data.closedAt = new Date();
    }

    return this.prisma.affiliateRewardLedger.update({
      where: { id: ledgerId },
      data,
    });
  }

  /** PENDING → APPROVED → AVAILABLE in one call. */
  async approve(
    ledgerId: string,
    actorUserId?: string | null,
    reason = 'Approved',
  ) {
    let row = await this.prisma.affiliateRewardLedger.findUnique({
      where: { id: ledgerId },
    });
    if (!row) throw new NotFoundException('Reward not found');

    if (row.status === AffiliateRewardStatus.PENDING) {
      row = await this.transition(ledgerId, AffiliateRewardStatus.APPROVED, {
        actorType: actorUserId ? 'ADMIN' : 'SYSTEM',
        actorUserId: actorUserId ?? null,
        reason,
      });
    }
    if (row.status === AffiliateRewardStatus.APPROVED) {
      row = await this.transition(ledgerId, AffiliateRewardStatus.AVAILABLE, {
        actorType: actorUserId ? 'ADMIN' : 'SYSTEM',
        actorUserId: actorUserId ?? null,
        reason,
      });
    }
    return row;
  }

  async reject(
    ledgerId: string,
    reasonCode: string,
    actorUserId?: string | null,
    detail?: string,
  ) {
    const row = await this.prisma.affiliateRewardLedger.findUnique({
      where: { id: ledgerId },
    });
    if (!row) throw new NotFoundException('Reward not found');

    const updated = await this.transition(
      ledgerId,
      AffiliateRewardStatus.REJECTED,
      {
        actorType: 'ADMIN',
        actorUserId: actorUserId ?? null,
        reason: detail ?? reasonCode,
      },
    );

    return this.prisma.affiliateRewardLedger.update({
      where: { id: updated.id },
      data: {
        explanationCode: reasonCode,
        explanationText: explain(reasonCode) ?? detail ?? null,
      },
    });
  }

  // ── Reversal ───────────────────────────────────────────────────────────

  /**
   * Reverses the rewards earned by a conversion (refund / cancellation).
   *
   * Credits that never became available are simply closed. Credits already
   * available produce a REVERSAL row for the un-offset remainder — the credit
   * row itself is never edited. If the affiliate already spent the reward the
   * balance may go negative; that is surfaced rather than hidden.
   */
  async reverseConversion(
    conversionId: string,
    reasonCode = 'REFUNDED',
    actorUserId?: string | null,
  ): Promise<{ reversedUnits: number; negativeBalance: boolean }> {
    const credits = await this.prisma.affiliateRewardLedger.findMany({
      where: {
        conversionId,
        entryType: AffiliateLedgerEntryType.CREDIT,
        status: {
          in: [
            AffiliateRewardStatus.PENDING,
            AffiliateRewardStatus.APPROVED,
            AffiliateRewardStatus.AVAILABLE,
          ],
        },
      },
    });

    if (credits.length === 0) {
      return { reversedUnits: 0, negativeBalance: false };
    }

    let reversedTotal = new Prisma.Decimal(0);

    for (const credit of credits) {
      if (
        credit.status === AffiliateRewardStatus.PENDING ||
        credit.status === AffiliateRewardStatus.APPROVED
      ) {
        await this.transition(credit.id, AffiliateRewardStatus.REVERSED, {
          actorType: actorUserId ? 'ADMIN' : 'SYSTEM',
          actorUserId: actorUserId ?? null,
          reason: explain(reasonCode) ?? reasonCode,
        });
        reversedTotal = reversedTotal.plus(toDecimal(credit.units));
        continue;
      }

      // AVAILABLE: offset with a REVERSAL row.
      const already = await this.prisma.affiliateRewardLedger.aggregate({
        where: {
          conversionId,
          entryType: AffiliateLedgerEntryType.REVERSAL,
        },
        _sum: { units: true },
      });
      const offset = toDecimal(already._sum.units);
      const remaining = toDecimal(credit.units).minus(offset);
      if (remaining.lessThanOrEqualTo(0)) continue;

      const idempotencyKey = `reversal:${conversionId}:${remaining.toString()}`;
      const existing = await this.prisma.affiliateRewardLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) continue;

      await this.prisma.affiliateRewardLedger.create({
        data: {
          localAffiliateId: credit.localAffiliateId,
          conversionId,
          rewardRuleId: credit.rewardRuleId,
          rewardRuleVersion: credit.rewardRuleVersion,
          campaignId: credit.campaignId,
          offerId: credit.offerId,
          entryType: AffiliateLedgerEntryType.REVERSAL,
          unit: credit.unit,
          units: remaining,
          status: AffiliateRewardStatus.REVERSED,
          idempotencyKey,
          description: `Reversal: ${explain(reasonCode) ?? reasonCode}`,
          explanationCode: reasonCode,
          explanationText: explain(reasonCode),
          reversesLedgerId: credit.id,
          closedAt: new Date(),
        },
      });
      reversedTotal = reversedTotal.plus(remaining);
    }

    const balances = await this.getBalances(credits[0].localAffiliateId);
    return {
      reversedUnits: Number(reversedTotal),
      negativeBalance: balances.available < 0,
    };
  }

  // ── Expiry sweep ───────────────────────────────────────────────────────

  /**
   * Expires available rewards past `expiresAt`. Recorded as an EXPIRY row so
   * the credit row keeps its original units.
   */
  async expireDue(now = new Date()): Promise<number> {
    const due = await this.prisma.affiliateRewardLedger.findMany({
      where: {
        entryType: AffiliateLedgerEntryType.CREDIT,
        status: AffiliateRewardStatus.AVAILABLE,
        expiresAt: { lte: now },
      },
      take: 500,
    });

    let count = 0;
    for (const credit of due) {
      const spent = await this.prisma.affiliateRewardLedger.aggregate({
        where: {
          AND: [
            { localAffiliateId: credit.localAffiliateId },
            {
              entryType: {
                in: [
                  AffiliateLedgerEntryType.DEBIT,
                  AffiliateLedgerEntryType.EXPIRY,
                  AffiliateLedgerEntryType.REVERSAL,
                ],
              },
            },
            { createdAt: { gte: credit.availableAt ?? credit.createdAt } },
          ],
        },
        _sum: { units: true },
      });

      const idempotencyKey = `expiry:${credit.id}`;
      const existing = await this.prisma.affiliateRewardLedger.findUnique({
        where: { idempotencyKey },
      });
      if (existing) continue;

      await this.prisma.affiliateRewardLedger.create({
        data: {
          localAffiliateId: credit.localAffiliateId,
          conversionId: credit.conversionId,
          rewardRuleId: credit.rewardRuleId,
          rewardRuleVersion: credit.rewardRuleVersion,
          campaignId: credit.campaignId,
          offerId: credit.offerId,
          entryType: AffiliateLedgerEntryType.EXPIRY,
          unit: credit.unit,
          units: toDecimal(credit.units),
          status: AffiliateRewardStatus.EXPIRED,
          idempotencyKey,
          description: 'Reward expired',
          explanationCode: 'EXPIRED',
          explanationText: explain('EXPIRED'),
          reversesLedgerId: credit.id,
          closedAt: now,
        },
      });

      await this.transition(credit.id, AffiliateRewardStatus.EXPIRED, {
        actorType: 'SYSTEM',
        reason: 'Expiry sweep',
      });
      count += 1;
      void spent;
    }

    return count;
  }

  // ── Balances ───────────────────────────────────────────────────────────

  /**
   * Derived balances. Nothing is stored as a running total.
   *
   * available = sum(CREDIT where status=AVAILABLE)
   *           − sum(DEBIT | EXPIRY | REVERSAL)
   */
  async getBalances(
    localAffiliateId: string,
    unit: AffiliateRewardUnit = AffiliateRewardUnit.POINTS,
  ): Promise<RewardBalances> {
    const [credits, offsets] = await Promise.all([
      this.prisma.affiliateRewardLedger.groupBy({
        by: ['status'],
        where: {
          localAffiliateId,
          unit,
          entryType: AffiliateLedgerEntryType.CREDIT,
        },
        _sum: { units: true },
      }),
      this.prisma.affiliateRewardLedger.groupBy({
        by: ['entryType'],
        where: {
          localAffiliateId,
          unit,
          entryType: { in: DEBITING_ENTRY_TYPES },
        },
        _sum: { units: true },
      }),
    ]);

    const byStatus = (status: AffiliateRewardStatus) =>
      Number(
        credits.find((c) => c.status === status)?._sum.units ?? 0,
      );
    const byEntry = (entry: AffiliateLedgerEntryType) =>
      Number(
        offsets.find((o) => o.entryType === entry)?._sum.units ?? 0,
      );

    const availableCredits = byStatus(AffiliateRewardStatus.AVAILABLE);
    const totalOffsets = offsets.reduce(
      (sum, o) => sum + Number(o._sum.units ?? 0),
      0,
    );

    return {
      unit,
      pending: byStatus(AffiliateRewardStatus.PENDING),
      approved: byStatus(AffiliateRewardStatus.APPROVED),
      available: Number((availableCredits - totalOffsets).toFixed(2)),
      redeemed: byEntry(AffiliateLedgerEntryType.DEBIT),
      expired: byEntry(AffiliateLedgerEntryType.EXPIRY),
      reversed: byEntry(AffiliateLedgerEntryType.REVERSAL),
      totalEarned:
        byStatus(AffiliateRewardStatus.PENDING) +
        byStatus(AffiliateRewardStatus.APPROVED) +
        availableCredits,
    };
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  /** Affiliate-facing ledger listing (append-only history). */
  async listLedger(
    localAffiliateId: string,
    query: { status?: string; unit?: string; page?: number; limit?: number } = {},
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.AffiliateRewardLedgerWhereInput = {
      localAffiliateId,
      ...(query.status ? { status: query.status as AffiliateRewardStatus } : {}),
      ...(query.unit ? { unit: query.unit as AffiliateRewardUnit } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.affiliateRewardLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.affiliateRewardLedger.count({ where }),
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

  // ── Spending ───────────────────────────────────────────────────────────
  /**
   * Debits the affiliate's spendable balance. Runs under a row lock on the
   * profile so concurrent redemptions cannot double-spend.
   */
  async debit(
    localAffiliateId: string,
    unit: AffiliateRewardUnit,
    units: number,
    opts: {
      description: string;
      idempotencyKey: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ ledgerId: string; balanceAfter: number }> {
    if (units <= 0) {
      throw new BadRequestException('Redemption amount must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT id FROM local_affiliate_profiles WHERE id = $1 FOR UPDATE`,
        localAffiliateId,
      );

      const existing = await tx.affiliateRewardLedger.findUnique({
        where: { idempotencyKey: opts.idempotencyKey },
      });
      if (existing) {
        const balances = await this.getBalances(localAffiliateId, unit);
        return { ledgerId: existing.id, balanceAfter: balances.available };
      }

      const balances = await this.getBalances(localAffiliateId, unit);
      if (balances.available < units) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          message: 'INSUFFICIENT_REWARD_BALANCE',
          errors: [
            `Available balance is ${balances.available}; ${units} requested.`,
          ],
        });
      }

      const row = await tx.affiliateRewardLedger.create({
        data: {
          localAffiliateId,
          entryType: AffiliateLedgerEntryType.DEBIT,
          unit,
          units: toDecimal(units),
          status: AffiliateRewardStatus.REDEEMED,
          idempotencyKey: opts.idempotencyKey,
          description: opts.description,
          metadata: (opts.metadata ?? {}) as Prisma.InputJsonValue,
          closedAt: new Date(),
        },
      });

      await tx.affiliateLedgerEvent.create({
        data: {
          ledgerId: row.id,
          fromStatus: null,
          toStatus: AffiliateRewardStatus.REDEEMED,
          actorType: 'SYSTEM',
          reason: opts.description,
        },
      });

      return {
        ledgerId: row.id,
        balanceAfter: Number((balances.available - units).toFixed(2)),
      };
    });
  }
}
