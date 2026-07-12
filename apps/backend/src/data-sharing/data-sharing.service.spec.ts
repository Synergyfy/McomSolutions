import { Test, TestingModule } from '@nestjs/testing';
import { DataSharingService } from './data-sharing.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('DataSharingService', () => {
  let service: DataSharingService;
  let prisma: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSharingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DataSharingService>(DataSharingService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ─── getUserContext ─────────────────────────────
  describe('getUserContext', () => {
    it('should throw Error if neither email nor userId provided', async () => {
      await expect(service.getUserContext()).rejects.toThrow('Either email or userId must be provided');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getUserContext('nobody@test.com')).rejects.toThrow(NotFoundException);
    });

    it('should return user context with permissions', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'BUSINESS',
        createdAt: new Date(),
        businessProfile: {
          id: 'b1',
          businessName: 'Test Biz',
          membershipLevel: 'Silver',
          membershipTier: 'Pro',
          membershipStatus: 'active',
          phone: '123',
          address: '14 High Street',
          postcode: 'NW1',
          packages: [
            { platform: 'mall', packageName: 'Standard', status: 'active', limits: {} },
          ],
        },
      };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.getUserContext('test@test.com');
      expect(result.userId).toBe('user-1');
      expect(result.businessName).toBe('Test Biz');
      expect(result.membershipLevel).toBe('Silver');
      expect(result.permissions.canAccessMall).toBe(true);
      expect(result.packages).toHaveLength(1);
    });

    it('should return default Bronze for user without business profile', async () => {
      const mockUser = {
        id: 'user-2',
        email: 'customer@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'CUSTOMER',
        createdAt: new Date(),
        businessProfile: null,
      };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.getUserContext('customer@test.com');
      expect(result.membershipLevel).toBe('Bronze');
      expect(result.membershipStatus).toBe('active');
      expect(result.businessId).toBeNull();
    });

    it('should lookup by userId when provided', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        firstName: null,
        lastName: null,
        role: 'BUSINESS',
        createdAt: new Date(),
        businessProfile: null,
      };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      await service.getUserContext(undefined, 'user-1');
      expect(mockPrisma.user.findFirst).toHaveBeenCalled();
    });
  });

  // ─── getUserMembership ──────────────────────────
  describe('getUserMembership', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserMembership('user-nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return membership info', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        businessProfile: {
          membershipLevel: 'Gold',
          membershipTier: 'Pro+',
          membershipStatus: 'active',
        },
      });
      const result = await service.getUserMembership('user-1');
      expect(result.membershipLevel).toBe('Gold');
      expect(result.membershipTier).toBe('Pro+');
    });
  });

  // ─── getUserPackages ────────────────────────────
  describe('getUserPackages', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserPackages('user-nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return empty array if no business profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        businessProfile: null,
      });
      const result = await service.getUserPackages('user-1');
      expect(result).toEqual([]);
    });

    it('should return mapped packages', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        businessProfile: {
          packages: [
            { platform: 'mall', packageName: 'Enterprise', status: 'active', limits: { x: 1 } },
          ],
        },
      });
      const result = await service.getUserPackages('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('mall');
    });
  });

  // ─── getUserPermissions ─────────────────────────
  describe('getUserPermissions', () => {
    it('should grant all permissions to ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-admin',
        role: 'ADMIN',
        businessProfile: null,
      });
      const perms = await service.getUserPermissions('user-admin');
      expect(perms.canAccessMall).toBe(true);
      expect(perms.canAccessAudit).toBe(true);
    });

    it('should return no permissions for inactive membership', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'BUSINESS',
        businessProfile: {
          membershipLevel: 'Bronze',
          membershipStatus: 'inactive',
          packages: [],
        },
      });
      const perms = await service.getUserPermissions('user-1');
      expect(perms.canAccessMall).toBe(false);
    });

    it('should grant all permissions for Platinum membership', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'BUSINESS',
        businessProfile: {
          membershipLevel: 'Platinum',
          membershipStatus: 'active',
          packages: [],
        },
      });
      const perms = await service.getUserPermissions('user-1');
      expect(perms.canAccessExpo).toBe(true);
      expect(perms.canAccessSpin).toBe(true);
    });

    it('should grant platform access based on active packages', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'BUSINESS',
        businessProfile: {
          membershipLevel: 'Bronze',
          membershipStatus: 'active',
          packages: [
            { platform: 'mall', packageName: 'Standard', status: 'active', limits: {} },
            { platform: 'spin', packageName: 'Basic', status: 'active', limits: {} },
          ],
        },
      });
      const perms = await service.getUserPermissions('user-1');
      expect(perms.canAccessMall).toBe(true);
      expect(perms.canAccessSpin).toBe(true);
      expect(perms.canAccessRewards).toBe(false);
    });
  });

  // ─── getBulkUserContexts ────────────────────────
  describe('getBulkUserContexts', () => {
    it('should return contexts for multiple users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'a@test.com',
          firstName: null,
          lastName: null,
          role: 'BUSINESS',
          businessProfile: {
            businessName: 'Biz A',
            membershipLevel: 'Bronze',
            membershipTier: 'Normal',
            membershipStatus: 'active',
            packages: [],
          },
        },
        {
          id: 'user-2',
          email: 'b@test.com',
          firstName: 'Bob',
          lastName: 'Smith',
          role: 'CUSTOMER',
          businessProfile: null,
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.getBulkUserContexts(['a@test.com', 'b@test.com']);
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('a@test.com');
      expect(result[1].email).toBe('b@test.com');
    });
  });
});
