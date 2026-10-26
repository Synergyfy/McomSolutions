import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessService } from './access.service';

describe('AccessService access pass codes', () => {
  let service: AccessService;
  let prisma: any;
  let mail: any;

  const plan = {
    id: 'plan_1',
    name: '7-Day Pass',
    archived: false,
    appBundles: [],
  };

  beforeEach(() => {
    prisma = {
      accessPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      businessProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      accessPassCode: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    mail = { send: jest.fn().mockResolvedValue(undefined) };

    service = new AccessService(
      prisma,
      { get: jest.fn() } as any,
      {} as any,
      {} as any,
      mail,
    );
  });

  it('rejects a code locked to a different email', async () => {
    prisma.accessPassCode.findUnique.mockResolvedValue({
      id: 'code_1',
      code: 'MCOM-ABCD-2345',
      accessPlanId: 'plan_1',
      accessPlan: plan,
      status: 'UNUSED',
      recipientEmail: 'recipient@example.com',
      amount: 10,
    });

    await expect(
      service.redeemAccessCode('biz_1', 'user_1', 'someone@example.com', 'MCOM-ABCD-2345'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.accessPassCode.updateMany).not.toHaveBeenCalled();
  });

  it('claims an unused code and activates the pass with a zero charge', async () => {
    prisma.accessPassCode.findUnique.mockResolvedValue({
      id: 'code_1',
      code: 'MCOM-ABCD-2345',
      accessPlanId: 'plan_1',
      accessPlan: plan,
      status: 'UNUSED',
      recipientEmail: null,
      amount: 10,
    });
    prisma.accessPassCode.updateMany.mockResolvedValue({ count: 1 });
    const activation = { startsAt: new Date(), expiresAt: new Date() };
    const activateSpy = jest.spyOn(service, 'activateAccess').mockResolvedValue(activation as any);

    const result = await service.redeemAccessCode(
      'biz_1',
      'user_1',
      'buyer@example.com',
      'mcom-abcd-2345',
    );

    expect(activateSpy).toHaveBeenCalledWith(
      'biz_1',
      'plan_1',
      expect.objectContaining({
        provider: 'code',
        providerPaymentId: 'code:code_1',
        chargedAmount: 0,
        allowZeroAmount: true,
        allowArchived: true,
      }),
    );
    expect(result.planName).toBe('7-Day Pass');
  });

  it('restores an unused code when activation fails', async () => {
    prisma.accessPassCode.findUnique.mockResolvedValue({
      id: 'code_1',
      code: 'MCOM-ABCD-2345',
      accessPlanId: 'plan_1',
      accessPlan: plan,
      status: 'UNUSED',
      recipientEmail: null,
      amount: 10,
    });
    prisma.accessPassCode.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(service, 'activateAccess').mockRejectedValue(new Error('db down'));

    await expect(
      service.redeemAccessCode('biz_1', 'user_1', 'buyer@example.com', 'MCOM-ABCD-2345'),
    ).rejects.toThrow('db down');

    expect(prisma.accessPassCode.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'code_1', status: 'REDEEMED' },
      data: { status: 'UNUSED', redeemedAt: null, redeemedByBusinessId: null },
    });
  });

  it('rejects an unknown code', async () => {
    prisma.accessPassCode.findUnique.mockResolvedValue(null);

    await expect(
      service.redeemAccessCode('biz_1', 'user_1', 'buyer@example.com', 'MCOM-NOPE-9999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AccessService membership conflicts', () => {
  let service: AccessService;
  let prisma: any;

  const plan = {
    id: 'plan_1',
    name: '7-Day Pass',
    archived: false,
    durationDays: 7,
    appBundles: [
      {
        id: 'bundle_1',
        platform: 'MCOM Mall',
        externalPlanId: 'mall-7day',
        packageName: '7-Day Mall Pass',
        durationDays: 7,
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      accessPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      businessProfile: { findFirst: jest.fn() },
      membershipPlan: { findFirst: jest.fn() },
    };
    service = new AccessService(
      prisma,
      { get: jest.fn() } as any,
      {} as any,
      {} as any,
      { send: jest.fn() } as any,
    );
  });

  it('returns no conflict when the membership is inactive', async () => {
    prisma.businessProfile.findFirst.mockResolvedValue({
      id: 'biz_1',
      membershipStatus: 'inactive',
      membershipPlanName: 'Gold',
    });

    const result = await service.getMembershipConflict('biz_1', 'plan_1');

    expect(result.data.hasConflict).toBe(false);
    expect(prisma.membershipPlan.findFirst).not.toHaveBeenCalled();
  });

  it('detects platforms covered by both the membership and the pass', async () => {
    prisma.businessProfile.findFirst.mockResolvedValue({
      id: 'biz_1',
      membershipStatus: 'active',
      membershipPlanName: 'Gold',
      membershipLevel: 'Gold',
      membershipExpiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.membershipPlan.findFirst.mockResolvedValue({
      name: 'Gold',
      includedApps: [{ platform: 'MCOM Mall', planId: 'mall-pro', planName: 'Vendor Pro' }],
    });

    const result = await service.getMembershipConflict('biz_1', 'plan_1');

    expect(result.data.hasConflict).toBe(true);
    expect(result.data.membership?.planName).toBe('Gold');
    expect(result.data.overlappingPlatforms).toEqual([
      expect.objectContaining({
        platform: 'MCOM Mall',
        membershipPlanId: 'mall-pro',
        accessPassPlanId: 'mall-7day',
      }),
    ]);
  });

  it('returns no conflict when the membership does not cover the pass platform', async () => {
    prisma.businessProfile.findFirst.mockResolvedValue({
      id: 'biz_1',
      membershipStatus: 'active',
      membershipPlanName: 'Gold',
    });
    prisma.membershipPlan.findFirst.mockResolvedValue({
      name: 'Gold',
      includedApps: [{ platform: 'MCOM Rewards', planId: 'rewards-plus' }],
    });

    const result = await service.getMembershipConflict('biz_1', 'plan_1');

    expect(result.data.hasConflict).toBe(false);
    expect(result.data.overlappingPlatforms).toEqual([]);
  });
});

describe('AccessService membership override at activation', () => {
  let service: AccessService;
  let prisma: any;
  let tx: any;

  const plan = {
    id: 'plan_1',
    name: '7-Day Pass',
    archived: false,
    durationDays: 7,
    appBundles: [
      {
        id: 'bundle_1',
        platform: 'MCOM Mall',
        externalPlanId: 'mall-7day',
        packageName: '7-Day Mall Pass',
        durationDays: 7,
        limits: {},
      },
    ],
  };

  const business = {
    id: 'biz_1',
    businessName: 'Acme Coffee',
    membershipStatus: 'active',
    membershipPlanName: 'Gold',
    membershipLevel: 'Gold',
    membershipExpiresAt: new Date(Date.now() + 86_400_000),
  };

  beforeEach(() => {
    tx = {
      accessPurchase: {
        create: jest.fn().mockResolvedValue({ id: 'purchase_1', status: 'PENDING_ACTIVATION' }),
      },
      billingTransaction: { create: jest.fn().mockResolvedValue({ id: 'billing_1' }) },
      ecosystemSubscription: { create: jest.fn().mockResolvedValue({ id: 'sub_1' }) },
      platformPackage: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'pkg_1' }),
      },
    };
    prisma = {
      billingTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
      businessProfile: { findFirst: jest.fn().mockResolvedValue(business) },
      accessPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      membershipPlan: {
        findFirst: jest.fn().mockResolvedValue({
          name: 'Gold',
          includedApps: [{ platform: 'MCOM Mall', planId: 'mall-pro', planName: 'Vendor Pro' }],
        }),
      },
      $transaction: jest.fn(async (cb: (client: any) => Promise<any>) => cb(tx)),
    };
    service = new AccessService(
      prisma,
      { get: jest.fn() } as any,
      { completeRedemption: jest.fn() } as any,
      {} as any,
      { send: jest.fn() } as any,
    );
  });

  it('defers the pass when the buyer keeps the membership', async () => {
    const result = await service.activateAccess('biz_1', 'plan_1', {
      provider: 'stripe',
      providerPaymentId: 'pi_defer',
      chargedAmount: 10,
    });

    expect(tx.accessPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_ACTIVATION' }),
      }),
    );
    expect(tx.platformPackage.upsert).not.toHaveBeenCalled();
    expect((result as any).pendingActivation).toBe(true);
  });

  it('activates immediately when the buyer chooses the access pass', async () => {
    const result = await service.activateAccess('biz_1', 'plan_1', {
      provider: 'stripe',
      providerPaymentId: 'pi_switch',
      chargedAmount: 10,
      entitlementChoice: 'access_pass',
    });

    expect(tx.accessPurchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(tx.platformPackage.upsert).toHaveBeenCalled();
    expect((result as any).pendingActivation).toBe(false);
  });
});
