import { BadRequestException } from '@nestjs/common';
import { ReferralConfigService } from './referral-config.service';

describe('ReferralConfigService', () => {
  const previous = {
    id: 'cfg-old',
    version: 1,
    isCurrent: true,
    isActive: true,
    rewardMode: 'SINGLE',
    rewardType: 'PERCENTAGE',
    percentage: 5,
    fixedAmountGbp: null,
    roleRewards: {},
    eligibleRoles: ['BUSINESS'],
    qualifyAllMemberships: true,
    qualifyAllAccessPasses: true,
    qualifiedMembershipPlanIds: [],
    qualifiedAccessPlanIds: [],
    commissionFrequency: 'RECURRING',
    note: null,
    changes: [],
    createdByUserId: 'admin-1',
    createdAt: new Date(),
  };

  const prisma = {
    referralConfig: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: ReferralConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferralConfigService(prisma as any);
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
    prisma.referralConfig.findFirst.mockImplementation(async (args: any) =>
      args?.select?.version ? { version: 1 } : previous,
    );
    prisma.referralConfig.updateMany.mockResolvedValue({ count: 1 });
    prisma.referralConfig.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      id: 'cfg-new',
      createdAt: new Date(),
    }));
  });

  it('publishes a new version and retires the previous current row', async () => {
    const result = await service.publish(
      {
        rewardMode: 'SINGLE' as any,
        rewardType: 'PERCENTAGE' as any,
        percentage: 10,
        eligibleRoles: ['BUSINESS', 'AGENT'],
        commissionFrequency: 'RECURRING' as any,
        qualifyAllMemberships: true,
        qualifyAllAccessPasses: true,
        note: 'Increase to 10%',
      },
      'admin-1',
    );

    expect(result.version).toBe(2);
    expect(prisma.referralConfig.updateMany).toHaveBeenCalledWith({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });
    expect(prisma.referralConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          isCurrent: true,
          percentage: expect.anything(),
          eligibleRoles: ['BUSINESS', 'AGENT'],
        }),
      }),
    );
    expect(result.changes.some((change) => change.field === 'eligibleRoles')).toBe(true);
  });

  it('rejects roles that cannot participate in referrals', async () => {
    await expect(
      service.publish(
        {
          rewardMode: 'SINGLE' as any,
          rewardType: 'PERCENTAGE' as any,
          percentage: 10,
          eligibleRoles: ['ADMIN'],
          commissionFrequency: 'RECURRING' as any,
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves per-role reward overrides and falls back when missing', () => {
    const config = {
      ...previous,
      rewardMode: 'PER_ROLE',
      roleRewards: {
        AGENT: { rewardType: 'FIXED', fixedAmountGbp: 25 },
      },
    } as any;

    expect(service.resolveReward(config, 'AGENT')).toEqual({
      rewardType: 'FIXED',
      value: 25,
    });
    expect(service.resolveReward(config, 'BUSINESS')).toEqual({
      rewardType: 'PERCENTAGE',
      value: 5,
    });
  });

  it('only qualifies configured plans when the all-plans switch is off', () => {
    const config = {
      ...previous,
      qualifyAllMemberships: false,
      qualifiedMembershipPlanIds: ['plan-1'],
      qualifyAllAccessPasses: false,
      qualifiedAccessPlanIds: ['access-1'],
    } as any;

    expect(service.qualifiesPlan(config, 'MEMBERSHIP', 'plan-1')).toBe(true);
    expect(service.qualifiesPlan(config, 'MEMBERSHIP', 'plan-2')).toBe(false);
    expect(service.qualifiesPlan(config, 'ACCESS_PASS', 'access-1')).toBe(true);
    expect(service.qualifiesPlan(config, 'ACCESS_PASS', 'access-2')).toBe(false);
  });
});
