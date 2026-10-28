import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppPaymentOutbox } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { AppPaymentsService } from './app-payments.service';

/**
 * Durable side-effect reconciler for MCOM Pay.
 *
 * Two jobs:
 *  1. Drain `app_payment_outbox` — partner webhooks, refund settlement replays.
 *  2. Re-check charges flagged `reconciliationNeeded` against the provider.
 *
 * Every claim is a compare-and-set on the row, so running this on several
 * instances (or overlapping runs) can never execute the same side effect twice.
 */
@Injectable()
export class AppPaymentsReconciliationService {
  private readonly logger = new Logger(AppPaymentsReconciliationService.name);
  private readonly batchSize = 25;
  private readonly maxAttempts = 8;
  private readonly maxReconcileAttempts = 20;
  private readonly baseBackoffMs = 60_000; // 1 min, doubled per attempt

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payments: AppPaymentsService,
    private readonly dispatcher: WebhookDispatcherService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleOutbox(): Promise<void> {
    if (!this.enabled()) return;
    await this.withLock('cron:app-payments:outbox', 240, () => this.drainOutbox());
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleReconciliationFlags(): Promise<void> {
    if (!this.enabled()) return;
    await this.withLock('cron:app-payments:reconcile', 600, () => this.reconcileFlaggedCharges());
  }

  /**
   * Process every due outbox row once.
   *
   * A row is claimed by moving it `PENDING → PROCESSING` with the exact attempt
   * count we read; a racing worker's claim fails and it skips. Each kind's
   * handler is itself idempotent, so a crash after the side effect but before
   * `DONE` only costs one redundant (harmless) retry.
   */
  async drainOutbox(): Promise<{ processed: number; failed: number }> {
    const due = await this.prisma.appPaymentOutbox.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: this.batchSize,
    });

    let processed = 0;
    let failed = 0;

    for (const row of due) {
      const claimed = await this.prisma.appPaymentOutbox.updateMany({
        where: { id: row.id, status: 'PENDING', attempts: row.attempts },
        data: { status: 'PROCESSING' },
      });
      if (claimed.count !== 1) continue;

      try {
        await this.execute(row);
        await this.prisma.appPaymentOutbox.update({
          where: { id: row.id },
          data: { status: 'DONE', lastError: null },
        });
        processed += 1;
      } catch (err) {
        failed += 1;
        await this.scheduleRetry(row, err);
      }
    }

    if (processed || failed) {
      this.logger.log(`Outbox sweep: ${processed} done, ${failed} retried.`);
    }
    return { processed, failed };
  }

  /**
   * Re-drive charges stuck with `reconciliationNeeded` (provider success, local
   * write failure). Successful ones clear the flag; repeated failures back off.
   */
  async reconcileFlaggedCharges(): Promise<number> {
    const stale = new Date(Date.now() - 5 * 60_000);
    const charges = await this.prisma.appCharge.findMany({
      where: {
        reconciliationNeeded: true,
        updatedAt: { lte: stale },
        // Bounded: a charge that cannot be reconciled automatically must surface
        // as an alert, not an infinite retry loop.
        settlementAttempts: { lt: this.maxReconcileAttempts },
      },
      orderBy: { updatedAt: 'asc' },
      take: this.batchSize,
    });

    let reconciled = 0;
    for (const charge of charges) {
      try {
        await this.payments.reconcileCharge(charge.id);
        const current = await this.prisma.appCharge.findUnique({ where: { id: charge.id } });
        if (current && !current.reconciliationNeeded) reconciled += 1;
      } catch (err: any) {
        const attempts = (charge.settlementAttempts ?? 0) + 1;
        await this.prisma.appCharge
          .update({
            where: { id: charge.id },
            data: { settlementAttempts: { increment: 1 } },
          })
          .catch(() => undefined);

        const message = err?.message ?? String(err);
        if (attempts >= this.maxReconcileAttempts) {
          this.logger.error(
            `Charge ${charge.id} still needs reconciliation after ${attempts} attempts — manual intervention required: ${message}`,
          );
        } else {
          this.logger.warn(`Reconciliation of charge ${charge.id} still pending: ${message}`);
        }
      }
    }
    return reconciled;
  }

  private async execute(row: AppPaymentOutbox): Promise<void> {
    switch (row.kind) {
      case 'partner_webhook':
        await this.deliverPartnerWebhook(row);
        return;
      case 'refund_provider':
        if (!row.refundId) throw new Error(`Outbox row ${row.id} has no refundId.`);
        await this.payments.reconcileParkedRefund(row.refundId);
        return;
      case 'settle_charge':
        if (!row.chargeId) throw new Error(`Outbox row ${row.id} has no chargeId.`);
        await this.payments.reconcileCharge(row.chargeId);
        return;
      default:
        throw new Error(`Unknown outbox kind "${row.kind}"`);
    }
  }

  private async deliverPartnerWebhook(row: AppPaymentOutbox): Promise<void> {
    if (!row.event) throw new Error(`Outbox row ${row.id} has no event.`);

    const result = await this.dispatcher.dispatch(
      row.appClientId,
      row.event,
      (row.payload ?? {}) as Record<string, unknown>,
      { retryCount: row.attempts },
    );
    if (result.dispatched) return;

    // Retrying is pointless when there is nowhere to send it — treat as done so
    // the row does not churn forever.
    if (result.reason === 'NO_WEBHOOK_URL_CONFIGURED' || result.reason === 'APP_NOT_FOUND') {
      this.logger.log(`Dropping outbox row ${row.id}: ${result.reason}.`);
      return;
    }
    throw new Error(result.reason ?? 'Partner webhook delivery failed.');
  }

  private async scheduleRetry(row: AppPaymentOutbox, err: unknown): Promise<void> {
    const attempts = row.attempts + 1;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const exhausted = attempts >= this.maxAttempts;
    const delayMs = Math.min(this.baseBackoffMs * 2 ** (attempts - 1), 60 * 60_000);

    await this.prisma.appPaymentOutbox
      .update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          nextAttemptAt: new Date(Date.now() + delayMs),
          lastError: message,
        },
      })
      .catch((updateErr: any) =>
        this.logger.error(`Could not reschedule outbox row ${row.id}: ${updateErr?.message}`),
      );

    if (exhausted) {
      this.logger.error(
        `Outbox row ${row.id} (${row.kind}, charge ${row.chargeId ?? '-'}) failed ${attempts} times and is now dead: ${message}`,
      );
    } else {
      this.logger.warn(`Outbox row ${row.id} will retry in ~${Math.round(delayMs / 60_000)}m: ${message}`);
    }
  }

  private enabled(): boolean {
    return this.config.get<string>('APP_PAYMENTS_RECONCILE_ENABLED') !== 'false';
  }

  private async withLock(key: string, ttlSeconds: number, fn: () => Promise<unknown>): Promise<void> {
    let acquired = false;
    if (this.redis) {
      try {
        acquired = await this.redis.setNx(key, '1', ttlSeconds);
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
}

