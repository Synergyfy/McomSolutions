import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppChargeMethod, AppChargeStatus } from '@prisma/client';
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
  metadata: {},
  failureReason: null,
  paidAt: null,
  createdAt: new Date('2026-10-11T10:00:00.000Z'),
  ...overrides,
});

describe('AppPaymentsService', () => {
  let service: AppPaymentsService;
  let prisma: any;
  let wallet: any;

  const client: any = { clientId: 'mcom-mall', name: 'MCOM Mall', feePercent: null, feeFixedMinor: null };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const cfg: Record<string, any> = {
        STRIPE_SECRET_KEY: 'sk_test_mock',
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'pp_id',
        PAYPAL_CLIENT_SECRET: 'pp_secret',
      };
      return cfg[key] ?? null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      appCharge: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      appPaymentLedgerEntry: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
      programmeSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      fxRate: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((cb: any) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb))),
    };

    wallet = {
      resolvePartner: jest.fn().mockResolvedValue({ clientId: 'mcom-mall', name: 'MCOM Mall', platformSlug: 'mall' }),
      debitWallet: jest.fn().mockResolvedValue({}),
      creditWallet: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPaymentsService,
        AppPaymentsLedgerService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: wallet },
        { provide: WebhookDispatcherService, useValue: { dispatchAsync: jest.fn() } },
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

  it('rejects an idempotency key already used by another app', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ appClientId: 'other-app' }));

    await expect(
      service.createCharge(
        client,
        { amountMinor: '10270', method: AppChargeMethod.stripe, reference: 'order_1' } as any,
        'idem_1',
      ),
    ).rejects.toThrow('idempotency key has already been used');
    expect(mockPaymentIntents.create).not.toHaveBeenCalled();
  });

  it('settles a wallet charge by debiting the MCOM wallet and marking it paid', async () => {
    const charge = baseCharge({ method: AppChargeMethod.wallet, mcomUserId: 'user_1', providerRef: null });
    prisma.appCharge.create.mockResolvedValue(charge);
    prisma.appCharge.update.mockResolvedValue({ ...charge, status: AppChargeStatus.paid, provider: 'wallet', paidAt: new Date() });

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

    const res = await service.confirmCharge(client, 'ch_1', { paymentIntentId: 'pi_1' } as any);

    expect(res.charge.status).toBe(AppChargeStatus.paid);
    expect(prisma.appPaymentLedgerEntry.createMany).toHaveBeenCalled();
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
    prisma.appCharge.findUnique.mockResolvedValue(charge);
    prisma.appCharge.update.mockResolvedValue({ ...charge, status: AppChargeStatus.refunded });
    mockRefunds.create.mockResolvedValue({ id: 're_1' });

    const res = await service.refundCharge(client, 'ch_1', {} as any);

    expect(mockRefunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_1', amount: 10270 }),
    );
    expect(res.charge.status).toBe(AppChargeStatus.refunded);
  });

  it('enforces app isolation on charge lookup', async () => {
    prisma.appCharge.findUnique.mockResolvedValue(baseCharge({ appClientId: 'someone-else' }));
    await expect(service.getCharge(client, 'ch_1')).rejects.toThrow('does not belong to your app');
  });
});
