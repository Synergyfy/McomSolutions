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
      expect(result.data.membershipStats.active).toBe(0);
      expect(result.data.revenueStats.todayRevenue).toBe(0);
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
});
