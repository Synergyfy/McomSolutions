import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AffiliateRewardService } from './affiliate-reward.service';
import { AffiliateConversionService } from './affiliate-conversion.service';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateVoucherStatus } from '@prisma/client';

/**
 * Background maintenance for the affiliate programme.
 *
 * Deliberately narrow: expiry sweeps and unmatched-conversion ageing. Provider
 * pull-reconciliation (Awin) is added in Phase 4 behind its own flag.
 */
@Injectable()
export class LocalAffiliateJobs {
  private readonly logger = new Logger(LocalAffiliateJobs.name);

  constructor(
    private readonly rewards: AffiliateRewardService,
    private readonly conversions: AffiliateConversionService,
    private readonly prisma: PrismaService,
  ) {}

  /** Expires available rewards past their expiry date. */
  @Cron(CronExpression.EVERY_HOUR)
  async expireRewards(): Promise<void> {
    try {
      const count = await this.rewards.expireDue();
      if (count > 0) {
        this.logger.log(`Expired ${count} affiliate reward(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Reward expiry sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Marks expired vouchers so the business-facing list stays accurate. */
  @Cron(CronExpression.EVERY_HOUR)
  async expireVouchers(): Promise<void> {
    try {
      const result = await this.prisma.affiliateVoucher.updateMany({
        where: {
          status: { in: [AffiliateVoucherStatus.ISSUED, AffiliateVoucherStatus.PARTIALLY_REDEEMED] },
          expiresAt: { lte: new Date() },
        },
        data: { status: AffiliateVoucherStatus.EXPIRED },
      });
      if (result.count > 0) {
        this.logger.log(`Expired ${result.count} voucher(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Voucher expiry sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Ages out conversions that were never attributed. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expireUnmatched(): Promise<void> {
    try {
      const count = await this.conversions.expireStaleUnmatched();
      if (count > 0) {
        this.logger.log(`Expired ${count} unmatched conversion(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Unmatched conversion sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
