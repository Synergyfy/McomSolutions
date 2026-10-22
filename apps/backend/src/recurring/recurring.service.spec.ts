import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RecurringService } from './recurring.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { NotificationService } from '../notification/notification.service';
import { ServiceConnectorsService } from '../service-connectors/service-connectors.service';
import { PricingService } from '../pricing/pricing.service';
import { RedisService } from '../redis/redis.service';
import {
  RecurringChargeStatus,
  RecurringProvider,
  RecurringScope,
  RecurringStatus,
} from '@prisma/client';

const now = new Date('2026-10-22T10:00:00.000Z');

function mandate(overrides: Record<string, any> = {}) {
  return {
    id: 'm1',
    scopeKey: 'membership:b1:gold:Standard',
    scope: RecurringScope.MEMBERSHIP,
    businessId: 'b1',
    userId: 'u1',
    membershipPlanId: 'gold',
    membershipPlanName: 'Gold',
    membershipTier: 'Standard',
    level: 'Gold',
    platform: null,
    externalPlanId: null,
    provider: RecurringProvider.wallet,
    providerCustomerId: null,
    providerSubscriptionId: null,
    providerPriceId: null,
    providerPaymentIntentId: null,
    planName: 'Gold',
    billingCycle: 'monthly',
    intervalUnit: 'month',
    intervalCount: 1,
    amount: 10,
    currency: 'GBP',
    status: RecurringStatus.ACTIVE,
    autoRenew: true,
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date(now.getTime() - 30 * 24 * 3600_000),
    currentPeriodEnd: now,
    nextChargeAt: now,
    graceDays: 3,
    retryCount: 0,
    lastAttemptAt: null,
    lastError: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('RecurringService', () => {
  let service: RecurringService;

  const mockPrisma: any = {
    recurringSubscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    recurringCharge: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    billingTransaction: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    businessProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    platformPackage: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    ecosystemSubscription: {
      create: jest.fn(),
    },
  };
  mockPrisma.$transaction = jest.fn(async (cb: any) => cb(mockPrisma));

  const mockWallet = { debitWallet: jest.fn() };
  const mockWebhook = { dispatchPackageEvent: jest.fn().mockResolvedValue(undefined) };
  const mockNotifications = { createNotification: jest.fn().mockResolvedValue({}) };
  const mockConnectors = { getPlanById: jest.fn().mockResolvedValue(null) };
  const mockPricing = { resolveMembershipCharge: jest.fn() };
  const mockConfig = {
    get: jest.fn((key: string) => {
      const values: Record<string, any> = {
        STRIPE_SECRET_KEY: 'sk_test',
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client',
        PAYPAL_CLIENT_SECRET: 'secret',
        RECURRING_PAYMENTS_ENABLED: 'true',
      };
      return values[key] ?? null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
    mockPrisma.billingTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.recurringCharge.findUnique.mockResolvedValue(null);
    mockPrisma.recurringSubscription.findUnique.mockResolvedValue(mandate());
    mockPrisma.businessProfile.findFirst.mockResolvedValue({
      id: 'b1',
      userId: 'u1',
      businessName: 'Acme Ltd',
      membershipExpiresAt: null,
      membershipPlanName: 'Gold',
    });
    mockPrisma.businessProfile.findUnique.mockResolvedValue({ userId: 'u1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WalletService, useValue: mockWallet },
        { provide: WebhookDispatcherService, useValue: mockWebhook },
        { provide: NotificationService, useValue: mockNotifications },
        { provide: ServiceConnectorsService, useValue: mockConnectors },
        { provide: PricingService, useValue: mockPricing },
        { provide: RedisService, useValue: { setNx: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get(RecurringService);
  });

  it('charges the wallet and extends membership for a due mandate', async () => {
    mockWallet.debitWallet.mockResolvedValue({ transactionId: 'wallet-tx-1' });

    const result = await service.attemptWalletRenewal('m1');

    expect(result.charged).toBe(true);
    expect(mockWallet.debitWallet).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'mcom-central' }),
      expect.objectContaining({ userId: 'u1', amount: 10 }),
      expect.stringMatching(/^renewal:m1:/),
    );
    expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerPaymentId: 'wallet-tx-1', status: 'paid' }),
      }),
    );
    expect(mockPrisma.recurringCharge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: RecurringChargeStatus.PAID }),
      }),
    );
    expect(mockPrisma.recurringSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RecurringStatus.ACTIVE }),
      }),
    );
  });

  it('marks a mandate past due when the wallet cannot cover it', async () => {
    mockWallet.debitWallet.mockRejectedValue({
      response: { data: { error: 'INSUFFICIENT_BALANCE' } },
    });

    const result = await service.attemptWalletRenewal('m1');

    expect(result.charged).toBe(false);
    expect(mockPrisma.recurringSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RecurringStatus.PAST_DUE }),
      }),
    );
    expect(mockPrisma.businessProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { membershipStatus: 'past_due' } }),
    );
    expect(mockNotifications.createNotification).toHaveBeenCalled();
  });

  it('extends access from a Stripe invoice.paid webhook exactly once', async () => {
    const stripeMandate = mandate({
      provider: RecurringProvider.stripe,
      providerSubscriptionId: 'sub_1',
      userId: 'u1',
    });
    mockPrisma.recurringSubscription.findUnique.mockResolvedValue(stripeMandate);

    const event: any = {
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          subscription: 'sub_1',
          period_start: Math.floor(now.getTime() / 1000),
          period_end: Math.floor(new Date('2026-11-22T10:00:00Z').getTime() / 1000),
          amount_paid: 1000,
          payment_intent: 'pi_1',
        },
      },
    };

    await service.handleStripeEvent(event);

    expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerPaymentId: 'pi_1',
          amount: 10,
          status: 'paid',
        }),
      }),
    );
    expect(mockPrisma.recurringSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RecurringStatus.ACTIVE,
          currentPeriodEnd: new Date('2026-11-22T10:00:00.000Z'),
        }),
      }),
    );
  });

  it('expires a platform mandate and dispatches package.expired', async () => {
    const platformMandate = mandate({
      id: 'm2',
      scope: RecurringScope.PLATFORM,
      platform: 'mall',
      externalPlanId: 'plan-1',
      planName: 'Mall Standard',
      provider: RecurringProvider.stripe,
      providerSubscriptionId: 'sub_2',
    });
    mockPrisma.recurringSubscription.findUnique.mockResolvedValue(platformMandate);
    mockPrisma.platformPackage.findUnique.mockResolvedValue({
      id: 'pkg-1',
      businessId: 'b1',
      platform: 'mall',
      packageName: 'Mall Standard',
      status: 'active',
      billingCycle: 'monthly',
      amount: 10,
      currency: 'GBP',
      limits: {},
    });

    await service.expireMandate('m2', 'term ended');

    expect(mockPrisma.recurringSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RecurringStatus.EXPIRED, autoRenew: false }),
      }),
    );
    expect(mockPrisma.platformPackage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'expired' }) }),
    );
    expect(mockWebhook.dispatchPackageEvent).toHaveBeenCalledWith(
      'package.expired',
      expect.objectContaining({ platform: 'mall' }),
    );
  });
});
