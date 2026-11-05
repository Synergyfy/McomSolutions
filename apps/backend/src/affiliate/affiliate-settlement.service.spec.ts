import { UnprocessableEntityException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { AffiliateSettlementService } from './affiliate-settlement.service';

const future = new Date(Date.now() + 7 * 24 * 3600_000);

function buildTask(overrides: Record<string, any> = {}) {
  return {
    id: 'task-1',
    title: 'Design a launch banner',
    businessId: 'business-1',
    business: {
      id: 'business-1',
      userId: 'business-user-1',
      businessName: 'Acme Retail',
      email: 'acme@example.com',
      membershipStatus: 'active',
      membershipPlanName: null,
      membershipExpiresAt: null,
    },
    assigneeId: 'affiliate-1',
    assignee: {
      id: 'affiliate-1',
      email: 'affiliate@example.com',
      firstName: 'Ada',
      lastName: 'Agent',
      role: 'AGENT',
    },
    compensationModel: 'FIXED',
    compensationAmount: 75,
    compensationCurrency: 'GBP',
    billableToBusiness: true,
    businessChargeAmount: 120,
    businessChargeCurrency: 'GBP',
    dueAt: future,
    settlement: null,
    ...overrides,
  };
}

function buildHarness(task = buildTask()) {
  const prisma = {
    affiliateTask: {
      findUnique: jest.fn().mockResolvedValue(task),
      update: jest.fn().mockResolvedValue(task),
    },
    affiliateTaskSettlement: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    affiliateTaskEvent: { create: jest.fn().mockResolvedValue({}) },
    walletHold: { findUnique: jest.fn() },
    programmeSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    revenueRecord: { create: jest.fn().mockResolvedValue({}) },
  };

  const wallet = {
    getGbpToMcomRate: jest.fn().mockResolvedValue(2),
    resolvePartner: jest.fn().mockResolvedValue({
      clientId: 'mcom-central',
      name: 'MCOM Central',
      platformSlug: 'mcom-central',
    }),
    placeHold: jest.fn().mockResolvedValue({
      holdId: 'hold-1',
      reserved: 240,
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    }),
    captureHold: jest.fn().mockResolvedValue({ transactionId: 'business-txn' }),
    creditWallet: jest.fn().mockResolvedValue({ transactionId: 'affiliate-txn' }),
    releaseHoldInternal: jest.fn().mockResolvedValue({ success: true, holdId: 'hold-1', status: 'RELEASED' }),
  };

  const config = { get: jest.fn().mockReturnValue(undefined) };

  const service = new AffiliateSettlementService(
    prisma as never,
    wallet as never,
    config as never,
  );

  return { service, prisma, wallet };
}

describe('AffiliateSettlementService', () => {
  describe('ensureForTask', () => {
    it('reserves the business charge and computes the platform fee from the spread', async () => {
      const { service, prisma, wallet } = buildHarness();
      prisma.affiliateTaskSettlement.upsert.mockImplementation(async ({ create }: any) => ({
        id: 'settlement-1',
        ...create,
      }));

      await service.ensureForTask('task-1', { platformFeePercent: 10 });

      expect(wallet.placeHold).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'mcom-central' }),
        expect.objectContaining({
          userId: 'business-user-1',
          amount: 240,
          reference: 'affiliate-task:task-1:hold',
        }),
      );

      const create = prisma.affiliateTaskSettlement.upsert.mock.calls[0][0].create;
      expect(create.status).toBe('HELD');
      expect(create.fundingSource).toBe('BUSINESS_WALLET');
      expect(create.businessChargeCredits.toString()).toBe('240');
      expect(create.compensationCredits.toString()).toBe('150');
      // 10% of 240 = 24, capped only by the 90 spread.
      expect(create.platformFeeCredits.toString()).toBe('24');
      expect(create.platformMarginCredits.toString()).toBe('66');
      expect(create.affiliatePayoutCredits.toString()).toBe('150');
      expect(create.holdId).toBe('hold-1');
    });

    it('never charges an active paid membership and platform-funds the payout', async () => {
      const task = buildTask({
        business: {
          ...buildTask().business,
          membershipPlanName: 'Gold Annual',
        },
      });
      const { service, prisma, wallet } = buildHarness(task);
      prisma.affiliateTaskSettlement.upsert.mockImplementation(async ({ create }: any) => ({
        id: 'settlement-2',
        ...create,
      }));

      await service.ensureForTask('task-1');

      expect(wallet.placeHold).not.toHaveBeenCalled();
      const create = prisma.affiliateTaskSettlement.upsert.mock.calls[0][0].create;
      expect(create.fundingSource).toBe('PLATFORM');
      expect(create.businessChargeCredits.toString()).toBe('0');
      expect(create.platformFeeCredits.toString()).toBe('0');
      expect(create.affiliatePayoutCredits.toString()).toBe('150');
      expect(create.status).toBe('HELD');
    });

    it('caps the fee at the spread so the affiliate payout is never reduced', async () => {
      const task = buildTask({ businessChargeAmount: 80 }); // 160 credits vs 150 payout
      const { service, prisma } = buildHarness(task);
      prisma.affiliateTaskSettlement.upsert.mockImplementation(async ({ create }: any) => ({
        id: 'settlement-3',
        ...create,
      }));

      await service.ensureForTask('task-1', { platformFeePercent: 50 });

      const create = prisma.affiliateTaskSettlement.upsert.mock.calls[0][0].create;
      expect(create.businessChargeCredits.toString()).toBe('160');
      expect(create.affiliatePayoutCredits.toString()).toBe('150');
      expect(create.platformFeeCredits.toString()).toBe('10');
      expect(create.platformMarginCredits.toString()).toBe('0');
    });

    it('platform-funds a free task even on a paid membership', async () => {
      const task = buildTask({
        business: { ...buildTask().business, membershipPlanName: 'Gold' },
        freeDelegation: true,
        billableToBusiness: true,
        businessChargeAmount: 120,
      });
      const { service, prisma, wallet } = buildHarness(task);
      prisma.affiliateTaskSettlement.upsert.mockImplementation(async ({ create }: any) => ({
        id: 'settlement-free',
        ...create,
      }));

      await service.ensureForTask('task-1');

      expect(wallet.placeHold).not.toHaveBeenCalled();
      const create = prisma.affiliateTaskSettlement.upsert.mock.calls[0][0].create;
      expect(create.fundingSource).toBe('PLATFORM');
      expect(create.businessChargeCredits.toString()).toBe('0');
      expect(create.affiliatePayoutCredits.toString()).toBe('150');
    });

    it('charges a paid membership once the free allowance is exhausted', async () => {
      const task = buildTask({
        business: { ...buildTask().business, membershipPlanName: 'Gold' },
        freeDelegation: false,
        billableToBusiness: true,
        businessChargeAmount: 120,
      });
      const { service, prisma, wallet } = buildHarness(task);
      prisma.affiliateTaskSettlement.upsert.mockImplementation(async ({ create }: any) => ({
        id: 'settlement-over',
        ...create,
      }));

      await service.ensureForTask('task-1');

      expect(wallet.placeHold).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ amount: 240 }),
      );
      const create = prisma.affiliateTaskSettlement.upsert.mock.calls[0][0].create;
      expect(create.fundingSource).toBe('BUSINESS_WALLET');
      expect(create.businessChargeCredits.toString()).toBe('240');
    });

    it('refuses affiliate pay above the business charge', async () => {
      const task = buildTask({ businessChargeAmount: 20 }); // 40 credits < 150 payout
      const { service } = buildHarness(task);

      await expect(service.ensureForTask('task-1')).rejects.toThrow(
        /cannot exceed the business charge/i,
      );
    });

    it('marks the settlement FAILED and surfaces an actionable 422 when funds are short', async () => {
      const { service, prisma, wallet } = buildHarness();
      wallet.placeHold.mockRejectedValue({
        response: { error: 'INSUFFICIENT_BALANCE', availableBalance: 12 },
        message: 'Wallet balance (12 MCOM) is insufficient',
      });
      prisma.affiliateTaskSettlement.upsert.mockImplementation(async ({ create }: any) => ({
        id: 'settlement-4',
        ...create,
      }));

      await expect(service.ensureForTask('task-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );

      const create = prisma.affiliateTaskSettlement.upsert.mock.calls[0][0].create;
      expect(create.status).toBe('FAILED');
      expect(create.failureReason).toMatch(/does not have enough MCOM credits/i);
      expect(create.holdId).toBeNull();
    });
  });

  describe('settleTask', () => {
    function settlementRow(overrides: Record<string, any> = {}) {
      return {
        id: 'settlement-1',
        taskId: 'task-1',
        status: 'HELD',
        holdId: 'hold-1',
        settlementReference: null,
        affiliateUserId: 'affiliate-1',
        businessId: 'business-1',
        businessChargeCredits: new Decimal('240'),
        affiliatePayoutCredits: new Decimal('150'),
        platformFeeCredits: new Decimal('24'),
        platformMarginCredits: new Decimal('66'),
        platformFeePercent: new Decimal('10'),
        fxRate: new Decimal('2'),
        fundingSource: 'BUSINESS_WALLET',
        businessTransactionId: null,
        affiliateTransactionId: null,
        task: { id: 'task-1', title: 'Design a launch banner' },
        ...overrides,
      };
    }

    it('captures the hold, credits the affiliate and books the fee exactly once', async () => {
      const row = settlementRow();
      const { service, prisma, wallet } = buildHarness();
      prisma.affiliateTaskSettlement.findUnique.mockResolvedValue(row);
      prisma.affiliateTaskSettlement.findUniqueOrThrow.mockResolvedValue({
        ...row,
        status: 'SETTLED',
      });

      await service.settleTask('task-1');

      expect(wallet.captureHold).toHaveBeenCalledWith(
        expect.anything(),
        'hold-1',
        'HOLD_CAPTURE',
        'affiliate-task:task-1:settle:business:debit',
      );
      expect(wallet.creditWallet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: 'affiliate-1', amount: 150 }),
        'affiliate-task:task-1:settle:affiliate:credit',
      );
      expect(prisma.revenueRecord.create).toHaveBeenCalledTimes(1);
      expect(prisma.revenueRecord.create.mock.calls[0][0].data.amount).toBe(45); // (24 fee + 66 margin) / 2
    });

    it('short-circuits an already settled task without moving money again', async () => {
      const row = settlementRow({ status: 'SETTLED' });
      const { service, prisma, wallet } = buildHarness();
      prisma.affiliateTaskSettlement.findUnique.mockResolvedValue(row);

      const result = await service.settleTask('task-1');

      expect(result).toBe(row);
      expect(wallet.captureHold).not.toHaveBeenCalled();
      expect(wallet.creditWallet).not.toHaveBeenCalled();
    });

    it('platform-funded payouts credit the affiliate and book the cost, not a business charge', async () => {
      const row = settlementRow({
        fundingSource: 'PLATFORM',
        holdId: null,
        businessChargeCredits: new Decimal('0'),
        platformFeeCredits: new Decimal('0'),
        platformMarginCredits: new Decimal('0'),
      });
      const { service, prisma, wallet } = buildHarness();
      prisma.affiliateTaskSettlement.findUnique.mockResolvedValue(row);
      prisma.affiliateTaskSettlement.findUniqueOrThrow.mockResolvedValue({
        ...row,
        status: 'SETTLED',
      });

      await service.settleTask('task-1');

      expect(wallet.captureHold).not.toHaveBeenCalled();
      expect(wallet.creditWallet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: 'affiliate-1', amount: 150 }),
        'affiliate-task:task-1:settle:affiliate:credit',
      );
      expect(prisma.revenueRecord.create).toHaveBeenCalledTimes(1);
      expect(prisma.revenueRecord.create.mock.calls[0][0].data.amount).toBe(-75); // 150 credits / 2
    });
  });

  describe('releaseTaskHold', () => {
    it('returns the reservation to the business', async () => {
      const { service, prisma, wallet } = buildHarness();
      prisma.affiliateTaskSettlement.findUnique.mockResolvedValue({
        id: 'settlement-1',
        taskId: 'task-1',
        status: 'HELD',
        holdId: 'hold-1',
      });
      prisma.affiliateTaskSettlement.update.mockResolvedValue({ status: 'RELEASED' });

      await service.releaseTaskHold('task-1', 'cancelled');

      expect(wallet.releaseHoldInternal).toHaveBeenCalledWith('hold-1', 'RELEASED');
      expect(prisma.affiliateTaskSettlement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RELEASED' }),
        }),
      );
    });
  });
});
