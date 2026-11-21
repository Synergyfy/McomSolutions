import { ReferralCommissionService } from './referral-commission.service';
import { ReferralCommissionStatus, ReferralRewardType } from '@prisma/client';

describe('ReferralCommissionService', () => {
  const config = {
    id: 'cfg1',
    version: 3,
    isActive: true,
    rewardMode: 'SINGLE',
    rewardType: ReferralRewardType.PERCENTAGE,
    percentage: 10,
    fixedAmountGbp: null,
    roleRewards: null,
    eligibleRoles: ['BUSINESS', 'AGENT'],
    qualifyAllMemberships: true,
    qualifyAllAccessPasses: true,
    qualifiedMembershipPlanIds: [],
    qualifiedAccessPlanIds: [],
    commissionFrequency: 'RECURRING',
  };

  const buyer = {
    userId: 'biz-user-1',
    user: {
      id: 'biz-user-1',
      role: 'BUSINESS',
      email: 'buyer@example.com',
      firstName: 'Buyer',
      lastName: 'Business',
      referredById: 'referrer-1',
      referredBy: {
        id: 'referrer-1',
        role: 'BUSINESS',
        email: 'referrer@example.com',
        firstName: 'Referrer',
        lastName: 'Business',
      },
    },
  };

  const prisma = {
    businessProfile: { findFirst: jest.fn() },
    referralCommission: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const referralConfig = {
    getCurrent: jest.fn(),
    isRoleEligible: jest.fn(),
    qualifiesPlan: jest.fn(),
    resolveReward: jest.fn(),
  };

  const wallet = {
    creditWallet: jest.fn(),
  };

  let service: ReferralCommissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReferralCommissionService(
      prisma as any,
      referralConfig as any,
      wallet as any,
    );
    prisma.businessProfile.findFirst.mockResolvedValue(buyer);
    prisma.referralCommission.findUnique.mockResolvedValue(null);
    prisma.referralCommission.findFirst.mockResolvedValue(null);
    prisma.referralCommission.create.mockImplementation(async ({ data }: any) => ({
      id: 'commission-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    prisma.referralCommission.update.mockImplementation(async ({ data }: any) => ({
      id: 'commission-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    referralConfig.getCurrent.mockResolvedValue(config);
    referralConfig.isRoleEligible.mockReturnValue(true);
    referralConfig.qualifiesPlan.mockReturnValue(true);
    referralConfig.resolveReward.mockReturnValue({
      rewardType: ReferralRewardType.PERCENTAGE,
      value: 10,
    });
    wallet.creditWallet.mockResolvedValue({ transactionId: 'wallet-txn-1' });
  });

  it('records a skip when the referrer role is not eligible', async () => {
    referralConfig.isRoleEligible.mockReturnValue(false);

    const result = await service.recordBusinessPurchase({
      businessId: 'biz-1',
      sourceType: 'MEMBERSHIP' as any,
      sourceId: 'billing-1',
      planId: 'plan-1',
      amountGbp: 100,
    });

    expect(result?.status).toBe(ReferralCommissionStatus.SKIPPED_ROLE);
    expect(wallet.creditWallet).not.toHaveBeenCalled();
  });

  it('records a skip when the plan is not qualified', async () => {
    referralConfig.qualifiesPlan.mockReturnValue(false);

    const result = await service.recordBusinessPurchase({
      businessId: 'biz-1',
      sourceType: 'ACCESS_PASS' as any,
      sourceId: 'access-1',
      planId: 'plan-1',
      amountGbp: 50,
    });

    expect(result?.status).toBe(ReferralCommissionStatus.SKIPPED_PLAN);
    expect(wallet.creditWallet).not.toHaveBeenCalled();
  });

  it('credits a percentage commission and links the wallet transaction', async () => {
    const result = await service.recordBusinessPurchase({
      businessId: 'biz-1',
      sourceType: 'MEMBERSHIP' as any,
      sourceId: 'billing-1',
      planId: 'plan-1',
      amountGbp: 100,
      sourceName: 'Gold',
    });

    expect(wallet.creditWallet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'referrer-1',
        amount: 10,
      }),
      'referral-payout:commission-1',
      undefined,
      expect.objectContaining({ intent: 'REFERRAL_COMMISSION' }),
    );
    expect(prisma.referralCommission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReferralCommissionStatus.CREDITED,
          walletTransactionId: 'wallet-txn-1',
        }),
      }),
    );
    expect(result?.status).toBe(ReferralCommissionStatus.CREDITED);
  });

  it('honours one-time commission rules after a previous credited purchase', async () => {
    referralConfig.getCurrent.mockResolvedValue({
      ...config,
      commissionFrequency: 'ONE_TIME',
    });
    prisma.referralCommission.findFirst.mockResolvedValue({ id: 'prior' });

    const result = await service.recordBusinessPurchase({
      businessId: 'biz-1',
      sourceType: 'MEMBERSHIP' as any,
      sourceId: 'billing-2',
      planId: 'plan-1',
      amountGbp: 100,
    });

    expect(result?.status).toBe(ReferralCommissionStatus.SKIPPED_ONE_TIME);
    expect(wallet.creditWallet).not.toHaveBeenCalled();
  });

  it('marks the commission failed when the wallet credit fails', async () => {
    wallet.creditWallet.mockRejectedValue(new Error('wallet blocked'));

    const result = await service.recordBusinessPurchase({
      businessId: 'biz-1',
      sourceType: 'MEMBERSHIP' as any,
      sourceId: 'billing-3',
      planId: 'plan-1',
      amountGbp: 100,
    });

    expect(result?.status).toBe(ReferralCommissionStatus.FAILED);
    expect(prisma.referralCommission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failureReason: 'wallet blocked' }),
      }),
    );
  });

  it('does nothing when the buyer has no referrer', async () => {
    prisma.businessProfile.findFirst.mockResolvedValue({
      ...buyer,
      user: { ...buyer.user, referredById: null, referredBy: null },
    });

    const result = await service.recordBusinessPurchase({
      businessId: 'biz-1',
      sourceType: 'MEMBERSHIP' as any,
      sourceId: 'billing-4',
      amountGbp: 100,
    });

    expect(result).toBeNull();
    expect(prisma.referralCommission.create).not.toHaveBeenCalled();
  });
});

