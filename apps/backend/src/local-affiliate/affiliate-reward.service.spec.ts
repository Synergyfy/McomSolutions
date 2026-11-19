import { AffiliateRewardService } from './affiliate-reward.service';
import {
  AffiliateLedgerEntryType,
  AffiliateRewardStatus,
  AffiliateRewardUnit,
  Prisma,
} from '@prisma/client';

describe('AffiliateRewardService', () => {
  let service: AffiliateRewardService;

  const ledger = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };

  const prisma = {
    affiliateRewardLedger: ledger,
    affiliateLedgerEvent: { create: jest.fn() },
    affiliateConversion: { findUnique: jest.fn() },
    affiliateOffer: { findUnique: jest.fn() },
    affiliateRewardRule: { findUnique: jest.fn() },
    affiliateCampaign: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    localAffiliateProfile: { update: jest.fn() },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  } as any;

  const fixedRule = {
    id: 'rule-1',
    version: 1,
    isCurrent: true,
    name: 'Verified booking 100',
    qualifyingEvent: 'VERIFIED_REDEMPTION',
    rewardType: 'POINTS',
    calculation: 'FIXED',
    unit: AffiliateRewardUnit.POINTS,
    fixedUnits: new Prisma.Decimal(100),
    percentage: null,
    pointsPerCurrencyUnit: null,
    tiers: null,
    maxRewardUnits: null,
    minPurchaseMinor: null,
    approvalMode: 'ADMIN_CONFIRMATION',
    reversalPolicy: 'REVERSE_ON_REFUND',
    expiryDays: 180,
    capPerAffiliateUnits: null,
    capPerCampaignUnits: null,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AffiliateRewardService(prisma);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    ledger.findUnique.mockResolvedValue(null);
    ledger.findMany.mockResolvedValue([]);
    ledger.aggregate.mockResolvedValue({ _sum: { units: null } });
    ledger.groupBy.mockResolvedValue([]);
    ledger.create.mockImplementation(async ({ data }: any) => ({
      id: 'ledger-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    ledger.update.mockImplementation(async ({ data }: any) => ({
      id: 'ledger-1',
      ...data,
    }));
    ledger.updateMany.mockResolvedValue({ count: 1 });
    prisma.affiliateCampaign.findUnique.mockResolvedValue(null);
    prisma.affiliateCampaign.updateMany.mockResolvedValue({ count: 1 });
    prisma.localAffiliateProfile.update.mockResolvedValue({});
  });

  // ── Verifiability (FR-6.6) ─────────────────────────────────────────────

  describe('verifiability gate', () => {
    it('LINK_ONLY can verify clicks only', () => {
      expect(service.canVerify('LINK_ONLY', 'LINK_CLICK')).toBe(true);
      expect(service.canVerify('LINK_ONLY', 'APPROVED_PURCHASE')).toBe(false);
    });

    it('REDEMPTION_CODE can verify redemptions but not purchases', () => {
      expect(service.canVerify('REDEMPTION_CODE', 'VERIFIED_REDEMPTION')).toBe(true);
      expect(service.canVerify('REDEMPTION_CODE', 'APPROVED_PURCHASE')).toBe(false);
    });

    it('MANUAL_CONFIRMATION and above can verify purchases', () => {
      expect(service.canVerify('MANUAL_CONFIRMATION', 'APPROVED_PURCHASE')).toBe(true);
      expect(service.canVerify('PROVIDER_API', 'APPROVED_PURCHASE')).toBe(true);
      expect(service.canVerify('PROVIDER_WEBHOOK', 'APPROVED_PURCHASE')).toBe(true);
    });

    it('throws REWARD_EVENT_NOT_VERIFIABLE for an impossible combination', () => {
      expect(() =>
        service.assertVerifiable('LINK_ONLY', 'APPROVED_PURCHASE'),
      ).toThrow(/REWARD_EVENT_NOT_VERIFIABLE/);
    });
  });

  // ── Calculation (PRD §9.2 worked examples) ─────────────────────────────

  describe('calculate', () => {
    it('E1 — fixed points on a verified redemption', () => {
      const { units } = service.calculate(fixedRule, 3000);
      expect(units.toNumber()).toBe(100);
    });

    it('E2 — 5% at 10 points per currency unit on £50 = 25 points', () => {
      const { units } = service.calculate(
        {
          calculation: 'PERCENTAGE',
          unit: 'POINTS',
          fixedUnits: null,
          percentage: new Prisma.Decimal(5),
          pointsPerCurrencyUnit: new Prisma.Decimal(10),
          tiers: null,
          maxRewardUnits: null,
        } as any,
        5000,
      );
      expect(units.toNumber()).toBe(25);
    });

    it('E3 — percentage cashback is expressed in credits with 2dp', () => {
      const { units } = service.calculate(
        {
          calculation: 'PERCENTAGE',
          unit: 'CREDIT',
          fixedUnits: null,
          percentage: new Prisma.Decimal(2),
          pointsPerCurrencyUnit: null,
          tiers: null,
          maxRewardUnits: null,
        } as any,
        12000,
      );
      expect(units.toNumber()).toBe(2.4);
    });

    it('E4 — tiered: £75 lands in the 250-point band', () => {
      const { units, meta } = service.calculate(
        {
          calculation: 'TIERED',
          unit: 'POINTS',
          fixedUnits: null,
          percentage: null,
          pointsPerCurrencyUnit: null,
          tiers: [
            { minMinor: 0, maxMinor: 2000, fixedUnits: 100 },
            { minMinor: 2000, maxMinor: 10000, fixedUnits: 250 },
            { minMinor: 10000, maxMinor: null, fixedUnits: 500 },
          ],
          maxRewardUnits: null,
        } as any,
        7500,
      );
      expect(units.toNumber()).toBe(250);
      expect((meta.tier as any).fixedUnits).toBe(250);
    });

    it('E5 — maximum reward caps the result and is recorded', () => {
      const { units, meta } = service.calculate(
        {
          calculation: 'FIXED',
          unit: 'POINTS',
          fixedUnits: new Prisma.Decimal(900),
          percentage: null,
          pointsPerCurrencyUnit: null,
          tiers: null,
          maxRewardUnits: new Prisma.Decimal(500),
        } as any,
        5000,
      );
      expect(units.toNumber()).toBe(500);
      expect(meta.capped).toBe(true);
    });

    it('returns zero for a tiered rule with no matching tier', () => {
      const { units } = service.calculate(
        {
          calculation: 'TIERED',
          unit: 'POINTS',
          fixedUnits: null,
          percentage: null,
          pointsPerCurrencyUnit: null,
          tiers: [{ minMinor: 10000, maxMinor: null, fixedUnits: 500 }],
          maxRewardUnits: null,
        } as any,
        100,
      );
      expect(units.toNumber()).toBe(0);
    });

    it('rounds points to whole units', () => {
      const { units } = service.calculate(
        {
          calculation: 'PERCENTAGE',
          unit: 'POINTS',
          fixedUnits: null,
          percentage: new Prisma.Decimal(3),
          pointsPerCurrencyUnit: new Prisma.Decimal(3.333),
          tiers: null,
          maxRewardUnits: null,
        } as any,
        1001,
      );
      expect(Number.isInteger(units.toNumber())).toBe(true);
    });
  });

  // ── State machine (NFR-4: units never change) ──────────────────────────

  describe('transitions', () => {
    it('allows PENDING → APPROVED', async () => {
      ledger.findUnique.mockResolvedValue({
        id: 'l1',
        status: AffiliateRewardStatus.PENDING,
        rewardRuleId: null,
      });
      await expect(
        service.transition('l1', AffiliateRewardStatus.APPROVED),
      ).resolves.toBeDefined();
    });

    it('rejects REDEEMED → AVAILABLE (a spent reward cannot be un-spent)', async () => {
      ledger.findUnique.mockResolvedValue({
        id: 'l1',
        status: AffiliateRewardStatus.REDEEMED,
      });
      await expect(
        service.transition('l1', AffiliateRewardStatus.AVAILABLE),
      ).rejects.toThrow(/Cannot move reward from REDEEMED to AVAILABLE/);
    });

    it('rejects REVERSED → APPROVED', async () => {
      ledger.findUnique.mockResolvedValue({
        id: 'l1',
        status: AffiliateRewardStatus.REVERSED,
      });
      await expect(
        service.transition('l1', AffiliateRewardStatus.APPROVED),
      ).rejects.toThrow();
    });

    it('sets expiresAt when the rule defines expiryDays', async () => {
      ledger.findUnique.mockResolvedValue({
        id: 'l1',
        status: AffiliateRewardStatus.APPROVED,
        rewardRuleId: 'rule-1',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue({
        expiryDays: 30,
      });

      await service.transition('l1', AffiliateRewardStatus.AVAILABLE);

      const call = ledger.update.mock.calls.at(-1)![0];
      expect(call.data.expiresAt).toBeInstanceOf(Date);
      expect(call.data.availableAt).toBeInstanceOf(Date);
    });

    it('records a ledger event on every transition', async () => {
      ledger.findUnique.mockResolvedValue({
        id: 'l1',
        status: AffiliateRewardStatus.PENDING,
        rewardRuleId: null,
      });
      await service.transition('l1', AffiliateRewardStatus.APPROVED, {
        actorType: 'ADMIN',
        actorUserId: 'admin-1',
        reason: 'Approved',
      });
      const call = ledger.update.mock.calls.at(-1)![0];
      expect(call.data.events.create.toStatus).toBe('APPROVED');
      expect(call.data.events.create.actorUserId).toBe('admin-1');
    });

    it('approve() walks PENDING → APPROVED → AVAILABLE', async () => {
      ledger.findUnique
        .mockResolvedValueOnce({
          id: 'l1',
          status: AffiliateRewardStatus.PENDING,
          rewardRuleId: null,
        })
        .mockResolvedValueOnce({
          id: 'l1',
          status: AffiliateRewardStatus.PENDING,
          rewardRuleId: null,
        })
        .mockResolvedValueOnce({
          id: 'l1',
          status: AffiliateRewardStatus.APPROVED,
          rewardRuleId: null,
        });
      ledger.update
        .mockResolvedValueOnce({ id: 'l1', status: AffiliateRewardStatus.APPROVED })
        .mockResolvedValueOnce({ id: 'l1', status: AffiliateRewardStatus.AVAILABLE });

      await service.approve('l1', 'admin-1');

      expect(ledger.update).toHaveBeenCalledTimes(2);
      expect(ledger.update.mock.calls[0][0].data.status).toBe('APPROVED');
      expect(ledger.update.mock.calls[1][0].data.status).toBe('AVAILABLE');
    });
  });

  // ── Balances (PRD §5.4) ────────────────────────────────────────────────

  describe('getBalances', () => {
    beforeEach(() => {
      ledger.groupBy.mockImplementation(async (args: any) => {
        if (args.by[0] === 'status') {
          return [
            { status: 'PENDING', _sum: { units: new Prisma.Decimal(500) } },
            { status: 'APPROVED', _sum: { units: new Prisma.Decimal(200) } },
            { status: 'AVAILABLE', _sum: { units: new Prisma.Decimal(1200) } },
          ];
        }
        return [
          { entryType: 'DEBIT', _sum: { units: new Prisma.Decimal(300) } },
          { entryType: 'EXPIRY', _sum: { units: { toString: () => '0' } } },
        ];
      });
    });

    it('reports pending, approved, available, redeemed and total separately', async () => {
      const balances = await service.getBalances('aff-1');
      expect(balances.pending).toBe(500);
      expect(balances.approved).toBe(200);
      expect(balances.redeemed).toBe(300);
      expect(balances.expired).toBe(0);
      // 1200 available credits − 300 spent
      expect(balances.available).toBe(900);
      expect(balances.totalEarned).toBe(1900);
    });

    it('never counts pending units as available', async () => {
      const balances = await service.getBalances('aff-1');
      expect(balances.available).toBeLessThan(balances.pending + balances.available);
    });

    it('can report a negative available balance after a post-redemption reversal', async () => {
      ledger.groupBy.mockImplementation(async (args: any) => {
        if (args.by[0] === 'status') {
          return [
            { status: 'AVAILABLE', _sum: { units: new Prisma.Decimal(100) } },
          ];
        }
        return [
          { entryType: 'REVERSAL', _sum: { units: new Prisma.Decimal(250) } },
        ];
      });
      const balances = await service.getBalances('aff-1');
      expect(balances.available).toBe(-150);
    });
  });

  // ── Reversal (FR-11) ───────────────────────────────────────────────────

  describe('reverseConversion', () => {
    it('closes a PENDING credit without creating a debit row', async () => {
      ledger.findMany.mockResolvedValue([
        {
          id: 'c1',
          localAffiliateId: 'aff-1',
          status: AffiliateRewardStatus.PENDING,
          units: new Prisma.Decimal(100),
          unit: 'POINTS',
          conversionId: 'conv-1',
          rewardRuleId: 'rule-1',
          rewardRuleVersion: 1,
          campaignId: null,
          offerId: 'offer-1',
        },
      ]);
      ledger.findUnique.mockResolvedValue({
        id: 'c1',
        status: AffiliateRewardStatus.PENDING,
        rewardRuleId: null,
      });
      ledger.update.mockResolvedValue({ id: 'c1', status: 'REVERSED' });
      ledger.groupBy.mockResolvedValue([]);

      const result = await service.reverseConversion('conv-1');

      expect(result.reversedUnits).toBe(100);
      expect(ledger.create).not.toHaveBeenCalled();
    });

    it('offsets an AVAILABLE credit with a REVERSAL row, leaving the credit untouched', async () => {
      ledger.findMany.mockResolvedValue([
        {
          id: 'c1',
          localAffiliateId: 'aff-1',
          status: AffiliateRewardStatus.AVAILABLE,
          units: new Prisma.Decimal(100),
          unit: 'POINTS',
          conversionId: 'conv-1',
          rewardRuleId: 'rule-1',
          rewardRuleVersion: 1,
          campaignId: null,
          offerId: 'offer-1',
        },
      ]);
      ledger.aggregate.mockResolvedValue({ _sum: { units: null } });
      ledger.groupBy.mockResolvedValue([]);

      const result = await service.reverseConversion('conv-1');

      expect(result.reversedUnits).toBe(100);
      const created = ledger.create.mock.calls[0][0].data;
      expect(created.entryType).toBe(AffiliateLedgerEntryType.REVERSAL);
      expect(created.reversesLedgerId).toBe('c1');
      expect(created.idempotencyKey).toBe('reversal:conv-1:100');
      // The original credit row is never edited.
      expect(ledger.update).not.toHaveBeenCalled();
    });

    it('is idempotent: a replayed reversal does not create a second row', async () => {
      ledger.findMany.mockResolvedValue([
        {
          id: 'c1',
          localAffiliateId: 'aff-1',
          status: AffiliateRewardStatus.AVAILABLE,
          units: new Prisma.Decimal(100),
          unit: 'POINTS',
          conversionId: 'conv-1',
          rewardRuleId: 'rule-1',
          rewardRuleVersion: 1,
          campaignId: null,
          offerId: 'offer-1',
        },
      ]);
      ledger.aggregate
        .mockResolvedValueOnce({ _sum: { units: null } })
        .mockResolvedValueOnce({ _sum: { units: new Prisma.Decimal(100) } });
      ledger.findUnique.mockResolvedValue({ id: 'rev-1' });
      ledger.groupBy.mockResolvedValue([]);

      const result = await service.reverseConversion('conv-1');
      expect(result.reversedUnits).toBe(0);
      expect(ledger.create).not.toHaveBeenCalled();
    });

    it('does nothing when the conversion produced no credit', async () => {
      ledger.findMany.mockResolvedValue([]);
      const result = await service.reverseConversion('conv-1');
      expect(result).toEqual({ reversedUnits: 0, negativeBalance: false });
    });
  });

  // ── Spending guard ─────────────────────────────────────────────────────

  describe('debit', () => {
    it('refuses to spend more than the available balance', async () => {
      ledger.findUnique.mockResolvedValue(null);
      ledger.groupBy.mockImplementation(async (args: any) => {
        if (args.by[0] === 'status') {
          return [{ status: 'AVAILABLE', _sum: { units: new Prisma.Decimal(50) } }];
        }
        return [];
      });
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'aff-1' }]);

      await expect(
        service.debit('aff-1', AffiliateRewardUnit.POINTS, 100, {
          description: 'x',
          idempotencyKey: 'k1',
        }),
      ).rejects.toThrow(/INSUFFICIENT_REWARD_BALANCE/);
      expect(ledger.create).not.toHaveBeenCalled();
    });

    it('takes a row lock before checking the balance', async () => {
      ledger.findUnique.mockResolvedValue(null);
      ledger.groupBy.mockImplementation(async (args: any) => {
        if (args.by[0] === 'status') {
          return [{ status: 'AVAILABLE', _sum: { units: new Prisma.Decimal(500) } }];
        }
        return [];
      });
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'aff-1' }]);

      await service.debit('aff-1', AffiliateRewardUnit.POINTS, 100, {
        description: 'x',
        idempotencyKey: 'k2',
      });

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        'aff-1',
      );
    });

    it('returns the existing debit when the idempotency key already exists', async () => {
      ledger.findUnique.mockResolvedValue({ id: 'debit-1' });
      ledger.groupBy.mockResolvedValue([]);
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.debit('aff-1', AffiliateRewardUnit.POINTS, 100, {
        description: 'x',
        idempotencyKey: 'dup',
      });

      expect(result.ledgerId).toBe('debit-1');
      expect(ledger.create).not.toHaveBeenCalled();
    });

    it('rejects a zero or negative amount', async () => {
      await expect(
        service.debit('aff-1', AffiliateRewardUnit.POINTS, 0, {
          description: 'x',
          idempotencyKey: 'k3',
        }),
      ).rejects.toThrow();
    });
  });

  // ── applyToConversion ──────────────────────────────────────────────────

  describe('applyToConversion', () => {
    const conversion = {
      id: 'conv-1',
      localAffiliateId: 'aff-1',
      offerId: 'offer-1',
      campaignId: null,
      eventType: 'VERIFIED_REDEMPTION',
      amountMinor: 3000,
    };

    it('does nothing for an unattributed conversion', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        ...conversion,
        localAffiliateId: null,
      });
      await expect(service.applyToConversion('conv-1')).resolves.toBeNull();
    });

    it('skips (but retains) when the rule event does not match the conversion', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        ...conversion,
        eventType: 'APPROVED_PURCHASE',
      });
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        rewardRuleId: 'rule-1',
        integrationLevel: 'MANUAL_CONFIRMATION',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue(fixedRule);

      const result = await service.applyToConversion('conv-1');
      expect(result?.skipped).toBe(true);
      expect(result?.reasonCode).toBe('NOT_ELIGIBLE');
    });

    it('skips and explains when the purchase is below the minimum', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        ...conversion,
        amountMinor: 1500,
      });
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        rewardRuleId: 'rule-1',
        integrationLevel: 'MANUAL_CONFIRMATION',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue({
        ...fixedRule,
        minPurchaseMinor: 2000,
      });

      const result = await service.applyToConversion('conv-1');
      expect(result?.skipped).toBe(true);
      expect(result?.reasonCode).toBe('BELOW_MIN_PURCHASE');
    });

    it('creates a PENDING credit for an admin-confirmed rule', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue(conversion);
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        rewardRuleId: 'rule-1',
        integrationLevel: 'REDEMPTION_CODE',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue(fixedRule);

      const result = await service.applyToConversion('conv-1');

      expect(result?.skipped).toBe(false);
      expect(result?.units).toBe(100);
      expect(result?.status).toBe(AffiliateRewardStatus.PENDING);
      const created = ledger.create.mock.calls[0][0].data;
      expect(created.idempotencyKey).toBe('conversion:conv-1:1');
      expect(created.explanationCode).toBe('AWAITING_ADMIN_CONFIRMATION');
    });

    it('auto-approves a REDEMPTION_VALIDATION rule on a verified redemption', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue(conversion);
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        rewardRuleId: 'rule-1',
        integrationLevel: 'REDEMPTION_CODE',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue({
        ...fixedRule,
        approvalMode: 'REDEMPTION_VALIDATION',
      });
      // 1st lookup: idempotency miss. 2nd: the row being transitioned.
      ledger.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'ledger-1',
          status: AffiliateRewardStatus.APPROVED,
          rewardRuleId: null,
        });

      const result = await service.applyToConversion('conv-1');

      expect(result?.status).toBe(AffiliateRewardStatus.APPROVED);
      expect(ledger.create.mock.calls[0][0].data.explanationCode).toBeNull();
      // then promoted to AVAILABLE
      expect(ledger.update).toHaveBeenCalled();
    });

    it('returns the existing ledger row on a replay instead of crediting twice', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue(conversion);
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        rewardRuleId: 'rule-1',
        integrationLevel: 'REDEMPTION_CODE',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue(fixedRule);
      ledger.findUnique.mockResolvedValue({
        id: 'existing',
        units: new Prisma.Decimal(100),
        unit: 'POINTS',
        status: 'PENDING',
        entryType: 'CREDIT',
        explanationCode: null,
      });

      const result = await service.applyToConversion('conv-1');
      expect(result?.ledgerId).toBe('existing');
      expect(ledger.create).not.toHaveBeenCalled();
    });

    it('refuses a reward for an event the provider cannot verify', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        ...conversion,
        eventType: 'APPROVED_PURCHASE',
      });
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        rewardRuleId: 'rule-1',
        integrationLevel: 'LINK_ONLY',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue({
        ...fixedRule,
        qualifyingEvent: 'APPROVED_PURCHASE',
      });

      await expect(service.applyToConversion('conv-1')).rejects.toThrow(
        /REWARD_EVENT_NOT_VERIFIABLE/,
      );
    });
  });
});
