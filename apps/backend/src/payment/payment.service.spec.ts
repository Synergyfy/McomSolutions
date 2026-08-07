import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { InternalServerErrorException } from '@nestjs/common';

const mockSetupIntents = {
  create: jest.fn().mockResolvedValue({ client_secret: 'seti_mock_secret' }),
};

const mockPaymentIntents = {
  create: jest.fn().mockResolvedValue({ client_secret: 'pi_mock_secret' }),
  retrieve: jest.fn().mockResolvedValue({ status: 'succeeded' }),
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    setupIntents: mockSetupIntents,
    paymentIntents: mockPaymentIntents,
  }));
});

const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: (...args: any[]) => mockAxiosPost(...args),
}));

describe('PaymentService', () => {
  let service: PaymentService;
  let configService: any;
  let pricingService: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        STRIPE_SECRET_KEY: 'sk_test_mock',
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'mock-paypal-client-id',
        PAYPAL_CLIENT_SECRET: 'mock-paypal-client-secret',
      };
      return config[key] ?? null;
    }),
  };

  const mockPricingService = {
    subscribeMembership: jest.fn(),
  };

  const mockPrisma = {
    businessProfile: {},
    billingTransaction: {},
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PricingService, useValue: mockPricingService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    configService = module.get(ConfigService);
    pricingService = module.get(PricingService);
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
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(
        badService.stripeInitiate('b1', 'Bronze', 'Normal', 'monthly', false),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should return setup intent for trial', async () => {
      const result = await service.stripeInitiate('b1', 'Bronze', 'Normal', 'monthly', true);
      expect(result.type).toBe('setup');
      expect(result.clientSecret).toBe('seti_mock_secret');
    });

    it('should return payment intent for non-trial', async () => {
      const result = await service.stripeInitiate('b1', 'Bronze', 'Normal', 'monthly', false);
      expect(result.type).toBe('payment');
      expect(result.clientSecret).toBe('pi_mock_secret');
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
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(
        badService.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_mock', false),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should subscribe membership for trial', async () => {
      mockPricingService.subscribeMembership.mockResolvedValue({ membershipLevel: 'Bronze' });

      const result = await service.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_mock', true);

      expect(mockPricingService.subscribeMembership).toHaveBeenCalledWith(
        'b1', 'Bronze', 'Normal', 'monthly', true,
      );
      expect(result.membershipLevel).toBe('Bronze');
    });

    it('should retrieve payment intent and subscribe for non-trial', async () => {
      mockPricingService.subscribeMembership.mockResolvedValue({ membershipLevel: 'Silver' });

      const result = await service.stripeConfirm('b1', 'Silver', 'Pro', 'monthly', 'pi_mock', false);

      expect(mockPaymentIntents.retrieve).toHaveBeenCalledWith('pi_mock');
      expect(mockPricingService.subscribeMembership).toHaveBeenCalledWith(
        'b1', 'Silver', 'Pro', 'monthly', false,
      );
      expect(result.membershipLevel).toBe('Silver');
    });

    it('should throw if payment not succeeded', async () => {
      mockPaymentIntents.retrieve.mockResolvedValue({ status: 'requires_payment_method' });
      mockPricingService.subscribeMembership.mockResolvedValue({});

      await expect(
        service.stripeConfirm('b1', 'Bronze', 'Normal', 'monthly', 'pi_failed', false),
      ).rejects.toThrow('Payment not completed');
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
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(
        badService.paypalInitiate('b1', 'Bronze', 'Normal', 'monthly', 'https://example.com/return', 'https://example.com/cancel', false),
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
        'https://example.com/return', 'https://example.com/cancel', false,
      );

      expect(result.orderId).toBe('order-123');
      expect(result.approvalUrl).toBe('https://paypal.com/checkout?token=order-123');
    });
  });

  // ─── paypalCapture ───────────────────────────
  describe('paypalCapture', () => {
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
        ],
      }).compile();
      const badService = badModule.get<PaymentService>(PaymentService);

      await expect(badService.paypalCapture('order-123')).rejects.toThrow();
    });

    it('should capture order and subscribe membership', async () => {
      mockAxiosPost
        .mockResolvedValueOnce({ data: { access_token: 'paypal-token' } })
        .mockResolvedValueOnce({
          data: {
            purchase_units: [{
              custom_id: 'b1|Gold|Pro|yearly|false',
            }],
          },
        });
      mockPricingService.subscribeMembership.mockResolvedValue({ membershipLevel: 'Gold' });

      const result = await service.paypalCapture('order-123');
      expect(result.membershipLevel).toBe('Gold');
      expect(mockPricingService.subscribeMembership).toHaveBeenCalledWith(
        'b1', 'Gold', 'Pro', 'yearly', false,
      );
    });

    it('should throw if custom_id missing metadata', async () => {
      mockAxiosPost
        .mockResolvedValueOnce({ data: { access_token: 'paypal-token' } })
        .mockResolvedValueOnce({
          data: {
            purchase_units: [{ custom_id: '' }],
          },
        });

      await expect(service.paypalCapture('order-456')).rejects.toThrow(
        'PayPal order metadata is missing',
      );
    });
  });
});
