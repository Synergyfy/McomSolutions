import { AffiliateRedemptionService } from './affiliate-redemption.service';

describe('AffiliateRedemptionService', () => {
  const prisma: any = {
    affiliateVoucher: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    affiliateRedemption: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    affiliateOffer: { findUnique: jest.fn(), findFirst: jest.fn() },
    affiliateConversion: { findFirst: jest.fn() },
    affiliateRewardRedemption: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    affiliateTrackingLink: { findFirst: jest.fn() },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  const conversions = {
    createRedemptionConversion: jest.fn(),
    reverseConversion: jest.fn(),
  } as any;
  const rewards = {
    debit: jest.fn(),
  } as any;

  let service: AffiliateRedemptionService;

  const voucher = {
    id: 'vou-1',
    code: 'ABCD-EFGH',
    offerId: 'offer-1',
    campaignId: null,
    localAffiliateId: 'aff-1',
    trackingLinkCode: 'k7Qm2xR9pA',
    benefit: { type: 'PERCENTAGE_DISCOUNT', value: 20 },
    maxUses: 1,
    usedCount: 0,
    maxUsesPerCustomer: 1,
    status: 'ISSUED',
    expiresAt: null,
    offer: {
      id: 'offer-1',
      providerId: 'prov-1',
      businessId: 'biz-1',
      status: 'ACTIVE',
      title: 'Restaurant Meal',
    },
  };

  const actor = { userId: 'staff-1', businessId: 'biz-1', channel: 'POS' as const, ip: '1.2.3.4' };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AffiliateRedemptionService(prisma, conversions, rewards);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'vou-1' }]);
    prisma.affiliateVoucher.findUnique.mockResolvedValue(voucher);
    prisma.affiliateVoucher.update.mockResolvedValue({});
    prisma.affiliateRedemption.findUnique.mockResolvedValue(null);
    prisma.affiliateRedemption.count.mockResolvedValue(0);
    prisma.affiliateRedemption.create.mockResolvedValue({
      id: 'red-1',
      validatedAt: new Date(),
    });
    conversions.createRedemptionConversion.mockResolvedValue({ id: 'conv-1' });
    prisma.affiliateTrackingLink.findFirst.mockResolvedValue({ code: 'k7Qm2xR9pA' });
  });

  // ── Validation guards ──────────────────────────────────────────────────

  describe('validate', () => {
    it('rejects an unknown code with 404 VOUCHER_NOT_FOUND', async () => {
      prisma.affiliateVoucher.findUnique.mockResolvedValue(null);
      await expect(
        service.validate({ code: 'NOPE-1111' }, actor),
      ).rejects.toMatchObject({ response: { message: 'VOUCHER_NOT_FOUND' } });
    });

    it('rejects a revoked voucher with 409', async () => {
      prisma.affiliateVoucher.findUnique.mockResolvedValue({
        ...voucher,
        status: 'REVOKED',
      });
      await expect(
        service.validate({ code: 'ABCD-EFGH' }, actor),
      ).rejects.toMatchObject({ response: { message: 'VOUCHER_REVOKED' } });
    });

    it('rejects an expired voucher with 410 and marks it expired', async () => {
      prisma.affiliateVoucher.findUnique.mockResolvedValue({
        ...voucher,
        expiresAt: new Date(Date.now() - 60_000),
      });
      await expect(
        service.validate({ code: 'ABCD-EFGH' }, actor),
      ).rejects.toMatchObject({ response: { message: 'VOUCHER_EXPIRED' } });
      expect(prisma.affiliateVoucher.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'EXPIRED' } }),
      );
    });

    it('rejects a voucher that has hit its overall usage limit', async () => {
      prisma.affiliateVoucher.findUnique.mockResolvedValue({
        ...voucher,
        usedCount: 1,
        maxUses: 1,
      });
      await expect(
        service.validate({ code: 'ABCD-EFGH' }, actor),
      ).rejects.toMatchObject({ response: { message: 'VOUCHER_USE_LIMIT_REACHED' } });
    });

    it('refuses a voucher belonging to another business', async () => {
      await expect(
        service.validate({ code: 'ABCD-EFGH' }, { ...actor, businessId: 'biz-other' }),
      ).rejects.toMatchObject({ response: { message: 'NOT_YOUR_OFFER' } });
    });

    it('is idempotent per customer: a repeat returns ALREADY_REDEEMED (no error)', async () => {
      prisma.affiliateRedemption.findUnique.mockResolvedValue({
        id: 'red-existing',
        validatedAt: new Date('2026-11-01T10:00:00Z'),
      });

      const result: any = await service.validate(
        { code: 'ABCD-EFGH', customerRef: 'customer@example.com' },
        actor,
      );

      expect(result.data.status).toBe('ALREADY_REDEEMED');
      expect(result.data.redemptionId).toBe('red-existing');
      expect(prisma.affiliateRedemption.create).not.toHaveBeenCalled();
      expect(conversions.createRedemptionConversion).not.toHaveBeenCalled();
    });

    it('a replay by the SAME customer is still idempotent after the voucher is exhausted', async () => {
      // Regression: the usage-limit guard used to run before the per-customer
      // lookup, turning a harmless double-tap into a 409.
      prisma.affiliateVoucher.findUnique.mockResolvedValue({
        ...voucher,
        usedCount: 1,
        maxUses: 1,
      });
      prisma.affiliateRedemption.findUnique.mockResolvedValue({
        id: 'red-existing',
        validatedAt: new Date('2026-11-01T10:00:00Z'),
      });

      const result: any = await service.validate(
        { code: 'ABCD-EFGH', customerRef: 'customer@example.com' },
        actor,
      );

      expect(result.data.status).toBe('ALREADY_REDEEMED');
      expect(result.data.redemptionId).toBe('red-existing');
    });

    it('validates, increments usage and creates exactly one affiliate conversion', async () => {
      const result: any = await service.validate(
        { code: 'abcd-efgh', customerRef: 'customer@example.com', amountMinor: 2500 },
        actor,
      );

      expect(result.data.status).toBe('VALIDATED');
      expect(result.data.remainingUses).toBe(0);

      const update = prisma.affiliateVoucher.update.mock.calls[0][0];
      expect(update.data.usedCount).toBe(1);
      expect(update.data.status).toBe('REDEEMED');

      expect(conversions.createRedemptionConversion).toHaveBeenCalledTimes(1);
      const args = conversions.createRedemptionConversion.mock.calls[0][0];
      expect(args.redemptionId).toBe('red-1');
      // The code is re-resolved from the voucher OWNER at validation time.
      expect(args.trackingCode).toBe('k7Qm2xR9pA');

      const created = prisma.affiliateRedemption.create.mock.calls[0][0].data;
      expect(created.ipHash).not.toContain('1.2.3.4');
    });

    it('keeps the voucher PARTIALLY_REDEEMED while uses remain', async () => {
      prisma.affiliateVoucher.findUnique.mockResolvedValue({
        ...voucher,
        maxUses: 5,
        usedCount: 1,
      });
      await service.validate({ code: 'ABCD-EFGH', customerRef: 'a' }, actor);
      const update = prisma.affiliateVoucher.update.mock.calls[0][0];
      expect(update.data.status).toBe('PARTIALLY_REDEEMED');
    });

    it('still reports success when reward attribution fails (never blocks the customer)', async () => {
      conversions.createRedemptionConversion.mockRejectedValue(new Error('boom'));
      const result: any = await service.validate(
        { code: 'ABCD-EFGH', customerRef: 'a' },
        actor,
      );
      expect(result.data.status).toBe('VALIDATED');
    });

    it('credits the voucher owner, not whoever the stored code points at', async () => {
      // Seed/legacy data may hold a code belonging to a different affiliate.
      prisma.affiliateTrackingLink.findFirst.mockResolvedValue({ code: 'ownersCode' });

      await service.validate({ code: 'ABCD-EFGH', customerRef: 'a' }, actor);

      const args = conversions.createRedemptionConversion.mock.calls[0][0];
      expect(args.trackingCode).toBe('ownersCode');
      expect(prisma.affiliateTrackingLink.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            localAffiliateId: 'aff-1',
            offerId: 'offer-1',
          }),
        }),
      );
    });

    it('creates no reward when the owning affiliate has no active link for the offer', async () => {
      prisma.affiliateTrackingLink.findFirst.mockResolvedValue(null);
      const result: any = await service.validate(
        { code: 'ABCD-EFGH', customerRef: 'a' },
        actor,
      );
      expect(result.data.status).toBe('VALIDATED');
      const args = conversions.createRedemptionConversion.mock.calls[0][0];
      expect(args.trackingCode).toBeNull();
    });

    it('does not create a conversion for a voucher with no owning affiliate', async () => {
      prisma.affiliateVoucher.findUnique.mockResolvedValue({
        ...voucher,
        localAffiliateId: null,
      });
      await service.validate({ code: 'ABCD-EFGH', customerRef: 'a' }, actor);
      expect(conversions.createRedemptionConversion).not.toHaveBeenCalled();
    });
  });

  // ── Reversal ───────────────────────────────────────────────────────────

  describe('reverse', () => {
    it('releases the use and claws back the affiliate reward', async () => {
      prisma.affiliateRedemption.findUnique.mockResolvedValue({
        id: 'red-1',
        status: 'VALIDATED',
        voucherId: 'vou-1',
        voucher: { ...voucher, offer: { providerId: 'prov-1', businessId: 'biz-1' } },
      });
      prisma.affiliateVoucher.findUnique.mockResolvedValue({ ...voucher, usedCount: 1 });
      prisma.affiliateConversion.findFirst.mockResolvedValue({ id: 'conv-1' });
      prisma.affiliateRedemption.update.mockResolvedValue({ id: 'red-1', status: 'REVERSED' });

      const result: any = await service.reverse('red-1', actor, 'Customer cancelled');

      expect(result.data.status).toBe('REVERSED');
      const voucherUpdate = prisma.affiliateVoucher.update.mock.calls[0][0];
      expect(voucherUpdate.data.usedCount).toBe(0);
      expect(conversions.reverseConversion).toHaveBeenCalledWith(
        'conv-1',
        'staff-1',
        'REFUNDED',
      );
    });

    it('is a no-op when already reversed', async () => {
      prisma.affiliateRedemption.findUnique.mockResolvedValue({
        id: 'red-1',
        status: 'REVERSED',
        voucher: { offer: {} },
      });
      await service.reverse('red-1', actor);
      expect(conversions.reverseConversion).not.toHaveBeenCalled();
    });
  });

  // ── Issuance ───────────────────────────────────────────────────────────

  describe('issueVoucher', () => {
    it('records the owning affiliate and their tracking code so attribution needs no click', async () => {
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        id: 'offer-1',
        status: 'ACTIVE',
        providerId: 'prov-1',
      });
      prisma.affiliateTrackingLink.findFirst.mockResolvedValue({ code: 'k7Qm2xR9pA' });
      prisma.affiliateVoucher.findUnique.mockResolvedValue(null);
      prisma.affiliateVoucher.create.mockImplementation(async ({ data }: any) => ({
        id: 'vou-new',
        ...data,
      }));

      await service.issueVoucher(
        { offerId: 'offer-1', benefit: { type: 'PERCENTAGE_DISCOUNT', value: 10 } },
        { localAffiliateId: 'aff-1' },
      );

      const created = prisma.affiliateVoucher.create.mock.calls[0][0].data;
      expect(created.localAffiliateId).toBe('aff-1');
      expect(created.trackingLinkCode).toBe('k7Qm2xR9pA');
      expect(created.maxUses).toBe(1);
      expect(created.maxUsesPerCustomer).toBe(1);
    });
  });

  // ── Reward redemption ──────────────────────────────────────────────────

  describe('redeemReward', () => {
    it('debits points and issues a voucher', async () => {
      prisma.affiliateOffer.findFirst.mockResolvedValue({ id: 'offer-1', status: 'ACTIVE' });
      rewards.debit.mockResolvedValue({ ledgerId: 'debit-1', balanceAfter: 400 });
      prisma.affiliateTrackingLink.findFirst.mockResolvedValue(null);
      prisma.affiliateVoucher.findUnique.mockResolvedValue(null);
      prisma.affiliateVoucher.create.mockResolvedValue({ id: 'vou-9', code: 'WXYZ-2345' });
      prisma.affiliateRewardRedemption.create.mockResolvedValue({ id: 'rr-1' });

      const result: any = await service.redeemReward('aff-1', {
        rewardType: 'VOUCHER',
        units: 100,
      });

      expect(result.data.voucherCode).toBe('WXYZ-2345');
      expect(result.data.balanceAfter).toBe(400);
      expect(rewards.debit).toHaveBeenCalledWith(
        'aff-1',
        'POINTS',
        100,
        expect.objectContaining({}),
      );
    });

    it('fails when no redemption option exists', async () => {
      prisma.affiliateOffer.findFirst.mockResolvedValue(null);
      await expect(
        service.redeemReward('aff-1', { rewardType: 'VOUCHER', units: 10 }),
      ).rejects.toThrow(/No redemption option/);
    });
  });
});
