import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppChargeMethod, AppChargeStatus, Prisma } from '@prisma/client';
import { AppPaymentsService } from './app-payments.service';
import { AppPaymentsLedgerService } from './app-payments-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';

const mockPaymentIntents = { create: jest.fn(), retrieve: jest.fn() };
const mockRefunds = { create: jest.fn() };
const mockStripeWebhooks = { constructEvent: jest.fn() };

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: mockPaymentIntents,
    refunds: mockRefunds,
    webhooks: mockStripeWebhooks,
  })),
);

const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({
  post: (...args: any[]) => mockAxiosPost(...args),
  get: (...args: any[]) => mockAxiosGet(...args),
}));

const baseCharge = (overrides: Partial<any> = {}) => ({
  id: 'ch_1',
  appClientId: 'mcom-mall',
  amountMinor: 10270n,
  currency: 'GBP',
  feeMinor: 318n,
  netMinor: 9952n,
  refundedMinor: 0n,
  method: AppChargeMethod.stripe,
  status: AppChargeStatus.pending,
  reference: 'order_1',
  description: null,
  mcomUserId: null,
  externalCustomerId: null,
  provider: null,
  providerRef: null,
  walletDebitAmount: null,
  idempotencyKey: 'idem_1',
  requestHash: null,
  metadata: {},
  failureReason: null,
  reconciliationNeeded: false,
  settlementAttempts: 0,
  paidAt: null,
  createdAt: new Date('2026-10-11T10:00:00.000Z'),
  ...overrides,
});

const baseRefund = (overrides: Partial<any> = {}) => ({
  id: 'rf_1',
  chargeId: 'ch_1',
  appClientId: 'mcom-mall',
  amountMinor: 10270n,
  feeRefundMinor: 318n,
  netRefundMinor: 9952n,
  currency: 'GBP',
  provider: 'stripe',
  providerRef: null,
  status: 'pending',
  idempotencyKey: 'refund_1',
  requestHash: null,
  reason: null,
  failureReason: null,
  createdBy: 'mcom-mall',
  createdAt: new Date('2026-10-28T10:00:00.000Z'),
  ...overrides,
});

