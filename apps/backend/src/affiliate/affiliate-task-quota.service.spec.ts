import { MembershipTier, PlanTier } from '@prisma/client';
import { AffiliateTaskQuotaService } from './affiliate-task-quota.service';

function buildHarness() {
  const prisma = {
    businessProfile: { findFirst: jest.fn() },
    membershipPlan: { findFirst: jest.fn() },
    ecosystemSubscription: { findFirst: jest.fn() },
    accessPurchase: { findFirst: jest.fn() },
    affiliateTask: { count: jest.fn().mockResolvedValue(0) },
  };
  const service = new AffiliateTaskQuotaService(prisma as never);
  return { service, prisma };
}

const now = new Date();
const future = new Date(Date.now() + 30 * 24 * 3600_000);
const past = new Date(Date.now() - 30 * 24 * 3600_000);

describe('AffiliateTaskQuotaService', () => {
  it('returns unlimited free delegations for a membership with no cap', async () => {
    const { service, prisma } = buildHarness();
    prisma.businessProfile.findFirst.mockResolvedValue({
      membershipStatus: 'active',
      membershipPlanName: 'Gold',
      membershipExpiresAt: future,
      membershipTier: MembershipTier.Normal,
    });
    prisma.membershipPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      name: 'Gold',
      freeDelegatedTasks: 0,
      unlimitedFreeDelegatedTasks: true,
      tiers: [{ durationDays: 90 }],
    });
    prisma.ecosystemSubscription.findFirst.mockResolvedValue({
      startDate: past,
      endDate: future,
    });
    prisma.affiliateTask.count.mockResolvedValue(7);

    const result = await service.resolve('business-1');

    expect(result.source).toBe('MEMBERSHIP');
    expect(result.unlimited).toBe(true);
    expect(result.isFree).toBe(true);
    expect(result.remaining).toBeNull();
    expect(result.used).toBe(7);
  });

  it('marks the next task chargeable once the membership cap is used', async () => {
    const { service, prisma } = buildHarness();
    prisma.businessProfile.findFirst.mockResolvedValue({
      membershipStatus: 'active',
      membershipPlanName: 'Silver',
      membershipExpiresAt: future,
      membershipTier: MembershipTier.Pro,
    });
    prisma.membershipPlan.findFirst.mockResolvedValue({
      id: 'plan-2',
      name: 'Silver',
      freeDelegatedTasks: 2,
      unlimitedFreeDelegatedTasks: false,
      tiers: [{ durationDays: 180 }],
    });
    prisma.ecosystemSubscription.findFirst.mockResolvedValue({
      startDate: past,
      endDate: future,
    });
    prisma.affiliateTask.count.mockResolvedValue(2);

    const result = await service.resolve('business-1', { excludeTaskId: 'task-current' });

    expect(result.isFree).toBe(false);
    expect(result.freeLimit).toBe(2);
    expect(result.remaining).toBe(0);
    expect(prisma.affiliateTask.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'business-1',
          assigneeId: { not: null },
          status: { not: 'CANCELLED' },
          id: { not: 'task-current' },
        }),
      }),
    );
  });

  it('uses the active access purchase when there is no paid membership', async () => {
    const { service, prisma } = buildHarness();
    prisma.businessProfile.findFirst.mockResolvedValue({
      membershipStatus: 'active',
      membershipPlanName: null,
      membershipExpiresAt: null,
      membershipTier: MembershipTier.Normal,
    });
    prisma.accessPurchase.findFirst.mockResolvedValue({
      startsAt: past,
      expiresAt: future,
      accessPlan: {
        id: 'access-1',
        name: '7-Day Pass',
        freeDelegatedTasks: 3,
        unlimitedFreeDelegatedTasks: false,
      },
    });
    prisma.affiliateTask.count.mockResolvedValue(1);

    const result = await service.resolve('business-1');

    expect(result.source).toBe('ACCESS_PASS');
    expect(result.planName).toBe('7-Day Pass');
    expect(result.isFree).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.periodStart).toBe(past);
    expect(result.periodEnd).toBe(future);
  });

  it('falls back to unlimited when a paid membership has no matching plan row', async () => {
    const { service, prisma } = buildHarness();
    prisma.businessProfile.findFirst.mockResolvedValue({
      membershipStatus: 'active',
      membershipPlanName: 'Deleted Legacy Plan',
      membershipExpiresAt: future,
      membershipTier: MembershipTier.Normal,
    });
    prisma.membershipPlan.findFirst.mockResolvedValue(null);
    prisma.ecosystemSubscription.findFirst.mockResolvedValue({
      startDate: past,
      endDate: future,
    });

    const result = await service.resolve('business-1');

    expect(result.source).toBe('MEMBERSHIP');
    expect(result.unlimited).toBe(true);
    expect(result.isFree).toBe(true);
  });

  it('always charges when the business has no membership or access pass', async () => {
    const { service, prisma } = buildHarness();
    prisma.businessProfile.findFirst.mockResolvedValue({
      membershipStatus: 'active',
      membershipPlanName: null,
      membershipExpiresAt: null,
      membershipTier: MembershipTier.Normal,
    });
    prisma.accessPurchase.findFirst.mockResolvedValue(null);

    const result = await service.resolve('business-1');

    expect(result.source).toBe('NONE');
    expect(result.isFree).toBe(false);
    expect(result.freeLimit).toBe(0);
  });

  it('falls back to the tier duration when no ecosystem subscription row exists', async () => {
    const { service, prisma } = buildHarness();
    prisma.businessProfile.findFirst.mockResolvedValue({
      membershipStatus: 'active',
      membershipPlanName: 'Gold',
      membershipExpiresAt: future,
      membershipTier: MembershipTier.ProPlus,
    });
    prisma.membershipPlan.findFirst.mockResolvedValue({
      id: 'plan-3',
      name: 'Gold',
      freeDelegatedTasks: 10,
      unlimitedFreeDelegatedTasks: false,
      tiers: [{ durationDays: 365 }],
    });
    prisma.ecosystemSubscription.findFirst.mockResolvedValue(null);

    const result = await service.resolve('business-1');

    expect(result.periodStart).toBeTruthy();
    expect(result.planId).toBe('plan-3');
    expect(prisma.membershipPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: 'Gold' }),
        select: expect.objectContaining({
          tiers: expect.objectContaining({ where: { tier: PlanTier.ProPlus } }),
        }),
      }),
    );
  });
});