describe('ReferralCommissionService — retry queue', () => {
  const pendingRow = (overrides: Record<string, any> = {}) => ({
    id: 'commission-9',
    referrerUserId: 'referrer-1',
    referredUserId: 'biz-user-1',
    referredEmail: 'buyer@example.com',
    referredName: 'Buyer Business',
    sourceType: 'MEMBERSHIP',
    sourceId: 'billing-9',
    sourceName: 'Gold',
    commissionAmountGbp: 5,
    commissionCredits: 5,
    configVersion: 3,
    status: ReferralCommissionStatus.PENDING,
    failureReason: 'insufficient platform funds',
    updatedAt: new Date('2026-11-20T09:00:00Z'),
    ...overrides,
  });

  function harness(rows: any[]) {
    const prisma: any = {
      referralCommission: {
        findMany: jest.fn().mockResolvedValue(rows),
        update: jest.fn(async ({ data }: any) => ({ ...rows[0], ...data })),
      },
    };
    const wallet = { creditWallet: jest.fn().mockResolvedValue({ transactionId: 'wt_9' }) };
    const service = new ReferralCommissionService(prisma as any, {} as any, wallet as any);
    return { service, prisma, wallet };
  }

  it('pays a waiting commission once the platform is funded', async () => {
    const { service, wallet, prisma } = harness([pendingRow()]);

    const result = await service.retryPendingPayouts();

    expect(result).toEqual({ attempted: 1, credited: 1, stillPending: 0 });
    expect(wallet.creditWallet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'referrer-1', amount: 5 }),
      'referral-payout:commission-9',
      undefined,
      expect.objectContaining({ intent: 'REFERRAL_COMMISSION' }),
    );
    expect(prisma.referralCommission.update).toHaveBeenCalledWith({
      where: { id: 'commission-9' },
      data: expect.objectContaining({
        status: ReferralCommissionStatus.CREDITED,
        walletTransactionId: 'wt_9',
        failureReason: null,
      }),
    });
  });

  it('keeps it pending (never mints) while the platform wallet is short', async () => {
    const { service, wallet, prisma } = harness([pendingRow()]);
    wallet.creditWallet.mockRejectedValue({ response: { error: 'INSUFFICIENT_PLATFORM_BALANCE' } });

    const result = await service.retryPendingPayouts();

    expect(result).toEqual({ attempted: 1, credited: 0, stillPending: 1 });
    expect(prisma.referralCommission.update).toHaveBeenCalledWith({
      where: { id: 'commission-9' },
      data: { failureReason: expect.any(String) },
    });
  });

  it('marks a genuinely broken commission FAILED', async () => {
    const { service, wallet, prisma } = harness([pendingRow()]);
    wallet.creditWallet.mockRejectedValue(new Error('wallet closed'));

    const result = await service.retryPendingPayouts();

    expect(result).toEqual({ attempted: 1, credited: 0, stillPending: 0 });
    expect(prisma.referralCommission.update).toHaveBeenCalledWith({
      where: { id: 'commission-9' },
      data: { status: ReferralCommissionStatus.FAILED, failureReason: 'wallet closed' },
    });
  });

  it('only looks at pending rows that previously failed and are old enough', async () => {
    const { service, prisma } = harness([]);
    await service.retryPendingPayouts();

    const where = prisma.referralCommission.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(ReferralCommissionStatus.PENDING);
    expect(where.failureReason).toEqual({ not: null });
    expect(where.updatedAt.lte).toBeInstanceOf(Date);
  });
});
