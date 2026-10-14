import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      count: jest.fn().mockResolvedValue(5),
    },
    ecosystemSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    adminPayment: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    revenueRecord: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    ecosystemPlatform: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    membershipPlan: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    permissionRole: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should calculate statistics correctly', async () => {
      const result = await service.getStats();
      expect(result.success).toBe(true);
      expect(result.data.ecosystemStats.totalBusinesses).toBe(5);
      expect(result.data.ecosystemStats.totalPlatformUsers).toBe(5);
      expect(result.data.membershipStats.active).toBe(0);
      expect(result.data.revenueStats.todayRevenue).toBe(0);
    });

    it('serves cached stats within the TTL and recomputes after a write', async () => {
      const first = await service.getStats();
      await expect(service.getStats()).resolves.toBe(first);
      // Any audited write clears the cache (via logAuditTx).
      await service.logAuditTx(mockPrisma, 'Test', 'Test', 'test', 'test');
      const third = await service.getStats();
      expect(third).not.toBe(first);
      expect(third).toEqual(first);
    });
  });

  describe('getAnalytics', () => {
    beforeEach(() => {
      mockPrisma.user.count
        .mockResolvedValueOnce(10) // businesses this month
        .mockResolvedValueOnce(5) // businesses last month
        .mockResolvedValueOnce(50) // customers this month
        .mockResolvedValueOnce(25); // customers last month
    });

    it('computes period-over-period growth percentages', async () => {
      mockPrisma.adminPayment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1200 } }) // revenue this month
        .mockResolvedValueOnce({ _sum: { amount: 1000 } }); // revenue last month
      mockPrisma.adminPayment.groupBy.mockResolvedValue([
        { type: 'Membership', _sum: { amount: 700 } },
        { type: 'Package', _sum: { amount: 300 } },
      ]);

      const result = await service.getAnalytics();
      expect(result.success).toBe(true);
      expect(result.data.growth.businessGrowth).toBe(100); // (10-5)/5
      expect(result.data.growth.customerGrowth).toBe(100); // (50-25)/25
      expect(result.data.growth.revenueGrowth).toBe(20); // (1200-1000)/1000
      expect(result.data.totalRevenue).toBe(1000);
      expect(result.data.revenueBreakdown[0].type).toBe('Membership');
      expect(result.data.revenueBreakdown[0].percentage).toBe(70); // 700/1000
    });
  });

  describe('getDropdowns', () => {
    it('returns dropdown options from the database', async () => {
      mockPrisma.membershipPlan.findMany.mockResolvedValue([
        { name: 'Bronze Normal' },
        { name: 'Gold Pro' },
      ]);
      mockPrisma.ecosystemPlatform.findMany.mockResolvedValue([
        { name: 'Loyalty' },
        { name: 'Mall' },
      ]);
      mockPrisma.permissionRole.findMany.mockResolvedValue([
        { role: 'admin', permissions: { 'view_businesses': true, 'edit_businesses': false } },
      ]);

      const result = await service.getDropdowns();
      expect(result.success).toBe(true);
      expect(result.data.membershipTiers).toEqual(['Bronze Normal', 'Gold Pro']);
      expect(result.data.platforms).toEqual(['Loyalty', 'Mall']);
      expect(result.data.permissions).toContain('view_businesses');
      expect(result.data.permissions).toContain('edit_businesses');
      expect(result.data.sources).toBeInstanceOf(Array);
    });
  });

  describe('updateUserRole (G3)', () => {
    beforeEach(() => {
      const p: any = mockPrisma;
      p.user.findFirst = jest.fn();
      p.user.update = jest.fn();
      p.refreshSession = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
      p.$transaction = jest.fn(async (fn: any) => {
        if (typeof fn === 'function') {
          return fn({ ...p, auditLog: { create: jest.fn().mockResolvedValue({ id: 'a' }) } });
        }
        return Promise.all(fn);
      });
    });

    it('bumps tokenVersion and revokes refresh sessions on role change', async () => {
      const p: any = mockPrisma;
      p.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.c', role: Role.CUSTOMER });
      p.user.update.mockResolvedValue({ id: 'u1', email: 'a@b.c', role: Role.AGENT });

      const result = await service.updateUserRole('u1', Role.AGENT, 'admin');

      expect(result.success).toBe(true);
      expect(p.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ role: Role.AGENT }),
        }),
      );
      expect(p.refreshSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
      );
    });

    it('returns 404 for unknown users', async () => {
      const p: any = mockPrisma;
      p.user.findFirst.mockResolvedValue(null);

      await expect(service.updateUserRole('missing', Role.AGENT)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('createPlan/updatePlan with tiers (relational dual-write)', () => {
    beforeEach(() => {
      const p: any = mockPrisma;
      p.membershipPlan = {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      };
      p.membershipPlanTier = { upsert: jest.fn() };
      p.membershipPaymentOption = { deleteMany: jest.fn(), createMany: jest.fn() };
      p.membershipTierFeature = { deleteMany: jest.fn(), createMany: jest.fn() };
      p.membershipTierEntitlement = { deleteMany: jest.fn(), createMany: jest.fn() };
      p.membershipPlanAppBundle = { deleteMany: jest.fn(), createMany: jest.fn() };
      p.$transaction = jest.fn(async (fn: any) => {
        if (typeof fn === 'function') {
          return fn({ ...p, auditLog: { create: jest.fn().mockResolvedValue({ id: 'a' }) } });
        }
        return Promise.all(fn);
      });
    });

    const tierDto = {
      tier: 'Standard',
      fullPrice: 90,
      durationDays: 90,
      features: ['Listing'],
      entitlements: [{ resourceKey: 'campaigns', quotaValue: '20' }],
      paymentOptions: [
        { paymentPlan: 'full', mode: 'manual', manualPrice: 90 },
        { paymentPlan: 'monthly', mode: 'auto', surchargePct: 2 },
      ],
    };

    it('creates tier rows with server-computed prices and a JSON mirror', async () => {
      const p: any = mockPrisma;
      p.membershipPlan.create.mockResolvedValue({ id: 'plan-1', name: 'Gold' });
      p.membershipPlan.update.mockImplementation(async (args: any) => ({ id: 'plan-1', ...args.data }));
      p.membershipPlanTier.upsert.mockImplementation(async (args: any) => ({
        id: `tier-${args.create.tier}`,
        ...args.create,
      }));

      const result = await service.createPlan(
        {
          name: 'Gold',
          description: 'Scale',
          price: 350,
          billingCycle: 'Monthly',
          platformAccess: ['Mall'],
          usageLimits: {},
          permissions: [],
          tiers: [tierDto],
        } as any,
        'admin',
      );

      expect(result.success).toBe(true);
      expect(p.membershipPlanTier.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { planId_tier: { planId: 'plan-1', tier: 'Standard' } },
        }),
      );
      expect(p.membershipPaymentOption.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              paymentPlan: 'full', perChargePrice: 90, totalPrice: 90, installments: 1, sliceDays: 90,
            }),
            expect.objectContaining({
              paymentPlan: 'monthly', perChargePrice: 30.6, totalPrice: 91.8, installments: 3, sliceDays: 30,
            }),
          ]),
        }),
      );
      expect(p.membershipTierEntitlement.createMany).toHaveBeenCalled();
      expect(p.membershipPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tierPrices: expect.objectContaining({ Standard: 90 }),
            tierDurations: expect.objectContaining({ Standard: 90 }),
          }),
        }),
      );
    });

    it('rejects a split the tier does not support, in plain language', async () => {
      const p: any = mockPrisma;
      p.membershipPlan.create.mockResolvedValue({ id: 'plan-1', name: 'Gold' });
      p.membershipPlanTier.upsert.mockResolvedValue({ id: 'tier-1' });

      await expect(
        service.createPlan(
          {
            name: 'Gold',
            description: 'Scale',
            price: 350,
            billingCycle: 'Monthly',
            platformAccess: ['Mall'],
            usageLimits: {},
            permissions: [],
            tiers: [
              { tier: 'Standard', fullPrice: 90, paymentOptions: [{ paymentPlan: 'quarterly', mode: 'auto' }] },
            ],
          } as any,
        ),
      ).rejects.toThrow('The quarterly option is not available for the Standard tier.');
    });

    it('updatePlan never sends tiers to the plan row and merges the JSON mirror', async () => {
      const p: any = mockPrisma;
      p.membershipPlan.findUnique.mockResolvedValue({
        id: 'p1', tierPrices: { Standard: 10 }, tierFeatures: {}, tierDurations: { Standard: 90 }, tierEntitlements: [],
      });
      p.membershipPlan.update.mockImplementation(async (args: any) => ({ id: 'p1', ...args.data }));
      p.membershipPlanTier.upsert.mockResolvedValue({ id: 'tier-1' });

      await service.updatePlan(
        'p1',
        {
          description: 'New desc',
          tiers: [{ tier: 'Standard', fullPrice: 20, paymentOptions: [{ paymentPlan: 'full', mode: 'manual', manualPrice: 20 }] }],
        } as any,
        'admin',
      );

      const planUpdates = p.membershipPlan.update.mock.calls.map((c: any[]) => c[0].data);
      expect(planUpdates[0]).not.toHaveProperty('tiers');
      expect(planUpdates[0]).toMatchObject({ description: 'New desc' });
      const mirrorUpdate = planUpdates[planUpdates.length - 1];
      expect(mirrorUpdate.tierPrices).toMatchObject({ Standard: 20 });
    });
  });

  describe('deletePlan (G5)', () => {
    it('soft-deletes instead of hard-deleting', async () => {
      const p: any = mockPrisma;
      p.membershipPlan = {
        findUnique: jest.fn().mockResolvedValue({ id: 'plan-1' }),
        update: jest.fn().mockResolvedValue({ id: 'plan-1' }),
        delete: jest.fn(),
      };
      p.$transaction = jest.fn(async (fn: any) => {
        if (typeof fn === 'function') {
          return fn({ ...p, auditLog: { create: jest.fn().mockResolvedValue({ id: 'a' }) } });
        }
        return Promise.all(fn);
      });

      const result = await service.deletePlan('plan-1', 'admin');

      expect(result.success).toBe(true);
      expect(p.membershipPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(p.membershipPlan.delete).not.toHaveBeenCalled();
    });
  });
});
