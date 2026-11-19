import { AffiliateAdminService } from './affiliate-admin.service';
import { Prisma, AffiliateRewardUnit } from '@prisma/client';

describe('AffiliateAdminService', () => {
  const prisma: any = {
    affiliateProvider: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    affiliateProviderAccount: { create: jest.fn() },
    affiliateOffer: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    affiliateCampaign: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    affiliateCampaignOffer: { createMany: jest.fn() },
    affiliateRewardRule: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    affiliateSyncLog: { findMany: jest.fn() },
    affiliateConversion: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    affiliateRewardLedger: { groupBy: jest.fn(), aggregate: jest.fn() },
    externalBusiness: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };

  const rewards = {
    assertVerifiable: jest.fn(),
    calculate: jest.fn(),
    getBalances: jest.fn(),
  } as any;

  const config = {
    get: jest.fn().mockReturnValue(
      '86d3b8c8ad1519806cd90234050daebe4d2dc95f1ea9d83d780cc73ebed00a3b',
    ),
  } as any;

  let service: AffiliateAdminService;

  const provider = {
    id: 'prov-1',
    code: 'tamina',
    name: 'Tamina',
    integrationLevel: 'REDEMPTION_CODE',
    supportedEvents: ['VERIFIED_REDEMPTION'],
    accounts: [],
    status: 'CONNECTED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(
      '86d3b8c8ad1519806cd90234050daebe4d2dc95f1ea9d83d780cc73ebed00a3b',
    );
    service = new AffiliateAdminService(prisma, rewards, config);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.affiliateProvider.findUnique.mockResolvedValue(provider);
    prisma.affiliateOffer.create.mockImplementation(async ({ data }: any) => ({ id: 'offer-1', ...data }));
    prisma.affiliateOffer.findUnique.mockResolvedValue({
      id: 'offer-1',
      providerId: 'prov-1',
      destinationUrl: 'https://tamina.test/x',
      rewardRuleId: null,
      status: 'DRAFT',
    });
    prisma.affiliateRewardRule.findFirst.mockResolvedValue({ version: 4 });
    prisma.affiliateRewardRule.updateMany.mockResolvedValue({ count: 1 });
    prisma.affiliateRewardRule.create.mockImplementation(async ({ data }: any) => ({ id: 'rule-5', ...data }));
  });

  // ── Offer creation and the verifiability gate ──────────────────────────

  describe('createOffer', () => {
    const dto: any = {
      providerId: 'prov-1',
      title: 'Restaurant Meal',
      destinationUrl: 'https://tamina.test/offer',
    };

    it('rejects a reward rule the provider cannot verify', async () => {
      prisma.affiliateRewardRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        qualifyingEvent: 'APPROVED_PURCHASE',
      });
      rewards.assertVerifiable.mockImplementation(() => {
        throw new Error('REWARD_EVENT_NOT_VERIFIABLE');
      });

      await expect(
        service.createOffer({ ...dto, rewardRuleId: 'rule-1' }, 'admin-1'),
      ).rejects.toThrow(/REWARD_EVENT_NOT_VERIFIABLE/);
      expect(prisma.affiliateOffer.create).not.toHaveBeenCalled();
    });

    it('rejects a non-http destination (open-redirect and JS-URL protection)', async () => {
      await expect(
        service.createOffer({ ...dto, destinationUrl: 'javascript:alert(1)' }, 'admin-1'),
      ).rejects.toMatchObject({ response: { message: 'INVALID_DESTINATION_URL' } });
      expect(prisma.affiliateOffer.create).not.toHaveBeenCalled();
    });

    it('inherits the integration level from the provider', async () => {
      await service.createOffer(dto, 'admin-1');
      const created = prisma.affiliateOffer.create.mock.calls[0][0].data;
      expect(created.integrationLevel).toBe('REDEMPTION_CODE');
      expect(created.status).toBe('DRAFT');
      expect(created.createdByUserId).toBe('admin-1');
    });

    it('flags LINK_ONLY offers as identity-unverifiable for reconciliation', async () => {
      prisma.affiliateProvider.findUnique.mockResolvedValue({
        ...provider,
        integrationLevel: 'LINK_ONLY',
      });
      await service.createOffer(dto, 'admin-1');
      const created = prisma.affiliateOffer.create.mock.calls[0][0].data;
      expect(created.identityUnverifiable).toBe(true);
      expect(created.rewardRuleId ?? null).toBeNull();
    });

    it('generates a unique slug', async () => {
      await service.createOffer(dto, 'admin-1');
      const created = prisma.affiliateOffer.create.mock.calls[0][0].data;
      expect(created.slug).toMatch(/^restaurant-meal-[0-9a-f]{6}$/);
    });
  });

  describe('approveOffer', () => {
    it('re-checks verifiability before publishing', async () => {
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        providerId: 'prov-1',
        destinationUrl: 'https://tamina.test/x',
        rewardRuleId: 'rule-1',
        status: 'DRAFT',
      });
      prisma.affiliateRewardRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        qualifyingEvent: 'APPROVED_PURCHASE',
      });
      rewards.assertVerifiable.mockImplementation(() => {
        throw new Error('REWARD_EVENT_NOT_VERIFIABLE');
      });

      await expect(service.approveOffer('offer-1', 'admin-1')).rejects.toThrow();
      expect(prisma.affiliateOffer.update).not.toHaveBeenCalled();
    });

    it('publishes a valid offer and records the approver', async () => {
      prisma.affiliateRewardRule.findUnique.mockResolvedValue(null);
      await service.approveOffer('offer-1', 'admin-1');
      const update = prisma.affiliateOffer.update.mock.calls[0][0];
      expect(update.data.status).toBe('ACTIVE');
      expect(update.data.approvedByUserId).toBe('admin-1');
    });
  });

  // ── Reward rule versioning (FR-8.3) ────────────────────────────────────

  describe('createRewardRule', () => {
    const dto: any = {
      name: 'Verified booking',
      qualifyingEvent: 'VERIFIED_REDEMPTION',
      rewardType: 'POINTS',
      calculation: 'FIXED',
      unit: 'POINTS',
      fixedUnits: 100,
    };

    it('publishes a new version and clears isCurrent on the previous one', async () => {
      await service.createRewardRule(dto, 'admin-1');

      const created = prisma.affiliateRewardRule.create.mock.calls[0][0].data;
      expect(created.version).toBe(5);
      expect(created.isCurrent).toBe(true);
      expect(prisma.affiliateRewardRule.updateMany).toHaveBeenCalledWith({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    });

    it('requires a percentage for PERCENTAGE rules', async () => {
      await expect(
        service.createRewardRule({ ...dto, calculation: 'PERCENTAGE' }, 'admin-1'),
      ).rejects.toThrow(/percentage is required/);
    });

    it('requires pointsPerCurrencyUnit when a percentage rule pays in points', async () => {
      await expect(
        service.createRewardRule(
          { ...dto, calculation: 'PERCENTAGE', percentage: 5 },
          'admin-1',
        ),
      ).rejects.toThrow(/pointsPerCurrencyUnit is required/);
    });

    it('requires fixedUnits for FIXED rules', async () => {
      await expect(
        service.createRewardRule({ ...dto, fixedUnits: undefined }, 'admin-1'),
      ).rejects.toThrow(/fixedUnits is required/);
    });

    it('refuses cashback while AFFILIATE_CASHBACK_ENABLED is off', async () => {
      const previous = process.env.AFFILIATE_CASHBACK_ENABLED;
      delete process.env.AFFILIATE_CASHBACK_ENABLED;
      await expect(
        service.createRewardRule({ ...dto, rewardType: 'CREDIT' }, 'admin-1'),
      ).rejects.toThrow(/Cashback rewards are not enabled/);
      if (previous) process.env.AFFILIATE_CASHBACK_ENABLED = previous;
    });
  });

  describe('previewRule', () => {
    it('returns the calculated units without writing anything', async () => {
      prisma.affiliateRewardRule.findUnique.mockResolvedValue({ id: 'rule-1', unit: 'POINTS' });
      rewards.calculate.mockReturnValue({
        units: new Prisma.Decimal(25),
        meta: { calculation: 'PERCENTAGE' },
      });

      const result: any = await service.previewRule('rule-1', 5000);
      expect(result.data.units).toBe(25);
      expect(rewards.calculate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rule-1' }),
        5000,
      );
    });
  });

  // ── Providers ──────────────────────────────────────────────────────────

  describe('providers', () => {
    it('never selects encrypted credentials from the list endpoint', async () => {
      prisma.affiliateProvider.findMany.mockResolvedValue([provider]);
      await service.listProviders();

      const args = prisma.affiliateProvider.findMany.mock.calls[0][0];
      const accountSelect = args.include.accounts.select;
      expect(accountSelect.credentialsEncrypted).toBeUndefined();
      expect(accountSelect).toEqual(
        expect.objectContaining({
          id: true,
          label: true,
          externalAccountId: true,
          status: true,
          lastSyncedAt: true,
          lastSyncError: true,
        }),
      );
    });

    it('refuses to store credentials when no encryption key is configured', async () => {
      config.get.mockReturnValue(undefined);
      await expect(
        service.createProviderAccount('prov-1', {
          label: 'Awin',
          externalAccountId: '12345',
          credentials: 'token',
        }),
      ).rejects.toThrow(/CONSOLE_ENCRYPTION_KEY/);
      expect(prisma.affiliateProviderAccount.create).not.toHaveBeenCalled();
    });

    it('encrypts credentials at rest', async () => {
      prisma.affiliateProviderAccount.create.mockImplementation(async ({ data }: any) => data);
      await service.createProviderAccount('prov-1', {
        label: 'Awin',
        externalAccountId: '12345',
        credentials: 'super-secret-token',
      });
      const created = prisma.affiliateProviderAccount.create.mock.calls[0][0].data;
      expect(created.credentialsEncrypted).toBeDefined();
      expect(created.credentialsEncrypted).not.toContain('super-secret-token');
    });

    it('reports structural checks and degrades honestly when nothing is configured', async () => {
      const result: any = await service.testProvider('prov-1');
      expect(result.data.passed).toBe(false);
      expect(result.data.checks.find((c: any) => c.name === 'Account configured').passed).toBe(false);
    });
  });

  // ── Campaigns ──────────────────────────────────────────────────────────

  describe('createCampaign', () => {
    it('allocates a sequential CAM- code', async () => {
      prisma.affiliateCampaign.findFirst.mockResolvedValue({ code: 'CAM-00044' });
      prisma.affiliateCampaign.findUnique.mockResolvedValue(null);
      prisma.affiliateCampaign.create.mockImplementation(async ({ data }: any) => ({ id: 'camp-1', ...data }));

      await service.createCampaign({ name: 'Black Friday' } as any, 'admin-1');

      const created = prisma.affiliateCampaign.create.mock.calls[0][0].data;
      expect(created.code).toBe('CAM-00045');
    });

    it('attaches offers when supplied', async () => {
      prisma.affiliateCampaign.findFirst.mockResolvedValue(null);
      prisma.affiliateCampaign.findUnique.mockResolvedValue(null);
      prisma.affiliateCampaign.create.mockImplementation(async ({ data }: any) => ({ id: 'camp-1', ...data }));

      await service.createCampaign(
        { name: 'Christmas', offerIds: ['o1', 'o2'] } as any,
        'admin-1',
      );

      expect(prisma.affiliateCampaignOffer.createMany).toHaveBeenCalledWith({
        data: [
          { campaignId: 'camp-1', offerId: 'o1' },
          { campaignId: 'camp-1', offerId: 'o2' },
        ],
        skipDuplicates: true,
      });
    });
  });

  // ── Reconciliation (FR-13) ─────────────────────────────────────────────

  describe('reconciliation', () => {
    it('rejects an unknown queue name', async () => {
      await expect(
        service.reconciliation({ queue: 'nonsense' }),
      ).rejects.toThrow(/Unknown reconciliation queue/);
    });

    it('surfaces affiliates with a negative balance after a reversal', async () => {
      prisma.affiliateRewardLedger.groupBy.mockResolvedValue([
        { localAffiliateId: 'aff-1' },
      ]);
      rewards.getBalances.mockResolvedValue({ available: -150 });

      const result: any = await service.reconciliation({
        queue: 'negative_balances',
      });

      expect(result.data.negative_balances.count).toBe(1);
      expect(result.data.negative_balances.items[0].available).toBe(-150);
    });

    it('does not flag healthy balances', async () => {
      prisma.affiliateRewardLedger.groupBy.mockResolvedValue([
        { localAffiliateId: 'aff-1' },
      ]);
      rewards.getBalances.mockResolvedValue({ available: 40 });
      const result: any = await service.reconciliation({ queue: 'negative_balances' });
      expect(result.data.negative_balances.count).toBe(0);
    });

    it('counts over-budget campaigns', async () => {
      prisma.affiliateCampaign.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'CAM-1',
          name: 'BF',
          rewardCapUnits: new Prisma.Decimal(1000),
          budgetUnitsIssued: new Prisma.Decimal(1000),
          status: 'PAUSED',
        },
        {
          id: 'c2',
          code: 'CAM-2',
          name: 'Xmas',
          rewardCapUnits: new Prisma.Decimal(1000),
          budgetUnitsIssued: new Prisma.Decimal(200),
          status: 'ACTIVE',
        },
      ]);

      const result: any = await service.reconciliation({
        queue: 'over_budget_campaigns',
      });

      expect(result.data.over_budget_campaigns.count).toBe(1);
      expect(result.data.over_budget_campaigns.items[0].code).toBe('CAM-1');
    });
  });

  // ── Reports ────────────────────────────────────────────────────────────

  describe('reportOverview', () => {
    it('reports totals and per-provider splits', async () => {
      prisma.localAffiliateProfile = { count: jest.fn().mockResolvedValue(4) };
      prisma.affiliateOffer.count.mockResolvedValue(6);
      prisma.affiliateCampaign.count.mockResolvedValue(2);
      prisma.affiliateConversion.count.mockResolvedValue(15);
      prisma.affiliateConversion.groupBy
        .mockResolvedValueOnce([{ providerId: 'prov-1', _count: { _all: 15 }, _sum: { amountMinor: 50000 } }])
        .mockResolvedValueOnce([{ status: 'ATTRIBUTED', _count: { _all: 12 } }]);
      prisma.affiliateRewardLedger.groupBy.mockResolvedValue([
        { status: 'AVAILABLE', _sum: { units: new Prisma.Decimal(1200) } },
      ]);
      prisma.affiliateProvider.findMany.mockResolvedValue([
        { id: 'prov-1', code: 'mcom_mall', name: 'MCOM Mall' },
      ]);

      const result: any = await service.reportOverview();

      expect(result.data.totals.affiliates).toBe(4);
      expect(result.data.byProvider[0].provider.code).toBe('mcom_mall');
      expect(result.data.rewardsByStatus.AVAILABLE).toBe(1200);
    });
  });
});
