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
    getGbpToMcomRate: jest.fn(),
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
    wallet.getGbpToMcomRate.mockResolvedValue(2);
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
        amount: 20,
      }),
      'referral-payout:commission-1',
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
