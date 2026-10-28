import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppPaymentsReconciliationService } from './app-payments-reconciliation.service';
import { AppPaymentsService } from './app-payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';

const outboxRow = (overrides: Partial<any> = {}) => ({
  id: 'ob_1',
  kind: 'partner_webhook',
  appClientId: 'mcom-mall',
  chargeId: 'ch_1',
  refundId: null,
  event: 'payment.succeeded',
  dedupeKey: 'partner_webhook:ch_1:payment.succeeded:primary',
  payload: { chargeId: 'ch_1' },
  status: 'PENDING',
  attempts: 0,
  nextAttemptAt: new Date('2026-10-28T10:00:00.000Z'),
  lastError: null,
  createdAt: new Date('2026-10-28T09:59:00.000Z'),
  updatedAt: new Date('2026-10-28T09:59:00.000Z'),
  ...overrides,
});

describe('AppPaymentsReconciliationService', () => {
  let service: AppPaymentsReconciliationService;
  let prisma: any;
  let payments: any;
  let dispatcher: any;

  beforeEach(async () => {
    prisma = {
      appPaymentOutbox: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      appCharge: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    payments = {
      reconcileParkedRefund: jest.fn().mockResolvedValue(undefined),
      reconcileCharge: jest.fn().mockResolvedValue(undefined),
    };

    dispatcher = {
      dispatch: jest.fn().mockResolvedValue({ dispatched: true, statusCode: 200 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPaymentsReconciliationService,
        { provide: ConfigService, useValue: { get: jest.fn(() => null) } },
        { provide: PrismaService, useValue: prisma },
        { provide: AppPaymentsService, useValue: payments },
        { provide: WebhookDispatcherService, useValue: dispatcher },
        {
          provide: RedisService,
          useValue: { setNx: jest.fn().mockResolvedValue(true), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AppPaymentsReconciliationService);
  });

  it('delivers a queued partner webhook once and marks the row done', async () => {
    prisma.appPaymentOutbox.findMany.mockResolvedValue([outboxRow()]);

    const result = await service.drainOutbox();

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'mcom-mall',
      'payment.succeeded',
      expect.objectContaining({ chargeId: 'ch_1' }),
      { retryCount: 0 },
    );
    expect(prisma.appPaymentOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DONE', lastError: null } }),
    );
  });

  it('skips a row another worker already claimed', async () => {
    prisma.appPaymentOutbox.findMany.mockResolvedValue([outboxRow()]);
    // The compare-and-set loses: someone moved it to PROCESSING first.
    prisma.appPaymentOutbox.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.drainOutbox();

    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('reschedules a failed delivery with backoff instead of losing it', async () => {
    prisma.appPaymentOutbox.findMany.mockResolvedValue([outboxRow()]);
    dispatcher.dispatch.mockResolvedValue({ dispatched: false, reason: 'HTTP 500' });

    const result = await service.drainOutbox();

    expect(result).toEqual({ processed: 0, failed: 1 });
    const update = prisma.appPaymentOutbox.update.mock.calls[0][0];
    expect(update.data).toEqual(
      expect.objectContaining({ status: 'PENDING', attempts: 1, lastError: 'HTTP 500' }),
    );
    expect(update.data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('treats a missing webhook url as nothing to deliver', async () => {
    prisma.appPaymentOutbox.findMany.mockResolvedValue([outboxRow()]);
    dispatcher.dispatch.mockResolvedValue({
      dispatched: false,
      reason: 'NO_WEBHOOK_URL_CONFIGURED',
    });

    const result = await service.drainOutbox();

    expect(result).toEqual({ processed: 1, failed: 0 });
  });

  it('gives up after the maximum number of attempts', async () => {
    prisma.appPaymentOutbox.findMany.mockResolvedValue([outboxRow({ attempts: 7 })]);
    dispatcher.dispatch.mockResolvedValue({ dispatched: false, reason: 'HTTP 500' });

    await service.drainOutbox();

    expect(prisma.appPaymentOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', attempts: 8 }),
      }),
    );
  });

  it('re-drives a parked refund settlement without re-calling the provider', async () => {
    prisma.appPaymentOutbox.findMany.mockResolvedValue([
      outboxRow({
        kind: 'refund_provider',
        refundId: 'rf_1',
        event: 'payment.refunded',
        dedupeKey: 'refund_provider:rf_1',
      }),
    ]);

    await service.drainOutbox();

    expect(payments.reconcileParkedRefund).toHaveBeenCalledWith('rf_1');
    expect(prisma.appPaymentOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DONE' }) }),
    );
  });

  it('re-checks charges flagged for reconciliation', async () => {
    prisma.appCharge.findMany.mockResolvedValue([{ id: 'ch_1' }, { id: 'ch_2' }]);
    prisma.appCharge.findUnique
      .mockResolvedValueOnce({ id: 'ch_1', reconciliationNeeded: false })
      .mockResolvedValueOnce({ id: 'ch_2', reconciliationNeeded: true });

    const reconciled = await service.reconcileFlaggedCharges();

    expect(payments.reconcileCharge).toHaveBeenCalledTimes(2);
    expect(reconciled).toBe(1);
  });
});
