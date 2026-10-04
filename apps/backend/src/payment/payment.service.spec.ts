import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceConnectorsService } from '../service-connectors/service-connectors.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { RedisService } from '../redis/redis.service';
import { InternalServerErrorException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

const mockSetupIntents = {
  create: jest.fn().mockResolvedValue({ client_secret: 'seti_mock_secret' }),
  retrieve: jest.fn().mockResolvedValue({ status: 'succeeded' }),
};

const mockPaymentIntents = {
  create: jest.fn().mockResolvedValue({ client_secret: 'pi_mock_secret' }),
  retrieve: jest.fn(),
};

const mockStripeWebhooks = {
  constructEvent: jest.fn(),
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    setupIntents: mockSetupIntents,
    paymentIntents: mockPaymentIntents,
    webhooks: mockStripeWebhooks,
  }));
});

const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();
jest.mock('axios', () => ({
  post: (...args: any[]) => mockAxiosPost(...args),
  get: (...args: any[]) => mockAxiosGet(...args),
}));

describe('PaymentService', () => {
  let service: PaymentService;
  let configService: any;
  let pricingService: any;

  const mockWebhookDispatcher = {
    dispatchPackageEvent: jest.fn().mockResolvedValue(undefined),
    dispatch: jest.fn().mockResolvedValue({ dispatched: true }),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        STRIPE_SECRET_KEY: 'sk_test_mock',
        STRIPE_WEBHOOK_SECRET: 'whsec_mock',
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'mock-paypal-client-id',
        PAYPAL_CLIENT_SECRET: 'mock-paypal-client-secret',
      };
      return config[key] ?? null;
    }),
  };

  const mockPricingService = {
    subscribeMembership: jest.fn(),
    resolveMembershipPrice: jest.fn().mockResolvedValue(10),
  };

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
    },
    businessProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    platformPackage: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    billingTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentOutbox: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  const mockConnectorsService = {
    syncMembership: jest.fn(),
    syncPackage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PricingService, useValue: mockPricingService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ServiceConnectorsService, useValue: mockConnectorsService },
        { provide: WebhookDispatcherService, useValue: mockWebhookDispatcher },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    configService = module.get(ConfigService);
    pricingService = module.get(PricingService);
    // Re-establish shared defaults (clearAllMocks wipes implementations).
    mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
    mockPrisma.billingTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.platformPackage.findFirst.mockResolvedValue(null);
    mockPaymentIntents.retrieve.mockResolvedValue({
      status: 'succeeded',
      amount: 1000,
      currency: 'gbp',
      metadata: { businessId: 'b1' },
    });
  });

  // ─── stripeInitiate ──────────────────────────
  describe('stripeInitiate', () => {
    it('should throw if Stripe not configured', async () => {
      const badModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
          { provide: PricingService, useValue: mockPricingService },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ServiceConnectorsService, useValue: mockConnectorsService },
          { provide: WebhookDispatcherService, useValue: mockWebhookDispatcher },
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(
        badService.stripeInitiate('b1', 'Bronze', 'Normal', 'monthly'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should return payment intent (trials removed — always a real charge)', async () => {
      const result = await service.stripeInitiate('b1', 'Bronze', 'Normal', 'monthly');
      expect(result.type).toBe('payment');
      expect(result.clientSecret).toBe('pi_mock_secret');
      expect(mockSetupIntents.create).not.toHaveBeenCalled();
    });
  });

  // ─── stripeConfirm ───────────────────────────
  describe('stripeConfirm', () => {
    it('should throw if Stripe not configured', async () => {
      const badModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
          { provide: PricingService, useValue: mockPricingService },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ServiceConnectorsService, useValue: mockConnectorsService },
          { provide: WebhookDispatcherService, useValue: mockWebhookDispatcher },
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(
        badService.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_mock'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should verify amount/metadata and subscribe with ledger linkage', async () => {
      // Mocked plan price is 10 GBP = 1000 pence (matches the default intent mock).
      mockPricingService.subscribeMembership.mockResolvedValue({ membershipLevel: 'Silver' });

      const result = await service.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_mock', {
        userId: 'u1',
        businessId: 'b1',
      });

      expect(mockPaymentIntents.retrieve).toHaveBeenCalledWith('pi_mock');
      expect(mockPricingService.subscribeMembership).toHaveBeenCalledWith(
        'b1', 'Bronze', 'Normal', 'monthly',
        { provider: 'stripe', providerPaymentId: 'pi_mock' },
      );
      expect(result.membershipLevel).toBe('Silver');
    });

    it('should throw if payment not succeeded', async () => {
      mockPaymentIntents.retrieve.mockResolvedValue({ status: 'requires_payment_method' });
      mockPricingService.subscribeMembership.mockResolvedValue({});

      await expect(
        service.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_failed'),
      ).rejects.toThrow('Payment not completed');
    });

    it('should throw Forbidden if intent belongs to another business', async () => {
      mockPaymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
        amount: 1000,
        currency: 'gbp',
        metadata: { businessId: 'other-biz' },
      });

      await expect(
        service.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_mock', {
          userId: 'u1',
          businessId: 'b1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if paid amount does not match plan price', async () => {
      mockPaymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
        amount: 1,
        currency: 'gbp',
        metadata: { businessId: 'b1' },
      });

      await expect(
        service.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_mock'),
      ).rejects.toThrow('Paid amount does not match');
    });
  });

  // ─── PayPal ──────────────────────────────────
  describe('paypalInitiate', () => {
    it('should throw if PayPal credentials missing', async () => {
      const badModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PAYPAL_ENV') return 'sandbox';
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
                return null;
              }),
            },
          },
          { provide: PricingService, useValue: mockPricingService },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ServiceConnectorsService, useValue: mockConnectorsService },
          { provide: WebhookDispatcherService, useValue: mockWebhookDispatcher },
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(
        badService.paypalInitiate('b1', 'Bronze', 'Normal', 'monthly', 'https://example.com/return', 'https://example.com/cancel'),
      ).rejects.toThrow('PayPal credentials are not configured.');
    });

    it('should create PayPal order with approval URL', async () => {
      mockAxiosPost
        .mockResolvedValueOnce({ data: { access_token: 'paypal-token' } })
        .mockResolvedValueOnce({
          data: {
            id: 'order-123',
            links: [{ rel: 'approve', href: 'https://paypal.com/checkout?token=order-123' }],
          },
        });

      const result = await service.paypalInitiate(
        'b1', 'Gold', 'Pro', 'yearly',
        'https://example.com/return', 'https://example.com/cancel',
      );

      expect(result.orderId).toBe('order-123');
      expect(result.approvalUrl).toBe('https://paypal.com/checkout?token=order-123');
      // custom_id carries no trial segment anymore
      const orderBody = mockAxiosPost.mock.calls[1][1];
      expect(orderBody.purchase_units[0].custom_id).toBe('b1|Gold|Pro|yearly');
    });
  });

  // ─── paypalCapture ───────────────────────────
  describe('paypalCapture', () => {
    const caller = { userId: 'u1', businessId: 'b1' };
    // Mocked plan price is 10 GBP everywhere in this suite.
    const approvedOrder = {
      data: {
        id: 'order-123',
        purchase_units: [{
          custom_id: 'b1|Gold|Pro|yearly',
          amount: { currency_code: 'GBP', value: '10.00' },
        }],
      },
    };
    const capturedOrder = {
      data: {
        purchase_units: [{
          custom_id: 'b1|Gold|Pro|yearly',
          payments: { captures: [{ amount: { currency_code: 'GBP', value: '10.00' } }] },
        }],
      },
    };

    it('should throw if PayPal credentials missing', async () => {
      const badModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PAYPAL_ENV') return 'sandbox';
                if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock';
                return null;
              }),
            },
          },
          { provide: PricingService, useValue: mockPricingService },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ServiceConnectorsService, useValue: mockConnectorsService },
          { provide: WebhookDispatcherService, useValue: mockWebhookDispatcher },
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(badService.paypalCapture('order-123', caller)).rejects.toThrow();
    });

    it('should verify, capture and subscribe membership', async () => {
      mockAxiosPost
        .mockResolvedValueOnce({ data: { access_token: 'paypal-token' } })
        .mockResolvedValueOnce(capturedOrder);
      mockAxiosGet.mockResolvedValueOnce(approvedOrder);
      mockPricingService.subscribeMembership.mockResolvedValue({ membershipLevel: 'Gold' });

      const result = await service.paypalCapture('order-123', caller);
      expect(result.membershipLevel).toBe('Gold');
      expect(mockPricingService.subscribeMembership).toHaveBeenCalledWith(
        'b1', 'Gold', 'Pro', 'yearly',
        { provider: 'paypal', providerPaymentId: 'order-123' },
      );
    });

    it('should throw if custom_id missing metadata', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { access_token: 'paypal-token' } });
      mockAxiosGet.mockResolvedValueOnce({
        data: { id: 'order-456', purchase_units: [{ custom_id: '' }] },
      });

      await expect(service.paypalCapture('order-456', caller)).rejects.toThrow(
        'PayPal order metadata is missing',
      );
    });

    it('should reject legacy trial orders', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { access_token: 'paypal-token' } });
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          id: 'order-trial',
          purchase_units: [{
            custom_id: 'b1|Gold|Pro|yearly|true',
            amount: { currency_code: 'GBP', value: '1.00' },
          }],
        },
      });

      await expect(service.paypalCapture('order-trial', caller)).rejects.toThrow(
        'Trial orders are no longer supported',
      );
    });

    it('should throw Forbidden when capturing another business order', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { access_token: 'paypal-token' } });
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          id: 'order-foreign',
          purchase_units: [{
            custom_id: 'other-biz|Gold|Pro|yearly',
            amount: { currency_code: 'GBP', value: '10.00' },
          }],
        },
      });

      await expect(
        service.paypalCapture('order-foreign', caller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if approved amount does not match plan price', async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { access_token: 'paypal-token' } });
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          id: 'order-cheap',
          purchase_units: [{
            custom_id: 'b1|Gold|Pro|yearly',
            amount: { currency_code: 'GBP', value: '0.01' },
          }],
        },
      });

      await expect(service.paypalCapture('order-cheap', caller)).rejects.toThrow(
        'Approved amount does not match',
      );
    });

    it('should return current state on idempotent replay (same business)', async () => {
      mockPrisma.billingTransaction.findUnique.mockResolvedValue({
        id: 'ledger-1',
        businessId: 'b1',
        amount: 10,
      });
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'b1' });

      const result = await service.paypalCapture('order-replayed', caller);

      expect(result.replayed).toBe(true);
      expect(mockAxiosPost).not.toHaveBeenCalled();
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });

    it('should throw Conflict on replay for a different business', async () => {
      mockPrisma.billingTransaction.findUnique.mockResolvedValue({
        id: 'ledger-1',
        businessId: 'other-biz',
        amount: 10,
      });

      await expect(service.paypalCapture('order-replayed', caller)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── platformStripeConfirm ──
  describe('platformStripeConfirm', () => {
    it('should upsert package and dispatch package.created webhook', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue({ id: 'bp-1' });
      mockConnectorsService.syncPackage.mockResolvedValue(undefined);
      jest.spyOn(service as any, 'resolveBusinessId').mockResolvedValue('bp-1');
      jest.spyOn(service as any, 'resolvePlatformPlanPrice').mockReturnValue(29.99);

      const mockPlan = {
        id: 'plan-1',
        name: 'Pro',
        monthlyPrice: 29.99,
        quarterlyPrice: 79.99,
        annualPrice: 299.99,
        type: 'STANDARD',
        configuration: { quotas: { maxLinks: 100 } },
      };
      (mockConnectorsService as any).getPlanById = jest.fn().mockResolvedValue(mockPlan);

      const createdPackage = {
        id: 'pkg-123',
        packageName: 'Pro',
        externalPlanId: 'plan-1',
        status: 'active',
      };
      mockPrisma.platformPackage.upsert.mockResolvedValue(createdPackage);
      mockPrisma.billingTransaction.create.mockResolvedValue({ id: 'ledger-1' });
      mockPaymentIntents.retrieve.mockResolvedValue({
        status: 'succeeded',
        amount: 2999,
        currency: 'gbp',
        metadata: { businessId: 'bp-1' },
      });

      await service.platformStripeConfirm('user-123', 'links', 'plan-1', 'monthly', 'pi_mock_123');

      expect(mockWebhookDispatcher.dispatchPackageEvent).toHaveBeenCalledWith(
        'package.created',
        expect.objectContaining({
          platform: 'links',
          userId: 'user-123',
          package: createdPackage,
        }),
      );
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: 'stripe', providerPaymentId: 'pi_mock_123' }),
        }),
      );
    });

    it('should reject TRIAL plans', async () => {
      jest.spyOn(service as any, 'resolveBusinessId').mockResolvedValue('bp-1');
      (mockConnectorsService as any).getPlanById = jest.fn().mockResolvedValue({
        id: 'plan-trial',
        name: 'Trial',
        type: 'TRIAL',
      });

      await expect(
        service.platformStripeConfirm('user-123', 'links', 'plan-trial', 'monthly', 'pi_mock_123'),
      ).rejects.toThrow('Trial plans are no longer supported');
    });
  });

  // ─── Stripe webhook ──
  describe('handleStripeWebhook', () => {
    it('should activate membership on payment_intent.succeeded', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_webhook_1',
            amount: 1000,
            currency: 'gbp',
            metadata: { businessId: 'b1', level: 'Bronze', tier: 'Normal', billing: 'monthly' },
          },
        },
      });
      mockPricingService.subscribeMembership.mockResolvedValue({ membershipLevel: 'Bronze' });

      const result = await service.handleStripeWebhook('raw-body', 'sig_123');

      expect(result).toEqual({ received: true });
      expect(mockPricingService.subscribeMembership).toHaveBeenCalledWith(
        'b1', 'Bronze', 'Normal', 'monthly',
        { provider: 'stripe', providerPaymentId: 'pi_webhook_1' },
      );
    });

    it('should throw on invalid signature', async () => {
      mockStripeWebhooks.constructEvent.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(service.handleStripeWebhook('raw-body', 'bad-sig')).rejects.toThrow(
        'Invalid webhook signature',
      );
    });

    it('should ack poison events without throwing', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        id: 'evt_poison',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_poison', amount: 1000, currency: 'gbp', metadata: {} } },
      });

      const result = await service.handleStripeWebhook('raw-body', 'sig_123');

      expect(result).toEqual({ received: true });
      expect(mockPricingService.subscribeMembership).not.toHaveBeenCalled();
    });

    it('should ignore unhandled event types', async () => {
      mockStripeWebhooks.constructEvent.mockReturnValue({
        id: 'evt_other',
        type: 'customer.created',
        data: { object: {} },
      });

      const result = await service.handleStripeWebhook('raw-body', 'sig_123');

      expect(result).toEqual({ received: true });
    });
  });

  // ─── G1: PayPal outbox reconcile ──
  describe('drainPaymentOutbox', () => {
    it('marks DONE without activation when the ledger row already exists', async () => {
      (mockPrisma.paymentOutbox.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'row-1', providerPaymentId: 'order-1', kind: 'membership', businessId: 'b1', payload: {}, attempts: 0 },
      ]);
      mockPrisma.billingTransaction.findUnique.mockResolvedValueOnce({ id: 'ledger-1' });

      await service.drainPaymentOutbox();

      expect(mockPrisma.paymentOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'row-1' }, data: expect.objectContaining({ status: 'DONE' }) }),
      );
      expect(mockPricingService.subscribeMembership).not.toHaveBeenCalled();
    });

    it('parks a capture whose activation write fails (ServiceUnavailable)', async () => {
      const caller = { userId: 'u1', businessId: 'b1' };
      mockAxiosPost
        .mockResolvedValueOnce({ data: { access_token: 'paypal-token' } }) // token
        .mockResolvedValueOnce({ data: { purchase_units: [{ custom_id: 'b1|Gold|Pro|yearly', payments: { captures: [] } }] } }); // capture
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          id: 'order-park',
          purchase_units: [{
            custom_id: 'b1|Gold|Pro|yearly',
            amount: { currency_code: 'GBP', value: '10.00' },
          }],
        },
      });
      mockPrisma.billingTransaction.findUnique.mockResolvedValue(null);
      mockPricingService.resolveMembershipPrice.mockResolvedValue(10);
      mockPricingService.subscribeMembership.mockRejectedValueOnce(new Error('db down'));

      await expect(service.paypalCapture('order-park', caller as any)).rejects.toThrow(
        'reconciliation',
      );
      expect(mockPrisma.paymentOutbox.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerPaymentId: 'order-park' },
        }),
      );
    });

    it('activates from read data on ORDER_ALREADY_CAPTURED retry', async () => {
      const caller = { userId: 'u1', businessId: 'b1' };
      mockAxiosPost
        .mockResolvedValueOnce({ data: { access_token: 'paypal-token' } }) // token
        .mockRejectedValueOnce({ response: { status: 422, data: { name: 'ORDER_ALREADY_CAPTURED' } } }); // capture
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          id: 'order-retry',
          purchase_units: [{
            custom_id: 'b1|Gold|Pro|yearly',
            amount: { currency_code: 'GBP', value: '10.00' },
          }],
        },
      });
      mockPrisma.billingTransaction.findUnique.mockResolvedValue(null);
      mockPricingService.resolveMembershipPrice.mockResolvedValue(10);
      mockPricingService.subscribeMembership.mockResolvedValueOnce({ membershipLevel: 'Gold' });

      const result = await service.paypalCapture('order-retry', caller as any);

      expect(mockPricingService.subscribeMembership).toHaveBeenCalledWith(
        'b1', 'Gold', 'Pro', 'yearly',
        expect.objectContaining({ provider: 'paypal', providerPaymentId: 'order-retry' }),
      );
      expect(result).toEqual(expect.objectContaining({ membershipLevel: 'Gold' }));
    });
  });
});
