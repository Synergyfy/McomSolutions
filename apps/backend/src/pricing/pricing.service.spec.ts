import { Test, TestingModule } from '@nestjs/testing';
import { PricingService, MEMBERSHIP_PLANS } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: any;

  const mockPrisma = {
    businessProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    billingTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    platformPackage: {
      upsert: jest.fn(),
    },
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
  });

  // ─── getPlans ────────────────────────────────────
  describe('getPlans', () => {
    it('should return all membership plans', async () => {
      const plans = await service.getPlans();
      expect(plans).toEqual(MEMBERSHIP_PLANS);
      expect(plans).toHaveLength(4);
    });

    it('should include Bronze, Silver, Gold, Platinum', () => {
      const planIds = MEMBERSHIP_PLANS.map((p) => p.id);
      expect(planIds).toEqual(['Bronze', 'Silver', 'Gold', 'Platinum']);
    });
  });

  // ─── subscribeMembership ────────────────────────
  describe('subscribeMembership', () => {
    it('should throw NotFoundException if business not found', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.subscribeMembership('b-nonexistent', 'Bronze', 'Normal', 'monthly', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for invalid plan level', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue({ id: 'b1' });
      await expect(
        service.subscribeMembership('b1', 'InvalidLevel', 'Normal', 'monthly', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should activate subscription and create billing transaction', async () => {
      const business = { id: 'b1', businessName: 'Test Biz' };
      mockPrisma.businessProfile.findUnique.mockResolvedValue(business);
      mockPrisma.businessProfile.update.mockResolvedValue({
        ...business,
        membershipLevel: 'Bronze',
        membershipTier: 'Normal',
        membershipStatus: 'active',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Bronze', 'Normal', 'monthly', false);

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
      mockPrisma.businessProfile.findUnique.mockResolvedValue(business);
      mockPrisma.businessProfile.update.mockResolvedValue({ ...business, membershipLevel: 'Bronze', membershipTier: 'Normal', membershipStatus: 'active' });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Bronze', 'Normal', 'yearly', false);
      // Monthly: 10, Yearly: Math.floor(10 * 0.8) * 12 = 96
      expect(result.price).toBe(96);
    });

    it('should set trial status for trial subscriptions', async () => {
      const business = { id: 'b1' };
      mockPrisma.businessProfile.findUnique.mockResolvedValue(business);
      mockPrisma.businessProfile.update.mockResolvedValue({
        ...business,
        membershipLevel: 'Silver',
        membershipTier: 'Pro',
        membershipStatus: 'trial',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.subscribeMembership('b1', 'Silver', 'Pro', 'monthly', true);

      expect(result.membershipStatus).toBe('trial');
      expect(result.isTrial).toBe(true);
      expect(result.price).toBe(0);
    });
  });

  // ─── purchasePackage ────────────────────────────
  describe('purchasePackage', () => {
    it('should throw NotFoundException if business not found', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.purchasePackage('b-nonexistent', 'mall', 'starter'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert platform package and create billing transaction', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue({ id: 'b1' });
      mockPrisma.platformPackage.upsert.mockResolvedValue({
        id: 'pkg-1',
        platform: 'mall',
        packageName: 'Standard',
      });
      mockPrisma.billingTransaction.create.mockResolvedValue({});

      const result = await service.purchasePackage('b1', 'mall', 'Standard');
      expect(result.platform).toBe('mall');
      expect(result.packageName).toBe('Standard');
    });

    it('should set correct pricing for enterprise packages', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue({ id: 'b1' });
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
