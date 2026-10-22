import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SsoService, EntitlementUser, EntitlementClient } from './sso.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('SsoService - Entitlement & Trial Protocol', () => {
  let service: SsoService;

  const mockPrisma = {
    membershipPlan: {
      findFirst: jest.fn(),
    },
    taskDefinition: {
      findMany: jest.fn(),
    },
    ssoClient: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    programmeSetting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SSO_JWT_SECRET') return 'test-sso-secret';
      if (key === 'FRONTEND_URL') return 'https://mcomcentral.co.uk';
      return null;
    }),
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.programmeSetting.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<SsoService>(SsoService);
  });

  const testClient: EntitlementClient = {
    id: 'client_mall_1',
    clientId: 'mcom-mall',
    platformSlug: 'mall',
    name: 'MCOM Mall',
  };

  describe('resolveEntitlements', () => {
    it('grants PAID_MEMBERSHIP access when client is included in active membership plan', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        name: 'Gold',
        includedApps: [
          {
            platform: 'MCOM Mall',
            clientId: 'mcom-mall',
            planId: 'mall-pro',
            planName: 'Vendor Pro',
            quotas: { productLimit: 100 },
          },
        ],
      });
      mockPrisma.taskDefinition.findMany.mockResolvedValue([]);

      const user: EntitlementUser = {
        id: 'usr_1',
        email: 'merchant@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_1',
          businessName: 'Apex Store',
          membershipLevel: 'Gold',
          membershipStatus: 'active',
          membershipPlanName: 'Gold',
          hasPaidVerificationFee: true,
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement).not.toBeNull();
      expect(result.entitlement?.access.hasAccess).toBe(true);
      expect(result.entitlement?.access.accessType).toBe('PAID_MEMBERSHIP');
      expect(result.entitlement?.plan?.planId).toBe('mall-pro');
      expect(result.entitlement?.plan?.planName).toBe('Vendor Pro');
      expect(result.entitlement?.plan?.source).toBe('membership');
      expect(result.entitlement?.membershipContext.isIncludedInMembership).toBe(true);
    });

    it('denies access with PLATFORM_NOT_IN_MEMBERSHIP when active membership does not include the platform', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        name: 'Bronze',
        includedApps: [
          {
            platform: 'MCOM Rewards',
            clientId: 'mcom-rewards',
            planId: 'rewards-standard',
            planName: 'Standard',
          },
        ],
      });
      // No trial tasks
      mockPrisma.taskDefinition.findMany.mockResolvedValue([]);

      const user: EntitlementUser = {
        id: 'usr_2',
        email: 'merchant2@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_2',
          businessName: 'Cafe London',
          membershipLevel: 'Bronze',
          membershipStatus: 'active',
          membershipPlanName: 'Bronze',
          hasPaidVerificationFee: false,
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement).not.toBeNull();
      expect(result.entitlement?.access.hasAccess).toBe(false);
      expect(result.entitlement?.access.accessType).toBe('NONE');
      expect(result.entitlement?.access.reason).toBe('PLATFORM_NOT_IN_MEMBERSHIP');
      expect(result.entitlement?.access.upgradeUrl).toContain('/dashboard/memberships');
      expect(result.entitlement?.membershipContext.isIncludedInMembership).toBe(false);
    });

    it('grants TRIAL_PROGRAMME access during active trial when platform has active task in programme', async () => {
      // No paid membership
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);

      // Active task exists for MCOM Mall in TaskEngine
      mockPrisma.taskDefinition.findMany.mockResolvedValue([
        {
          id: 'task_mall_1',
          title: 'Setup Store Profile',
          description: 'Upload banner and logo on MCOM Mall',
          deadlineDays: 7,
          rewardPoints: 50,
          assignments: [{ status: 'PENDING' }],
        },
      ]);

      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days remaining
      const user: EntitlementUser = {
        id: 'usr_3',
        email: 'trialuser@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_3',
          businessName: 'New Merchant',
          membershipStatus: 'active',
          membershipPlanName: null,
          hasPaidVerificationFee: true,
          verificationFeePaidAt: new Date(),
          trialAccessDays: 14,
          trialAccessExpiresAt: futureDate,
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement).not.toBeNull();
      expect(result.entitlement?.access.hasAccess).toBe(true);
      expect(result.entitlement?.access.accessType).toBe('TRIAL_PROGRAMME');
      expect(result.entitlement?.trialContext.isInTrial).toBe(true);
      expect(result.entitlement?.trialContext.daysRemaining).toBeGreaterThanOrEqual(9);
      expect(result.entitlement?.trialContext.programmeTasks).toHaveLength(1);
      expect(result.entitlement?.trialContext.programmeTasks[0].taskId).toBe('task_mall_1');
      expect(result.appPlan?.source).toBe('trial');
    });

    it('grants TRIAL_PROGRAMME (not PAID_MEMBERSHIP) when user has membershipLevel="Gold" but no paid membershipPlanName', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        name: 'Gold',
        includedApps: [
          {
            platform: 'MCOM Mall',
            clientId: 'mcom-mall',
            planId: 'mall-pro',
            planName: 'Vendor Pro',
          },
        ],
      });

      mockPrisma.taskDefinition.findMany.mockResolvedValue([
        {
          id: 'task_mall_1',
          title: 'Setup Store Profile',
          description: 'Upload banner and logo on MCOM Mall',
          deadlineDays: 7,
          rewardPoints: 50,
          assignments: [{ status: 'PENDING' }],
        },
      ]);

      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const user: EntitlementUser = {
        id: 'usr_trial_gold',
        email: 'trialgold@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_trial_gold',
          businessName: 'Trial Gold Merchant',
          membershipLevel: 'Gold',
          membershipStatus: 'active',
          membershipPlanName: null, // Did not purchase Gold membership
          hasPaidVerificationFee: true,
          verificationFeePaidAt: new Date(),
          trialAccessDays: 14,
          trialAccessExpiresAt: futureDate,
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement).not.toBeNull();
      expect(result.entitlement?.access.hasAccess).toBe(true);
      expect(result.entitlement?.access.accessType).toBe('TRIAL_PROGRAMME');
      expect(result.entitlement?.trialContext.isInTrial).toBe(true);
      expect(result.entitlement?.membershipContext.isIncludedInMembership).toBe(false);
      expect(result.entitlement?.membershipContext.membershipPlanName).toBeNull();
      expect(result.entitlement?.plan?.planName).toBe('Programme Trial Access');
      expect(result.entitlement?.plan?.source).toBe('trial');
    });

    it('denies trial access with TRIAL_NO_TASKS when platform has NO tasks in programme', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      // Platform has NO tasks configured
      mockPrisma.taskDefinition.findMany.mockResolvedValue([]);

      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const user: EntitlementUser = {
        id: 'usr_4',
        email: 'trialuser2@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_4',
          businessName: 'Unassigned App Merchant',
          membershipStatus: 'active',
          hasPaidVerificationFee: true,
          trialAccessExpiresAt: futureDate,
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement).not.toBeNull();
      expect(result.entitlement?.access.hasAccess).toBe(false);
      expect(result.entitlement?.access.accessType).toBe('NONE');
      expect(result.entitlement?.access.reason).toBe('TRIAL_NO_TASKS');
    });

    it('denies access with TRIAL_EXPIRED when trial period has elapsed', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      mockPrisma.taskDefinition.findMany.mockResolvedValue([
        {
          id: 'task_mall_1',
          title: 'Setup Store Profile',
          description: 'Upload banner',
          deadlineDays: 7,
          rewardPoints: 50,
          assignments: [],
        },
      ]);

      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // expired 2 days ago
      const user: EntitlementUser = {
        id: 'usr_5',
        email: 'expireduser@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_5',
          businessName: 'Expired Merchant',
          hasPaidVerificationFee: true,
          trialAccessExpiresAt: pastDate,
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement).not.toBeNull();
      expect(result.entitlement?.access.hasAccess).toBe(false);
      expect(result.entitlement?.access.accessType).toBe('NONE');
      expect(result.entitlement?.access.reason).toBe('TRIAL_EXPIRED');
    });

    it('denies access with UNVERIFIED when business has not paid verification fee', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      mockPrisma.taskDefinition.findMany.mockResolvedValue([]);

      const user: EntitlementUser = {
        id: 'usr_6',
        email: 'unverified@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_6',
          businessName: 'Unverified Merchant',
          hasPaidVerificationFee: false,
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement).not.toBeNull();
      expect(result.entitlement?.access.hasAccess).toBe(false);
      expect(result.entitlement?.access.reason).toBe('UNVERIFIED');
      expect(result.entitlement?.access.upgradeUrl).toContain('/dashboard?action=verify');
    });

    it('grants TRIAL_PROGRAMME from signup when verification is optional', async () => {
      const DAY = 24 * 60 * 60 * 1000;
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      mockPrisma.taskDefinition.findMany.mockResolvedValue([
        {
          id: 'task_mall_1',
          title: 'Setup Store Profile',
          description: 'Upload banner',
          deadlineDays: 7,
          rewardPoints: 50,
          assignments: [],
        },
      ]);
      mockPrisma.programmeSetting.findMany.mockResolvedValue([
        {
          key: 'verification_required',
          value: 'false',
          updatedAt: new Date(Date.now() - 30 * DAY),
        },
        { key: 'trial_access_days', value: '14', updatedAt: new Date(Date.now() - 30 * DAY) },
      ]);

      const user: EntitlementUser = {
        id: 'usr_7',
        email: 'free-trial@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_7',
          businessName: 'Free Trial Merchant',
          hasPaidVerificationFee: false,
          createdAt: new Date(Date.now() - 2 * DAY),
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement?.access.hasAccess).toBe(true);
      expect(result.entitlement?.access.accessType).toBe('TRIAL_PROGRAMME');
      expect(result.entitlement?.trialContext.isInTrial).toBe(true);
      expect(result.entitlement?.trialContext.hasPaidVerificationFee).toBe(false);
      expect(result.entitlement?.trialContext.daysRemaining).toBeGreaterThanOrEqual(11);
    });

    it('starts the optional free trial when verification was switched off for an existing business', async () => {
      const DAY = 24 * 60 * 60 * 1000;
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      mockPrisma.taskDefinition.findMany.mockResolvedValue([
        {
          id: 'task_mall_1',
          title: 'Setup Store Profile',
          description: 'Upload banner',
          deadlineDays: 7,
          rewardPoints: 50,
          assignments: [],
        },
      ]);
      mockPrisma.programmeSetting.findMany.mockResolvedValue([
        {
          key: 'verification_required',
          value: 'false',
          updatedAt: new Date(Date.now() - 2 * DAY),
        },
        { key: 'trial_access_days', value: '14', updatedAt: new Date(Date.now() - 2 * DAY) },
      ]);

      const user: EntitlementUser = {
        id: 'usr_8',
        email: 'existing@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_8',
          businessName: 'Existing Merchant',
          hasPaidVerificationFee: false,
          // Signed up long before verification became optional
          createdAt: new Date(Date.now() - 60 * DAY),
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement?.access.hasAccess).toBe(true);
      expect(result.entitlement?.trialContext.isInTrial).toBe(true);
      expect(result.entitlement?.trialContext.daysRemaining).toBeGreaterThanOrEqual(11);
    });

    it('denies an expired optional free trial with TRIAL_EXPIRED, not UNVERIFIED', async () => {
      const DAY = 24 * 60 * 60 * 1000;
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      mockPrisma.taskDefinition.findMany.mockResolvedValue([]);
      mockPrisma.programmeSetting.findMany.mockResolvedValue([
        {
          key: 'verification_required',
          value: 'false',
          updatedAt: new Date(Date.now() - 60 * DAY),
        },
        { key: 'trial_access_days', value: '14', updatedAt: new Date(Date.now() - 60 * DAY) },
      ]);

      const user: EntitlementUser = {
        id: 'usr_9',
        email: 'expired-free@example.com',
        role: 'BUSINESS',
        businessProfile: {
          id: 'biz_9',
          businessName: 'Expired Free Trial Merchant',
          hasPaidVerificationFee: false,
          createdAt: new Date(Date.now() - 60 * DAY),
          packages: [],
        },
      };

      const result = await service.resolveEntitlements(user, testClient);

      expect(result.entitlement?.access.hasAccess).toBe(false);
      expect(result.entitlement?.access.reason).toBe('TRIAL_EXPIRED');
      expect(result.entitlement?.access.upgradeUrl).toContain('/dashboard/memberships');
    });
  });
});
