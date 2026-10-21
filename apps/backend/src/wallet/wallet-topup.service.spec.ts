import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import axios from 'axios';
import { WalletTopUpService } from './wallet-topup.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { RedisService } from '../redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WalletTopUpService', () => {
  let service: WalletTopUpService;
  let prisma: any;
  let walletService: any;
  let lockUtil: any;
  let redis: any;

  const wallet = {
    id: 'wallet-1',
    userId: 'cust-1',
    balance: new Decimal(100),
    currency: 'MCOM',
    status: 'ACTIVE',
  };

  const paypalRequest = {
    id: 'topup-1',
    walletId: 'wallet-1',
    userId: 'cust-1',
    amount: new Decimal(50),
    currency: 'GBP',
    walletCurrency: 'MCOM',
    exchangeRate: new Decimal(1),
    provider: 'paypal',
    providerRef: 'ORDER-1',
    providerStatus: null,
    status: 'PENDING',
    transactionId: null,
    createdAt: new Date('2026-10-21T10:00:00Z'),
    completedAt: null,
    failedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      walletTopUpRequest: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      wallet: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      fxRate: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };

    walletService = {
      ensureWallet: jest.fn().mockResolvedValue(wallet),
    };
    lockUtil = {
      withLock: jest.fn(async (_walletId: string, fn: () => Promise<any>) => fn()),
    };
    redis = {
      del: jest.fn().mockResolvedValue(1),
    };

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, any> = {
          STRIPE_SECRET_KEY: undefined,
          PAYPAL_CLIENT_ID: 'paypal-client-id',
          PAYPAL_CLIENT_SECRET: 'paypal-client-secret',
          PAYPAL_ENV: 'sandbox',
          NODE_ENV: 'test',
          FRONTEND_URL: 'http://localhost:3000',
          MCOM_GBP_RATE: '1',
        };
        return values[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletTopUpService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: WalletService, useValue: walletService },
        { provide: WalletLedgerService, useValue: { getTransactions: jest.fn() } },
        { provide: WalletLockUtil, useValue: lockUtil },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<WalletTopUpService>(WalletTopUpService);

    jest.clearAllMocks();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
  });

  describe('initiateTopUp', () => {
    it('creates a PayPal order and returns an approval URL', async () => {
      prisma.walletTopUpRequest.create.mockResolvedValue(paypalRequest);
      prisma.walletTopUpRequest.update.mockResolvedValue({ ...paypalRequest, providerRef: 'ORDER-1' });
      mockedAxios.post
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } } as any)
        .mockResolvedValueOnce({
          data: {
            id: 'ORDER-1',
            links: [{ rel: 'approve', href: 'https://paypal.test/approve' }],
          },
        } as any);

      const result: any = await service.initiateTopUp('cust-1', {
        amount: 50,
        currency: 'GBP',
        provider: 'paypal',
      } as any);

      expect(result).toMatchObject({
        provider: 'paypal',
        topUpRequestId: 'topup-1',
        orderId: 'ORDER-1',
        approvalUrl: 'https://paypal.test/approve',
        status: 'PENDING',
      });
      expect(prisma.walletTopUpRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: 'paypal', userId: 'cust-1' }),
        }),
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api-m.sandbox.paypal.com/v2/checkout/orders',
        expect.objectContaining({ intent: 'CAPTURE' }),
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it('rejects unsupported providers', async () => {
      await expect(
        service.initiateTopUp('cust-1', { amount: 50, provider: 'paystack' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.walletTopUpRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmPaypalTopUp', () => {
    it('rejects a top-up request owned by another user', async () => {
      prisma.walletTopUpRequest.findUnique.mockResolvedValue({
        ...paypalRequest,
        userId: 'someone-else',
      });

      await expect(
        service.confirmPaypalTopUp('cust-1', {
          topUpRequestId: 'topup-1',
          orderId: 'ORDER-1',
          provider: 'paypal',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('captures an approved PayPal order and credits the wallet', async () => {
      prisma.walletTopUpRequest.findUnique
        .mockResolvedValueOnce(paypalRequest)
        .mockResolvedValue(paypalRequest);
      prisma.walletTopUpRequest.findUniqueOrThrow.mockResolvedValue(paypalRequest);
      prisma.wallet.findUniqueOrThrow.mockResolvedValue(wallet);
      prisma.walletTransaction.create.mockResolvedValue({});
      prisma.walletTopUpRequest.update.mockResolvedValue({});
      prisma.wallet.update.mockResolvedValue({});

      mockedAxios.post
        .mockResolvedValueOnce({ data: { access_token: 'token', expires_in: 3600 } } as any)
        .mockResolvedValueOnce({
          data: {
            status: 'COMPLETED',
            purchase_units: [
              {
                custom_id: 'topup-1',
                amount: { value: '50.00', currency_code: 'GBP' },
                payments: {
                  captures: [
                    {
                      id: 'CAPTURE-1',
                      status: 'COMPLETED',
                      amount: { value: '50.00', currency_code: 'GBP' },
                    },
                  ],
                },
              },
            ],
          },
        } as any);

      const result: any = await service.confirmPaypalTopUp('cust-1', {
        topUpRequestId: 'topup-1',
        orderId: 'ORDER-1',
        provider: 'paypal',
      });

      expect(result).toEqual({ success: true, balance: 150 });
      expect(prisma.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: expect.any(Decimal),
            category: 'TOP_UP',
            idempotencyKey: 'topup:topup-1',
          }),
        }),
      );
      expect(redis.del).toHaveBeenCalledWith('wallet:balance:cust-1');
    });
  });

  describe('confirmStripeTopUp', () => {
    it('rejects a top-up request owned by another user before touching Stripe', async () => {
      (service as any).stripe = {
        paymentIntents: { retrieve: jest.fn() },
      };
      prisma.walletTopUpRequest.findUnique.mockResolvedValue({
        ...paypalRequest,
        provider: 'stripe',
        userId: 'someone-else',
      });

      await expect(
        service.confirmStripeTopUp('cust-1', {
          topUpRequestId: 'topup-1',
          paymentIntentId: 'pi_123',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect((service as any).stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
    });
  });
});
