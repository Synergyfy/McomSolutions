import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { MembershipSyncService } from './membership-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';

describe('MembershipSyncService', () => {
  let service: MembershipSyncService;
  let prisma: any;
  let dispatcher: any;

  const mockPrisma: any = {
    ssoClient: {
      findMany: jest.fn(),
    },
    membershipPlan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    platformPackage: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    businessProfile: {
      findUnique: jest.fn(),
    },
  };

  const mockDispatcher = {
    dispatchAsync: jest.fn(),
  };

  const plan = {
    id: 'plan_gold',
    name: 'Gold',
    tier: 'Pro+',
    level: 'Gold',
    status: 'active',
    billingCycle: 'Annually',
    amount: 249,
    currency: 'GBP',
    expiresAt: new Date('2027-11-22T00:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WebhookDispatcherService, useValue: mockDispatcher },
      ],
    }).compile();

    service = module.get(MembershipSyncService);
    prisma = module.get(PrismaService);
    dispatcher = module.get(WebhookDispatcherService);
    jest.clearAllMocks();
  });

  it('notifies only apps bundled in the purchased plan', async () => {
    prisma.ssoClient.findMany.mockResolvedValue([
      {
        clientId: 'mcom-mall',
        name: 'MCOM Mall',
        platformSlug: 'mall',
        supportedRoles: [Role.BUSINESS],
        membershipSyncEndpoint: 'https://api.mall.com/webhooks/membership-updated',
      },
      {
        clientId: 'mcom-rewards',
        name: 'MCOM Rewards',
        platformSlug: 'rewards',
        supportedRoles: [Role.BUSINESS, Role.CUSTOMER],
        membershipSyncEndpoint: 'https://api.rewards.com/webhooks/membership-updated',
      },
      {
        clientId: 'gb-audit',
        name: 'GBS Audit',
        platformSlug: 'audit',
        supportedRoles: [Role.BUSINESS],
        membershipSyncEndpoint: 'https://api.audit.com/webhooks/membership-updated',
      },
    ]);

    await service.emitMembershipUpdated({
      userId: 'usr_1',
      businessId: 'biz_1',
      plan,
      apps: [
        { platform: 'MCOM Mall', packageName: 'Mall Pro+', externalPlanId: 'mall-pro-plus' },
        { platform: 'MCOM Rewards', packageName: 'Loyalty Pro+', externalPlanId: 'rewards-pro-plus' },
      ],
    });

    expect(dispatcher.dispatchAsync).toHaveBeenCalledTimes(2);
    const destinations = dispatcher.dispatchAsync.mock.calls.map((call) => call[0]);
    expect(destinations).toEqual(expect.arrayContaining(['mcom-mall', 'mcom-rewards']));
    expect(destinations).not.toContain('gb-audit');

    const [, event, data, options] = dispatcher.dispatchAsync.mock.calls[0];
    expect(event).toBe('membership.updated');
    expect(options.targetUrl).toMatch(/\/webhooks\/membership-updated$/);
    expect(data).toEqual(
      expect.objectContaining({
        userId: 'usr_1',
        businessId: 'biz_1',
        membership: expect.objectContaining({
          planName: 'Gold',
          tier: 'Pro+',
          status: 'active',
        }),
        package: expect.objectContaining({ externalPlanId: expect.any(String) }),
      }),
    );
    expect(data.eventId).toEqual(expect.any(String));
  });

  it('skips apps that do not serve the BUSINESS role', async () => {
    prisma.ssoClient.findMany.mockResolvedValue([
      {
        clientId: 'customer-only',
        name: 'MCOM Mall',
        platformSlug: null,
        supportedRoles: [Role.CUSTOMER],
        membershipSyncEndpoint: 'https://api.mall.com/membership',
      },
    ]);

    await service.emitMembershipUpdated({
      userId: 'usr_1',
      businessId: 'biz_1',
      plan,
      apps: [{ platform: 'MCOM Mall', packageName: 'Mall Pro+' }],
    });

    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  it('does nothing when there is no user or no bundled app', async () => {
    await service.emitMembershipUpdated({
      userId: null,
      businessId: 'biz_1',
      plan,
      apps: [{ platform: 'MCOM Mall', packageName: 'Mall Pro+' }],
    });
    await service.emitMembershipUpdated({
      userId: 'usr_1',
      businessId: 'biz_1',
      plan,
      apps: [],
    });

    expect(prisma.ssoClient.findMany).not.toHaveBeenCalled();
    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  it('swallows database failures so membership activation never fails', async () => {
    prisma.ssoClient.findMany.mockRejectedValue(new Error('db down'));

    await expect(
      service.emitMembershipUpdated({
        userId: 'usr_1',
        businessId: 'biz_1',
        plan,
        apps: [{ platform: 'MCOM Mall', packageName: 'Mall Pro+' }],
      }),
    ).resolves.toBeUndefined();
    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  describe('syncActiveMembership', () => {
    it('provisions bundled packages for the new term and emits an active event', async () => {
      prisma.businessProfile.findUnique.mockResolvedValue({ userId: 'usr_1' });
      prisma.membershipPlan.findUnique.mockResolvedValue({
        id: 'plan_gold',
        name: 'Gold',
        includedApps: [
          {
            platform: 'MCOM Mall',
            planName: 'Mall Pro+',
            planId: 'mall-pro-plus',
            quotas: { listings: 500 },
          },
        ],
      });
      prisma.platformPackage.upsert.mockResolvedValue({
        packageName: 'Mall Pro+',
        externalPlanId: 'mall-pro-plus',
        limits: { listings: 500 },
      });
      prisma.ssoClient.findMany.mockResolvedValue([
        {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
          supportedRoles: [Role.BUSINESS],
          membershipSyncEndpoint: 'https://api.mall.com/webhooks/membership-updated',
        },
      ]);

      const expiresAt = new Date('2027-11-22T00:00:00.000Z');
      await service.syncActiveMembership({
        businessId: 'biz_1',
        planId: 'plan_gold',
        planName: 'Gold',
        tier: 'Pro+',
        level: 'Gold',
        billingCycle: 'Annually',
        amount: 249,
        expiresAt,
      });

      expect(prisma.platformPackage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId_platform: { businessId: 'biz_1', platform: 'MCOM Mall' },
          },
          update: expect.objectContaining({
            status: 'active',
            expiresAt,
            billingCycle: 'Annually',
          }),
        }),
      );
      expect(dispatcher.dispatchAsync).toHaveBeenCalledTimes(1);
      const [, event, data] = dispatcher.dispatchAsync.mock.calls[0];
      expect(event).toBe('membership.updated');
      expect(data.membership).toEqual(
        expect.objectContaining({ status: 'active', tier: 'Pro+' }),
      );
    });

    it('derives the package billing cycle from the tier when omitted', async () => {
      prisma.businessProfile.findUnique.mockResolvedValue({ userId: 'usr_1' });
      prisma.membershipPlan.findUnique.mockResolvedValue({
        id: 'plan_gold',
        name: 'Gold',
        includedApps: [{ platform: 'MCOM Mall', planName: 'Mall Pro' }],
      });
      prisma.platformPackage.upsert.mockResolvedValue({
        packageName: 'Mall Pro',
        externalPlanId: null,
        limits: {},
      });
      prisma.ssoClient.findMany.mockResolvedValue([]);

      await service.syncActiveMembership({
        businessId: 'biz_1',
        planId: 'plan_gold',
        planName: 'Gold',
        tier: 'Pro',
        expiresAt: new Date('2027-05-22T00:00:00.000Z'),
      });

      expect(prisma.platformPackage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ billingCycle: '180 Days' }),
        }),
      );
    });

    it('does nothing when the plan has no bundled apps', async () => {
      prisma.businessProfile.findUnique.mockResolvedValue({ userId: 'usr_1' });
      prisma.membershipPlan.findUnique.mockResolvedValue({
        id: 'plan_bronze',
        name: 'Bronze',
        includedApps: [],
      });

      await service.syncActiveMembership({
        businessId: 'biz_1',
        planId: 'plan_bronze',
        planName: 'Bronze',
      });

      expect(prisma.platformPackage.upsert).not.toHaveBeenCalled();
      expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
    });
  });

  describe('endMembership', () => {
    const bundledPlan = {
      id: 'plan_gold',
      name: 'Gold',
      includedApps: [
        { platform: 'MCOM Mall', planName: 'Mall Pro+', planId: 'mall-pro-plus' },
      ],
    };

    it('expires bundled packages and notifies included apps with a cancelled status', async () => {
      prisma.businessProfile.findUnique.mockResolvedValue({ userId: 'usr_1' });
      prisma.membershipPlan.findUnique.mockResolvedValue(bundledPlan);
      prisma.platformPackage.findMany.mockResolvedValue([
        {
          id: 'pkg-1',
          platform: 'MCOM Mall',
          packageName: 'Mall Pro+',
          externalPlanId: 'mall-pro-plus',
          limits: { listings: 500 },
        },
      ]);
      prisma.platformPackage.updateMany.mockResolvedValue({ count: 1 });
      prisma.ssoClient.findMany.mockResolvedValue([
        {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
          supportedRoles: [Role.BUSINESS],
          membershipSyncEndpoint: 'https://api.mall.com/webhooks/membership-updated',
        },
      ]);

      await service.endMembership({
        businessId: 'biz_1',
        planId: 'plan_gold',
        planName: 'Gold',
        tier: 'Pro+',
        level: 'Gold',
        status: 'cancelled',
        reason: 'Canceled by request',
      });

      expect(prisma.platformPackage.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['pkg-1'] } },
        data: { status: 'expired', autoRenew: false },
      });
      expect(dispatcher.dispatchAsync).toHaveBeenCalledTimes(1);
      const [clientId, event, data] = dispatcher.dispatchAsync.mock.calls[0];
      expect(clientId).toBe('mcom-mall');
      expect(event).toBe('membership.updated');
      expect(data.membership).toEqual(
        expect.objectContaining({ status: 'cancelled', tier: 'Pro+' }),
      );
      expect(data.package).toEqual(
        expect.objectContaining({ externalPlanId: 'mall-pro-plus' }),
      );
    });

    it('emits an expired status for a lapsed term', async () => {
      prisma.businessProfile.findUnique.mockResolvedValue({ userId: 'usr_1' });
      prisma.membershipPlan.findUnique.mockResolvedValue(bundledPlan);
      prisma.platformPackage.findMany.mockResolvedValue([]);
      prisma.platformPackage.updateMany.mockResolvedValue({ count: 0 });
      prisma.ssoClient.findMany.mockResolvedValue([
        {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
          supportedRoles: [Role.BUSINESS],
          membershipSyncEndpoint: 'https://api.mall.com/webhooks/membership-updated',
        },
      ]);

      await service.endMembership({
        businessId: 'biz_1',
        planId: 'plan_gold',
        planName: 'Gold',
        status: 'expired',
      });

      const [, , data] = dispatcher.dispatchAsync.mock.calls[0];
      expect(data.membership.status).toBe('expired');
      expect(data.package.packageName).toBe('Mall Pro+');
    });

    it('swallows failures so the expiry scheduler never fails', async () => {
      prisma.businessProfile.findUnique.mockRejectedValue(new Error('db down'));

      await expect(
        service.endMembership({
          businessId: 'biz_1',
          planName: 'Gold',
          status: 'expired',
        }),
      ).resolves.toBeUndefined();
      expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
    });
  });
});
