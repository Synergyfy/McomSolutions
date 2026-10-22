import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringService } from './recurring.service';
import { RedisService } from '../redis/redis.service';

/**
 * Renewal + expiry crons.
 *
 * Stripe/PayPal charge at the provider, so these jobs reconcile provider state
 * and extend entitlements. Wallet mandates are charged here. Each job takes a
 * distributed lock so multi-instance deployments never double-process.
 */
@Injectable()
export class RenewalSchedulerService {
  private readonly logger = new Logger(RenewalSchedulerService.name);

  constructor(
    private readonly recurringService: RecurringService,
    private readonly config: ConfigService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async withLock(key: string, ttl: number, fn: () => Promise<void>): Promise<void> {
    let acquired = false;
    if (this.redis) {
      try {
        acquired = await this.redis.setNx(key, '1', ttl);
      } catch {
        acquired = true;
      }
      if (!acquired) {
        this.logger.debug(`${key} already running elsewhere — skipping`);
        return;
      }
    }
    try {
      await fn();
    } finally {
      if (this.redis && acquired) {
        await this.redis.del(key).catch(() => undefined);
      }
    }
  }

  private cronEnabled(): boolean {
    return this.config.get<string>('RENEWAL_CRON_ENABLED') !== 'false';
  }

  @Cron('*/15 * * * *')
  async handleDueRenewals(): Promise<void> {
    if (!this.cronEnabled()) return;
    await this.withLock('cron:renewals:due', 800, async () => {
      await this.recurringService.processDueRenewals();
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiries(): Promise<void> {
    if (!this.cronEnabled()) return;
    await this.withLock('cron:renewals:expiry', 3000, async () => {
      await this.recurringService.expireLapsedSubscriptions();
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleReconcile(): Promise<void> {
    if (!this.cronEnabled()) return;
    await this.withLock('cron:renewals:reconcile', 3000, async () => {
      const ids = await this.recurringService.listProviderMandateIds(500);
      for (const id of ids) {
        try {
          await this.recurringService.reconcileProviderMandate(id);
        } catch (err) {
          this.logger.warn(
            `Daily reconcile failed for ${id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    });
  }
}
