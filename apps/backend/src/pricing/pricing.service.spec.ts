import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: any;

  const mockPrisma = {
    businessProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    billingTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    platformPackage: {
      upsert: jest.fn(),
    },
    membershipPlan: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    packageTemplate: {
      findFirst: jest.fn(),
    },
    ecosystemSubscription: {
      create: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    // Re-establish shared defaults (clearAllMocks wipes implementations).
    mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
    mockPrisma.billingTransaction.findUnique.mockResolvedValue(null);
  });

  // ─── getPlans ────────────────────────────────────
  describe('getPlans', () => {
    it('should return membership plans from the database', async () => {
      mockPrisma.membershipPlan.findMany.mockResolvedValue([
        { name: 'Bronze', description: 'Basic', price: 10, billingCycle: 'Monthly', platformAccess: ['Loyalty'], permissions: ['Basic Dashboard'] },
        { name: 'Silver', description: 'Advanced', price: 75, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall'], permissions: ['Standard Dashboard'] },
        { name: 'Gold', description: 'Pro', price: 350, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall', 'Rewards'], permissions: ['Full Dashboard'] },
        { name: 'Platinum', description: 'Elite', price: 1200, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall', 'Rewards', 'Audit', 'Expo'], permissions: ['Full Dashboard', 'API Access'] },
      ]);

      const plans = await service.getPlans();
      expect(plans).toHaveLength(4);
      expect(plans[0]).toMatchObject({ id: 'Bronze', price: 10, monthlyPrice: 10, quarterlyPrice: 27, annualPrice: 96 });
      expect(plans[0].features).toEqual(['Basic Dashboard']);
    });
  });

  // ─── subscribeMembership ────────────────────────
  describe('subscribeMembership', () => {
    it('should throw NotFoundException if business not found', async () => {
      mockPrisma.businessProfile.findFirst.mockResolvedValue(null);
      await expect(
        service.subscribeMembership('b-nonexistent', 'Bronze', 'Normal', 'monthly'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid plan level', async () => {
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'b1' });
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      await expect(
        service.subscribeMembership('b1', 'InvalidLevel', 'Normal', 'monthly'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should activate subscription and create billing transaction', async () => {
      const business = { id: 'b1', businessName: 'Test Biz' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ price: 10 });
      mockPrisma.businessProfile.update.mockResolvedValue({
        ...business,
        membershipLevel: 'Bronze',
        membershipTier: 'Normal',
        membershipStatus: 'active',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Bronze', 'Normal', 'monthly');

      expect(result.membershipLevel).toBe('Bronze');
      expect(result.membershipStatus).toBe('active');
      expect(result.price).toBe(10);
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 10,
            status: 'paid',
          }),
        }),
      );
    });

    it('should apply 20% yearly discount', async () => {
      const business = { id: 'b1' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ price: 10 });
      mockPrisma.businessProfile.update.mockResolvedValue({ ...business, membershipLevel: 'Bronze', membershipTier: 'Normal', membershipStatus: 'active' });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Bronze', 'Normal', 'yearly');
      // Monthly: 10, Yearly: Math.floor(10 * 0.8) * 12 = 96
      expect(result.price).toBe(96);
    });

    it('should apply 10% quarterly discount', async () => {
      const business = { id: 'b1' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ price: 10 });
      mockPrisma.businessProfile.update.mockResolvedValue({ ...business, membershipLevel: 'Bronze', membershipTier: 'Normal', membershipStatus: 'active' });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Bronze', 'Normal', 'quarterly');
      // Monthly: 10, Quarterly: Math.floor(10 * 0.9) * 3 = 27
      expect(result.price).toBe(27);
    });

    it('should auto-provision bundled platform packages with matching tier variant quotas', async () => {
      const business = { id: 'b1' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        id: 'gold-id',
        name: 'Gold',
        price: 350,
        includedApps: [
          {
            platform: 'MCOM Mall',
            planName: 'Mall Gold',
            variants: [
              { tier: 'STANDARD', configuration: { quotas: { maxListings: 10, maxProducts: 5 }, featureFlags: { priorityInSearch: false } } },
              { tier: 'PRO', configuration: { quotas: { maxListings: 25, maxProducts: 15 }, featureFlags: { priorityInSearch: true } } },
              { tier: 'PRO_PLUS', configuration: { quotas: { maxListings: 50, maxProducts: 50 }, featureFlags: { priorityInSearch: true, customBranding: true } } },
            ],
          },
        ],
      });
      mockPrisma.businessProfile.update.mockResolvedValue({ ...business, membershipLevel: 'Gold', membershipTier: 'Pro', membershipStatus: 'active' });
      mockPrisma.billingTransaction.create.mockResolvedValue({});
      mockPrisma.platformPackage = { upsert: jest.fn().mockResolvedValue({}) } as any;

      // Subscribe to Pro tier
      await service.subscribeMembership('b1', 'Gold', 'Pro', 'monthly');

      expect(mockPrisma.platformPackage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId_platform: { businessId: 'b1', platform: 'MCOM Mall' } },
          create: expect.objectContaining({
            limits: expect.objectContaining({ maxListings: 25, maxProducts: 15, priorityInSearch: true }),
            billingCycle: '180 Days',
          }),
        }),
      );
    });

    it('should auto-provision Pro+ variant quotas for Pro+ membership', async () => {
      const business = { id: 'b1' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        id: 'gold-id',
        name: 'Gold',
        price: 350,
        includedApps: [
          {
            platform: 'MCOM Mall',
            planName: 'Mall Gold',
            variants: [
              { tier: 'STANDARD', configuration: { quotas: { maxListings: 10 } } },
              { tier: 'PRO', configuration: { quotas: { maxListings: 25 } } },
              { tier: 'PRO_PLUS', configuration: { quotas: { maxListings: 100 } } },
            ],
          },
        ],
      });
      mockPrisma.businessProfile.update.mockResolvedValue({ ...business, membershipLevel: 'Gold', membershipTier: 'ProPlus', membershipStatus: 'active' });
      mockPrisma.billingTransaction.create.mockResolvedValue({});
      mockPrisma.platformPackage = { upsert: jest.fn().mockResolvedValue({}) } as any;

      await service.subscribeMembership('b1', 'Gold', 'Pro+', 'yearly');

      expect(mockPrisma.platformPackage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId_platform: { businessId: 'b1', platform: 'MCOM Mall' } },
          create: expect.objectContaining({
            limits: expect.objectContaining({ maxListings: 100 }),
            billingCycle: 'Annually',
          }),
        }),
      );
    });

    it('should always charge full price and set active status (trials removed)', async () => {
      const business = { id: 'b1' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ price: 75 });
      mockPrisma.businessProfile.update.mockResolvedValue({
        ...business,
        membershipLevel: 'Bronze',
        membershipTier: 'Normal',
        membershipStatus: 'active',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Bronze', 'Normal', 'monthly');

      expect(result.membershipStatus).toBe('active');
      expect(result).not.toHaveProperty('isTrial');
      expect(result.price).toBe(75);
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 75, status: 'paid' }),
        }),
      );
    });

    it('should write provider linkage when backed by a provider payment', async () => {
      const business = { id: 'b1' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ price: 10 });
      mockPrisma.businessProfile.update.mockResolvedValue({ ...business, membershipStatus: 'active' });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      await service.subscribeMembership('b1', 'Bronze', 'Normal', 'monthly', {
        provider: 'stripe',
        providerPaymentId: 'pi_test_123',
      });

      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'stripe',
            providerPaymentId: 'pi_test_123',
          }),
        }),
      );
    });

    it('should return current state on idempotent replay (same business)', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ price: 10 });
      mockPrisma.billingTransaction.findUnique.mockResolvedValue({
        id: 'ledger-1',
        businessId: 'b1',
        amount: 10,
      });
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'b1', membershipStatus: 'active' });

      const result = await service.subscribeMembership('b1', 'Bronze', 'Normal', 'monthly', {
        provider: 'stripe',
        providerPaymentId: 'pi_replay_1',
      });

      expect(result.replayed).toBe(true);
      expect(mockPrisma.businessProfile.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on replay for a different business', async () => {
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'b1', businessName: 'Test Biz' });
      mockPrisma.billingTransaction.findUnique.mockResolvedValue({
        id: 'ledger-1',
        businessId: 'other-biz',
        amount: 10,
      });
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ price: 10 });

      await expect(
        service.subscribeMembership('b1', 'Bronze', 'Normal', 'monthly', {
          provider: 'paypal',
          providerPaymentId: 'order_conflict_1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should assign Pro+ tier with annual expiry and tier-specific entitlements', async () => {
      const business = { id: 'b1', businessName: 'Acme Retail' };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(business);
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        id: 'plan-bronze',
        name: 'Bronze',
        price: 49,
        tierPrices: { Standard: 49, Pro: 99, 'Pro+': 180 },
        tierEntitlements: [
          { resourceKey: 'business_vcards', name: 'Business VCards', standard: 10, pro: 25, proPlus: 50 },
          { resourceKey: 'consumer_vcards', name: 'Consumer VCards', standard: 50, pro: 100, proPlus: 200 },
        ],
        includedApps: [
          { platform: 'MCOM Mall', planName: 'Bronze Suite' }
        ],
      });
      mockPrisma.businessProfile.update.mockResolvedValue({
        ...business,
        membershipLevel: 'Bronze',
        membershipTier: 'Pro+',
        membershipStatus: 'active',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Bronze', 'Pro+', 'yearly');

      expect(result.tier).toBe('Pro+');
      expect(result.price).toBe(180);
      expect(result.entitlements.business_vcards).toBe(50);
      expect(result.entitlements.consumer_vcards).toBe(200);
      expect(result.durationDays).toBeGreaterThanOrEqual(365);
      expect(mockPrisma.platformPackage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            billingCycle: 'Annually',
            limits: expect.objectContaining({ business_vcards: 50, consumer_vcards: 200 }),
          }),
        }),
      );
      expect(mockPrisma.ecosystemSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemName: 'Bronze (Pro+)',
            billingCycle: 'Annually',
            amount: 180,
          }),
        }),
      );
    });
  });

  // ─── purchasePackage ────────────────────────────
  describe('purchasePackage', () => {
    it('should throw NotFoundException if business not found', async () => {
      mockPrisma.businessProfile.findFirst.mockResolvedValue(null);
      await expect(
        service.purchasePackage('b-nonexistent', 'mall', 'starter'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if no package template exists', async () => {
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'b1' });
      mockPrisma.packageTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.purchasePackage('b1', 'mall', 'Standard'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.platformPackage.upsert).not.toHaveBeenCalled();
    });

    it('should upsert platform package and create billing transaction', async () => {
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'b1' });
      mockPrisma.packageTemplate.findFirst.mockResolvedValue({
        name: 'Standard',
        price: 29,
        usageLimits: { campaignsLimit: 1, rewardsLimit: 5 },
        billingCycle: 'monthly',
      });
      mockPrisma.platformPackage.upsert.mockResolvedValue({
        id: 'pkg-1',
        platform: 'mall',
        packageName: 'Standard',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.purchasePackage('b1', 'mall', 'Standard');
      expect(result.platform).toBe('mall');
      expect(result.packageName).toBe('Standard');
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 29 }),
        }),
      );
    });

    it('should price from the PackageTemplate catalog when available', async () => {
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'b1' });
      mockPrisma.packageTemplate.findFirst.mockResolvedValue({
        name: 'Enterprise',
        price: 199,
        usageLimits: { campaignsLimit: -1, rewardsLimit: -1 },
        billingCycle: 'monthly',
      });
      mockPrisma.platformPackage.upsert.mockResolvedValue({
        id: 'pkg-2',
        platform: 'rewards',
        packageName: 'Enterprise',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      await service.purchasePackage('b1', 'rewards', 'Enterprise');
      expect(mockPrisma.billingTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 199,
          }),
        }),
      );
    });
  });

  // ─── getTransactions ───────────────────────────
  describe('getTransactions', () => {
    it('should return transactions for a business', async () => {
      const transactions = [
        { id: 'tx-1', businessId: 'b1', amount: 10, description: 'Test', status: 'paid' },
      ];
      mockPrisma.billingTransaction.findMany.mockResolvedValue(transactions);
      const result = await service.getTransactions('b1');
      expect(result).toEqual(transactions);
      expect(mockPrisma.billingTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'b1' },
        }),
      );
    });
  });
});