describe('AppPaymentsService', () => {
  let service: AppPaymentsService;
  let prisma: any;
  let wallet: any;
  let dispatcher: any;

  const client: any = { clientId: 'mcom-mall', name: 'MCOM Mall', feePercent: null, feeFixedMinor: null };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const cfg: Record<string, any> = {
        STRIPE_SECRET_KEY: 'sk_test_mock',
        STRIPE_WEBHOOK_SECRET: 'whsec_mock',
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'pp_id',
        PAYPAL_CLIENT_SECRET: 'pp_secret',
        PAYPAL_WEBHOOK_ID: 'wh_pp',
      };
      return cfg[key] ?? null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      appCharge: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      appRefund: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        aggregate: jest.fn().mockResolvedValue({ _sum: { feeRefundMinor: 0n } }),
      },
      appPaymentOutbox: {
        create: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      processedWebhookEvent: {
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      appPaymentLedgerEntry: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
      programmeSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      fxRate: { findUnique: jest.fn().mockResolvedValue(null) },
      billingTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((cb: any) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb))),
    };

    wallet = {
      resolvePartner: jest.fn().mockResolvedValue({ clientId: 'mcom-mall', name: 'MCOM Mall', platformSlug: 'mall' }),
      debitWallet: jest.fn().mockResolvedValue({}),
      creditWallet: jest.fn().mockResolvedValue({}),
    };

    dispatcher = {
      dispatchAsync: jest.fn(),
      dispatch: jest.fn().mockResolvedValue({ dispatched: true, statusCode: 200 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPaymentsService,
        AppPaymentsLedgerService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: wallet },
        { provide: WebhookDispatcherService, useValue: dispatcher },
      ],
    }).compile();

    service = module.get(AppPaymentsService);
  });

  it('creates a Stripe charge and returns a client secret', async () => {
    const charge = baseCharge();
    prisma.appCharge.create.mockResolvedValue(charge);
    mockPaymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: 'sec_1' });
    prisma.appCharge.update.mockResolvedValue({ ...charge, provider: 'stripe', providerRef: 'pi_1' });

    const res = await service.createCharge(
      client,
      { amountMinor: '10270', method: AppChargeMethod.stripe, reference: 'order_1' } as any,
      'idem_1',
    );

    expect(mockPaymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10270, currency: 'gbp' }),
    );
    expect(res.clientSecret).toBe('sec_1');
    expect(res.charge.providerRef).toBe('pi_1');
    // fee computed and persisted server-side
    expect(prisma.appCharge.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ feeMinor: 318n, netMinor: 9952n }) }),
    );
  });

  it('replays an existing charge on the same idempotency key without charging again', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ status: AppChargeStatus.paid, providerRef: 'pi_1' }));

    const res = await service.createCharge(
      client,
      { amountMinor: '10270', method: AppChargeMethod.stripe, reference: 'order_1' } as any,
      'idem_1',
    );

    expect(mockPaymentIntents.create).not.toHaveBeenCalled();
    expect(res.charge.status).toBe(AppChargeStatus.paid);
  });

  it('rejects a replay of the same key with a different payload', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(
      baseCharge({ status: AppChargeStatus.paid, requestHash: 'hash-of-the-original-request' }),
    );

    await expect(
      service.createCharge(
        client,
        { amountMinor: '99999', method: AppChargeMethod.stripe, reference: 'order_1' } as any,
        'idem_1',
      ),
    ).rejects.toThrow('different payload');
    expect(mockPaymentIntents.create).not.toHaveBeenCalled();
  });

  it('replays the winning charge when a concurrent duplicate hits the unique key', async () => {
    const winner = baseCharge({ provider: 'stripe', providerRef: 'pi_winner' });
    prisma.appCharge.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    // First read (pre-check) misses; second read (race loser) finds the winner.
    prisma.appCharge.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    mockPaymentIntents.retrieve.mockResolvedValue({ id: 'pi_winner', client_secret: 'sec_winner' });

    const res = await service.createCharge(
      client,
      { amountMinor: '10270', method: AppChargeMethod.stripe, reference: 'order_1' } as any,
      'idem_1',
    );

    // Never a 500, never a second provider intent.
    expect(res.charge.id).toBe('ch_1');
    expect(res.clientSecret).toBe('sec_winner');
    expect(mockPaymentIntents.create).not.toHaveBeenCalled();
  });

  it('rejects a replay of a charge that already failed', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ status: AppChargeStatus.failed }));

    await expect(
      service.createCharge(
        client,
        { amountMinor: '10270', method: AppChargeMethod.stripe, reference: 'order_1' } as any,
        'idem_1',
      ),
    ).rejects.toThrow('already used for a charge that is failed');
  });

  it('settles a wallet charge by debiting the MCOM wallet and marking it paid', async () => {
    const charge = baseCharge({ method: AppChargeMethod.wallet, mcomUserId: 'user_1', providerRef: null });
    prisma.appCharge.create.mockResolvedValue(charge);
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
      ...charge,
      status: AppChargeStatus.paid,
      provider: 'wallet',
      paidAt: new Date(),
    });

    const res = await service.createCharge(
      client,
      { amountMinor: '10270', method: AppChargeMethod.wallet, reference: 'order_1', mcomUserId: 'user_1' } as any,
      'idem_wallet',
    );

    expect(wallet.debitWallet).toHaveBeenCalledTimes(1);
    // 10270 pence = £102.70 -> 102.7 MCOM credits at 1:1
    expect(wallet.debitWallet.mock.calls[0][1].amount).toBeCloseTo(102.7, 4);
    expect(res.charge.status).toBe(AppChargeStatus.paid);
    // ledger posted inside the paid transition
    expect(prisma.appPaymentLedgerEntry.createMany).toHaveBeenCalled();
  });

  it('requires mcomUserId for the wallet method', async () => {
    await expect(
      service.createCharge(
        client,
        { amountMinor: '10270', method: AppChargeMethod.wallet, reference: 'order_1' } as any,
        'idem_wallet',
      ),
    ).rejects.toThrow('mcomUserId is required');
  });

  it('confirms a Stripe charge after the intent succeeds', async () => {
    const charge = baseCharge({ provider: 'stripe', providerRef: 'pi_1' });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    mockPaymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount: 10270,
      currency: 'gbp',
      metadata: { chargeId: 'ch_1' },
    });
    prisma.appCharge.update.mockResolvedValue({ ...charge, status: AppChargeStatus.paid, paidAt: new Date() });
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
      ...charge,
      status: AppChargeStatus.paid,
      paidAt: new Date(),
    });

    const res = await service.confirmCharge(client, 'ch_1', { paymentIntentId: 'pi_1' } as any);

    expect(res.charge.status).toBe(AppChargeStatus.paid);
    expect(prisma.appPaymentLedgerEntry.createMany).toHaveBeenCalled();
  });

  it('does not post a second ledger set or webhook when the charge was already settled', async () => {
    const charge = baseCharge({ provider: 'stripe', providerRef: 'pi_1' });
    // getOwnedCharge sees pending; the replay read inside the transaction sees paid.
    prisma.appCharge.findUnique
      .mockResolvedValueOnce(charge)
      .mockResolvedValueOnce({ ...charge, status: AppChargeStatus.paid, paidAt: new Date() });
    mockPaymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount: 10270,
      currency: 'gbp',
      metadata: { chargeId: 'ch_1' },
    });
    // Another caller (the provider webhook) won the compare-and-set.
    prisma.appCharge.updateMany.mockResolvedValue({ count: 0 });
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
      ...charge,
      status: AppChargeStatus.paid,
      paidAt: new Date(),
    });

    const res = await service.confirmCharge(client, 'ch_1', { paymentIntentId: 'pi_1' } as any);

    expect(res.charge.status).toBe(AppChargeStatus.paid);
    expect(prisma.appPaymentLedgerEntry.createMany).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(prisma.appPaymentOutbox.upsert).not.toHaveBeenCalled();
  });

  it('rejects a confirm when the paid amount does not match', async () => {
    const charge = baseCharge({ provider: 'stripe', providerRef: 'pi_1' });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    mockPaymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount: 1,
      currency: 'gbp',
      metadata: { chargeId: 'ch_1' },
    });

    await expect(service.confirmCharge(client, 'ch_1', { paymentIntentId: 'pi_1' } as any)).rejects.toThrow(
      'Paid amount does not match',
    );
  });

  it('refunds a paid Stripe charge and posts reversing ledger rows', async () => {
    const charge = baseCharge({ status: AppChargeStatus.paid, provider: 'stripe', providerRef: 'pi_1' });
    const refund = baseRefund();
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appRefund.create.mockResolvedValue(refund);
    prisma.appRefund.update.mockResolvedValue({ ...refund, status: 'succeeded', providerRef: 're_1' });
    mockRefunds.create.mockResolvedValue({ id: 're_1' });
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
      ...charge,
      status: AppChargeStatus.refunded,
      refundedMinor: 10270n,
    });

    const res = await service.refundCharge(client, 'ch_1', {} as any, 'refund_key_1');

    expect(mockRefunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1', amount: 10270 }),
      { idempotencyKey: `apprefund:${refund.id}` },
    );
    expect(res.charge.status).toBe(AppChargeStatus.refunded);
    expect(res.refund.status).toBe('succeeded');
    // Ledger rows are scoped to the refund, not the charge.
    const rows = prisma.appPaymentLedgerEntry.createMany.mock.calls[0][0].data;
    expect(rows.every((r: any) => r.idempotencyKey.startsWith(`${refund.id}:`))).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('replays a refund instead of charging back twice when the key repeats', async () => {
    const charge = baseCharge({ status: AppChargeStatus.refunded, refundedMinor: 10270n });
    const refund = baseRefund({ status: 'succeeded' });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appRefund.findUnique.mockResolvedValue(refund);

    const res = await service.refundCharge(client, 'ch_1', {} as any, 'refund_key_1');

    expect(mockRefunds.create).not.toHaveBeenCalled();
    expect(res.refund.id).toBe(refund.id);
    expect(res.charge.status).toBe(AppChargeStatus.refunded);
  });

  it('rejects a repeated refund key used with a different amount', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ status: AppChargeStatus.paid }));
    prisma.appRefund.findUnique.mockResolvedValue(
      baseRefund({ status: 'succeeded', requestHash: 'hash-of-the-original-refund' }),
    );

    await expect(
      service.refundCharge(client, 'ch_1', { amountMinor: '5000' } as any, 'refund_key_1'),
    ).rejects.toThrow('different refund payload');
    expect(mockRefunds.create).not.toHaveBeenCalled();
  });

  it('lets only one concurrent refund hold the charge claim', async () => {
    const charge = baseCharge({ status: AppChargeStatus.paid, provider: 'stripe', providerRef: 'pi_1' });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appRefund.create.mockResolvedValue(baseRefund({ idempotencyKey: 'refund_key_2' }));
    // Another refund already moved the charge to `refunding`.
    prisma.appCharge.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refundCharge(client, 'ch_1', {} as any, 'refund_key_2')).rejects.toThrow(
      'Another refund is already in progress',
    );
    expect(mockRefunds.create).not.toHaveBeenCalled();
    expect(prisma.appRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
    expect(prisma.appPaymentLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('refuses a partial refund larger than the remaining refundable balance', async () => {    prisma.appCharge.findUnique.mockResolvedValue(
      baseCharge({ status: AppChargeStatus.partially_refunded, refundedMinor: 6162n }),
    );

    await expect(
      service.refundCharge(client, 'ch_1', { amountMinor: '6162' } as any, 'refund_key_3'),
    ).rejects.toThrow('remaining refundable amount');
    expect(mockRefunds.create).not.toHaveBeenCalled();
  });

  it('rolls the charge back and marks the refund failed when the provider rejects it', async () => {
    const charge = baseCharge({ status: AppChargeStatus.paid, provider: 'stripe', providerRef: 'pi_1' });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appRefund.create.mockResolvedValue(baseRefund());
    mockRefunds.create.mockRejectedValue(new Error('card_declined'));

    await expect(service.refundCharge(client, 'ch_1', {} as any, 'refund_key_4')).rejects.toThrow(
      'card_declined',
    );

    expect(prisma.appRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
    // Charge released back to `paid`, not left stuck in `refunding`.
    expect(prisma.appCharge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: AppChargeStatus.paid } }),
    );
    expect(prisma.appPaymentLedgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('parks a refund for reconciliation when the provider succeeded but settlement failed', async () => {
    const charge = baseCharge({ status: AppChargeStatus.paid, provider: 'stripe', providerRef: 'pi_1' });
    const refund = baseRefund();
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appRefund.create.mockResolvedValue(refund);
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue(charge);
    mockRefunds.create.mockResolvedValue({ id: 're_1' });
    // First appRefund.update is the settlement write; let it blow up.
    prisma.appRefund.update.mockRejectedValueOnce(new Error('db unavailable'));

    const res = await service.refundCharge(client, 'ch_1', {} as any, 'refund_key_5');

    expect(res.refund.status).toBe('pending');
    expect(prisma.appPaymentOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dedupeKey: `refund_provider:${refund.id}` }) }),
    );
    expect(prisma.appCharge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reconciliationNeeded: true }) }),
    );
  });

  it('returns the prorated wallet debit for a partial wallet refund', async () => {
    const charge = baseCharge({
      method: AppChargeMethod.wallet,
      status: AppChargeStatus.paid,
      mcomUserId: 'user_1',
      provider: 'wallet',
      providerRef: null,
      walletDebitAmount: new Prisma.Decimal('102.7000'),
    });
    const refund = baseRefund({ amountMinor: 5135n, feeRefundMinor: 159n, netRefundMinor: 4976n });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appRefund.create.mockResolvedValue(refund);
    prisma.appRefund.update.mockResolvedValue({ ...refund, status: 'succeeded' });
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
      ...charge,
      status: AppChargeStatus.partially_refunded,
      refundedMinor: 5135n,
    });

    await service.refundCharge(client, 'ch_1', { amountMinor: '5135' } as any, 'refund_key_6');

    // Half of 102.70 credits — from the recorded debit, not live FX.
    expect(wallet.creditWallet.mock.calls[0][1].amount).toBeCloseTo(51.35, 4);
    expect(wallet.creditWallet.mock.calls[0][2]).toBe(`apprefund:${refund.id}`);
  });

  it('enforces app isolation on charge lookup', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ appClientId: 'someone-else' }));
    await expect(service.getCharge(client, 'ch_1')).rejects.toThrow('does not belong to your app');
  });

  it('lists refund attempts for a charge including parked ones', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ status: AppChargeStatus.paid }));
    prisma.appRefund.findMany.mockResolvedValue([
      baseRefund({ id: 'rf_2', status: 'pending', providerRef: null }),
      baseRefund({ id: 'rf_1', status: 'succeeded', providerRef: 're_1' }),
    ]);

    const res = await service.listRefunds(client, 'ch_1');

    expect(res.data.map((r) => r.id)).toEqual(['rf_2', 'rf_1']);
    expect(res.data[0].status).toBe('pending');
  });

  it('queues the partner notification durably before delivering it', async () => {
    const charge = baseCharge({ provider: 'stripe', providerRef: 'pi_1' });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    mockPaymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      status: 'succeeded',
      amount: 10270,
      currency: 'gbp',
      metadata: { chargeId: 'ch_1' },
    });
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
      ...charge,
      status: AppChargeStatus.paid,
      paidAt: new Date(),
    });

    await service.confirmCharge(client, 'ch_1', { paymentIntentId: 'pi_1' } as any);
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.appPaymentOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: 'partner_webhook:ch_1:payment.succeeded:primary' },
        create: expect.objectContaining({
          kind: 'partner_webhook',
          event: 'payment.succeeded',
          appClientId: 'mcom-mall',
        }),
      }),
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'mcom-mall',
      'payment.succeeded',
      expect.objectContaining({ chargeId: 'ch_1' }),
    );
    expect(prisma.appPaymentOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DONE' } }),
    );
  });

  it('keys each refund notification by refund id so none is dropped as a duplicate', async () => {
    const charge = baseCharge({ status: AppChargeStatus.paid, provider: 'stripe', providerRef: 'pi_1' });
    const refund = baseRefund({ id: 'rf_9' });
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appRefund.create.mockResolvedValue(refund);
    prisma.appRefund.update.mockResolvedValue({ ...refund, status: 'succeeded', providerRef: 're_9' });
    mockRefunds.create.mockResolvedValue({ id: 're_9' });
    prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
      ...charge,
      status: AppChargeStatus.refunded,
      refundedMinor: 10270n,
    });

    await service.refundCharge(client, 'ch_1', {} as any, 'refund_key_9');
    await new Promise((resolve) => setImmediate(resolve));

    expect(prisma.appPaymentOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: 'partner_webhook:ch_1:payment.refunded:rf_9' },
      }),
    );
  });

  describe('inbound webhooks', () => {
    const stripeEvent = (id: string, type: string, object: any) => ({
      id,
      type,
      data: { object },
    });

    it('processes a Stripe event once when the provider delivers it twice', async () => {
      const charge = baseCharge({ status: AppChargeStatus.pending, providerRef: 'pi_1' });
      const intent = { id: 'pi_1', amount: 10270, metadata: { chargeId: 'ch_1' }, status: 'succeeded' };

      mockStripeWebhooks.constructEvent.mockReturnValue(
        stripeEvent('evt_dup', 'payment_intent.succeeded', intent),
      );
      prisma.appCharge.findUnique.mockResolvedValue(charge);
      prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
        ...charge,
        status: AppChargeStatus.paid,
      });
      // Second delivery hits the (provider, eventId) unique index.
      prisma.processedWebhookEvent.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        );

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');
      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      // Money moved exactly once: one compare-and-set, one ledger set.
      expect(prisma.appCharge.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.appPaymentLedgerEntry.createMany).toHaveBeenCalledTimes(1);
    });

    it('releases the claim when processing fails so a retry is not swallowed', async () => {
      const charge = baseCharge({ status: AppChargeStatus.pending, providerRef: 'pi_1' });

      mockStripeWebhooks.constructEvent.mockReturnValue(
        stripeEvent('evt_broken', 'payment_intent.succeeded', {
          id: 'pi_1',
          amount: 10270,
          metadata: { chargeId: 'ch_1' },
        }),
      );
      prisma.appCharge.findUnique.mockResolvedValue(charge);
      prisma.appCharge.updateMany.mockRejectedValueOnce(new Error('db unavailable'));

      await expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow(
        'db unavailable',
      );

      expect(prisma.processedWebhookEvent.delete).toHaveBeenCalledWith({
        where: { provider_eventId: { provider: 'stripe', eventId: 'evt_broken' } },
      });
    });

    it('marks a pending charge failed when Stripe reports the payment failed', async () => {
      prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ status: AppChargeStatus.pending }));
      mockStripeWebhooks.constructEvent.mockReturnValue(
        stripeEvent('evt_failed', 'payment_intent.payment_failed', {
          id: 'pi_1',
          status: 'requires_payment_method',
          metadata: { chargeId: 'ch_1' },
          last_payment_error: { message: 'Your card was declined.' },
        }),
      );

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.appCharge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ch_1', status: AppChargeStatus.pending },
          data: { status: AppChargeStatus.failed, failureReason: 'Your card was declined.' },
        }),
      );
    });

    it('does not fail a charge that already settled', async () => {
      prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ status: AppChargeStatus.paid }));
      mockStripeWebhooks.constructEvent.mockReturnValue(
        stripeEvent('evt_late', 'payment_intent.payment_failed', {
          id: 'pi_1',
          metadata: { chargeId: 'ch_1' },
        }),
      );

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.appCharge.updateMany).not.toHaveBeenCalled();
    });

    it('records a refund created directly at the provider without calling the provider', async () => {
      const charge = baseCharge({ status: AppChargeStatus.paid, providerRef: 'pi_1' });
      const refund = baseRefund({
        id: 'rf_ext',
        amountMinor: 4000n,
        feeRefundMinor: 124n,
        netRefundMinor: 3876n,
        providerRef: 're_ext_1',
        idempotencyKey: 'stripe:re_ext_1',
      });

      mockStripeWebhooks.constructEvent.mockReturnValue(
        stripeEvent('evt_refund', 'charge.refunded', {
          payment_intent: 'pi_1',
          amount_refunded: 4000,
          refunds: { data: [{ id: 're_ext_1' }] },
        }),
      );
      prisma.appCharge.findUnique.mockResolvedValue(charge);
      prisma.appRefund.create.mockResolvedValue(refund);
      prisma.appRefund.update.mockResolvedValue({ ...refund, status: 'succeeded' });
      prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
        ...charge,
        status: AppChargeStatus.partially_refunded,
        refundedMinor: 4000n,
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.appRefund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idempotencyKey: 'stripe:re_ext_1',
            providerRef: 're_ext_1',
            amountMinor: 4000n,
            feeRefundMinor: 124n,
            netRefundMinor: 3876n,
          }),
        }),
      );
      expect(prisma.appCharge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'ch_1',
            status: { in: [AppChargeStatus.paid, AppChargeStatus.partially_refunded] },
            refundedMinor: 0n,
          },
          data: { status: AppChargeStatus.refunding },
        }),
      );
      expect(prisma.appPaymentLedgerEntry.createMany).toHaveBeenCalled();
      // The money already left Stripe — never refund it a second time.
      expect(mockRefunds.create).not.toHaveBeenCalled();
    });

    it('only records the delta for a refund already booked locally', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue(
        stripeEvent('evt_refund_replay', 'charge.refunded', {
          payment_intent: 'pi_1',
          amount_refunded: 4000,
          refunds: { data: [{ id: 're_ext_1' }] },
        }),
      );
      prisma.appCharge.findUnique.mockResolvedValue(
        baseCharge({
          status: AppChargeStatus.partially_refunded,
          refundedMinor: 4000n,
          providerRef: 'pi_1',
        }),
      );

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.appRefund.create).not.toHaveBeenCalled();
      expect(prisma.appCharge.updateMany).not.toHaveBeenCalled();
    });

    describe('PayPal', () => {
      beforeEach(() => {
        mockAxiosPost.mockImplementation((url: string) => {
          if (url.includes('/v1/oauth2/token')) {
            return Promise.resolve({ data: { access_token: 'pp_tok', expires_in: 3600 } });
          }
          if (url.includes('verify-webhook-signature')) {
            return Promise.resolve({ data: { verification_status: 'SUCCESS' } });
          }
          return Promise.reject(new Error(`unexpected POST ${url}`));
        });
      });

      const paypalEvent = (id: string, eventType: string, resource: any) => ({
        id,
        event_type: eventType,
        resource,
      });

      it('processes a completed capture once across duplicate deliveries', async () => {
        const charge = baseCharge({
          status: AppChargeStatus.pending,
          method: AppChargeMethod.paypal,
          provider: 'paypal',
          providerRef: 'ORD_1',
        });
        prisma.appCharge.findUnique.mockResolvedValue(charge);
        prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
          ...charge,
          status: AppChargeStatus.paid,
        });
        prisma.processedWebhookEvent.create
          .mockResolvedValueOnce({})
          .mockRejectedValueOnce(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          );

        const body = Buffer.from(
          JSON.stringify(
            paypalEvent('WH-1', 'PAYMENT.CAPTURE.COMPLETED', { id: 'CAP_1', custom_id: 'ch_1' }),
          ),
        );
        await service.handlePaypalWebhook(body, {});
        await service.handlePaypalWebhook(body, {});

        expect(prisma.appCharge.updateMany).toHaveBeenCalledTimes(1);
        expect(prisma.appPaymentLedgerEntry.createMany).toHaveBeenCalledTimes(1);
      });

      it('marks a denied capture failed', async () => {
        prisma.appCharge.findUnique.mockResolvedValue(
          baseCharge({ status: AppChargeStatus.pending, method: AppChargeMethod.paypal }),
        );
        const body = Buffer.from(
          JSON.stringify(
            paypalEvent('WH-2', 'PAYMENT.CAPTURE.DENIED', {
              id: 'CAP_2',
              custom_id: 'ch_1',
              status_details: { reason: 'INSTRUMENT_DECLINED' },
            }),
          ),
        );

        await service.handlePaypalWebhook(body, {});

        expect(prisma.appCharge.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { status: AppChargeStatus.failed, failureReason: 'INSTRUMENT_DECLINED' },
          }),
        );
      });

      it('records an external PayPal refund against the charge', async () => {
        const charge = baseCharge({
          status: AppChargeStatus.paid,
          method: AppChargeMethod.paypal,
          provider: 'paypal',
          providerRef: 'ORD_1',
        });
        const refund = baseRefund({
          id: 'rf_pp',
          provider: 'paypal',
          amountMinor: 2000n,
          feeRefundMinor: 62n,
          netRefundMinor: 1938n,
          providerRef: 'REF_1',
          idempotencyKey: 'paypal:REF_1',
        });
        prisma.appCharge.findUnique.mockResolvedValue(charge);
        prisma.appRefund.create.mockResolvedValue(refund);
        prisma.appRefund.update.mockResolvedValue({ ...refund, status: 'succeeded' });
        prisma.appCharge.findUniqueOrThrow.mockResolvedValue({
          ...charge,
          status: AppChargeStatus.partially_refunded,
          refundedMinor: 2000n,
        });

        const body = Buffer.from(
          JSON.stringify(
            paypalEvent('WH-3', 'PAYMENT.CAPTURE.REFUNDED', {
              id: 'REF_1',
              custom_id: 'ch_1',
              amount: { value: '20.00', currency_code: 'GBP' },
            }),
          ),
        );

        await service.handlePaypalWebhook(body, {});

        expect(prisma.appRefund.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              idempotencyKey: 'paypal:REF_1',
              amountMinor: 2000n,
              providerRef: 'REF_1',
            }),
          }),
        );

        expect(prisma.appPaymentLedgerEntry.createMany).toHaveBeenCalled();
      });
    });
  });

  describe('admin ledger (MCOM Central direct sales)', () => {
    const centralTxn = (overrides: Record<string, any> = {}) => ({
      id: 'bt_1',
      businessId: 'biz_1',
      amount: 49.99,
      description: 'MCOM Membership — Gold (Pro, monthly)',
      status: 'paid',
      provider: 'stripe',
      providerPaymentId: 'pi_central_1',
      createdAt: new Date('2026-10-28T12:00:00.000Z'),
      business: { userId: 'user_1', businessName: 'Acme Ltd' },
      ...overrides,
    });

    it('merges central direct sales into the admin charge list', async () => {
      prisma.billingTransaction.findMany.mockResolvedValue([centralTxn()]);
      prisma.billingTransaction.count.mockResolvedValue(1);
      prisma.appCharge.findMany.mockResolvedValue([
        baseCharge({ id: 'ch_1', createdAt: new Date('2026-10-20T09:00:00.000Z') }),
      ]);
      prisma.appCharge.count.mockResolvedValue(1);

      const res = await service.listAllCharges({ page: 1, limit: 20 } as any);

      expect(res.total).toBe(2);
      expect(res.data[0]).toMatchObject({
        id: 'bt_1',
        appClientId: 'mcom-central',
        amountMinor: '4999',
        feeMinor: '0',
        netMinor: '4999',
        method: 'stripe',
        status: 'paid',
        mcomUserId: 'user_1',
        source: 'central',
      });
      expect(res.data[1]).toMatchObject({ id: 'ch_1', source: 'app' });
    });

    it('returns only central sales when the mcom-central filter is used', async () => {
      prisma.billingTransaction.findMany.mockResolvedValue([centralTxn()]);
      prisma.billingTransaction.count.mockResolvedValue(1);

      const res = await service.listAllCharges({ appClientId: 'mcom-central' } as any);

      expect(res.total).toBe(1);
      expect(prisma.appCharge.findMany).not.toHaveBeenCalled();
    });

    it('does not query central sales when another app is filtered', async () => {
      prisma.appCharge.findMany.mockResolvedValue([baseCharge()]);
      prisma.appCharge.count.mockResolvedValue(1);

      await service.listAllCharges({ appClientId: 'mcom-mall' } as any);

      expect(prisma.billingTransaction.findMany).not.toHaveBeenCalled();
    });

    it('returns a central charge by id and synthesizes its double-entry rows', async () => {
      prisma.billingTransaction.findUnique.mockResolvedValue(centralTxn());

      const charge = await service.getChargeAsAdmin('bt_1');
      expect(charge).toMatchObject({ id: 'bt_1', appClientId: 'mcom-central', source: 'central' });

      const ledger = await service.getLedgerForCharge('bt_1');
      expect(ledger).toEqual([
        expect.objectContaining({
          account: 'gateway_clearing',
          direction: 'debit',
          amountMinor: '4999',
        }),
        expect.objectContaining({
          account: 'mcom_revenue',
          direction: 'credit',
          amountMinor: '4999',
        }),
      ]);
    });

    it('uses wallet clearing for wallet-paid central sales', async () => {
      prisma.billingTransaction.findUnique.mockResolvedValue(
        centralTxn({ provider: 'wallet', providerPaymentId: 'wallet:key-1' }),
      );

      const ledger = await service.getLedgerForCharge('bt_1');
      expect(ledger[0]).toMatchObject({ account: 'wallet_clearing', direction: 'debit' });
    });
  });
});
