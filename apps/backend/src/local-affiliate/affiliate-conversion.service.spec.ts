import { AffiliateConversionService } from './affiliate-conversion.service';
import { AffiliateAttributionMethod } from '@prisma/client';

describe('AffiliateConversionService', () => {
  const prisma: any = {
    affiliateProvider: { findUnique: jest.fn() },
    affiliateConversion: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    affiliateTrackingLink: { findUnique: jest.fn() },
    affiliateCampaign: { findUnique: jest.fn() },
    affiliateAttribution: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const tracking = {
    lastClickAt: jest.fn(),
    markConverted: jest.fn(),
    findByCode: jest.fn(),
  } as any;

  const rewards = { applyToConversion: jest.fn(), approve: jest.fn(), reject: jest.fn(), reverseConversion: jest.fn() } as any;

  let service: AffiliateConversionService;

  const baseConversion = {
    id: 'conv-1',
    providerId: 'prov-1',
    providerTransactionId: 'ord_1',
    eventType: 'APPROVED_PURCHASE',
    amountMinor: 5000,
    currency: 'GBP',
    occurredAt: new Date('2026-11-10T10:00:00Z'),
    campaignId: null,
    offerId: null,
    localAffiliateId: null,
    customerUserId: null,
    attribution: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AffiliateConversionService(prisma, tracking, rewards);
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.affiliateProvider.findUnique.mockResolvedValue({ id: 'prov-1', code: 'mcom_mall' });
    prisma.affiliateConversion.findFirst.mockResolvedValue(null);
    prisma.affiliateConversion.create.mockImplementation(async ({ data }: any) => ({
      id: 'conv-1',
      ...data,
    }));
    prisma.affiliateConversion.findUnique.mockResolvedValue(baseConversion);
    prisma.affiliateConversion.update.mockImplementation(async ({ data }: any) => ({
      ...baseConversion,
      ...data,
    }));
    prisma.affiliateAttribution.create.mockResolvedValue({ id: 'attr-1' });
    tracking.markConverted.mockResolvedValue(undefined);
    rewards.applyToConversion.mockResolvedValue({ ledgerId: 'l1', units: 25 });
  });

  // ── Ingest (FR-7) ──────────────────────────────────────────────────────

  describe('ingest', () => {
    const dto: any = {
      provider: 'mcom_mall',
      providerOrderId: 'ord_1',
      eventType: 'APPROVED_PURCHASE',
      trackingCode: 'k7Qm2xR9pA',
      amountMinor: 5000,
      customerRef: 'buyer-1',
    };

    it('rejects an unknown provider', async () => {
      prisma.affiliateProvider.findUnique.mockResolvedValue(null);
      await expect(service.ingest(dto)).rejects.toThrow(/Unknown provider/);
    });

    it('is idempotent: a replayed provider order returns duplicate=true', async () => {
      prisma.affiliateConversion.findFirst.mockResolvedValue(baseConversion);
      const result = await service.ingest(dto);
      expect(result.duplicate).toBe(true);
      expect(prisma.affiliateConversion.create).not.toHaveBeenCalled();
    });

    it('creates the conversion and attributes it when a tracking code is supplied', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        id: 'link-1',
        code: 'k7Qm2xR9pA',
        isActive: true,
        localAffiliateId: 'aff-1',
        offerId: 'offer-1',
        campaignId: null,
        localAffiliate: { id: 'aff-1', userId: 'aff-user', status: 'ACTIVE' },
        offer: { id: 'offer-1', integrationLevel: 'PROVIDER_API', status: 'ACTIVE', campaignLinks: [] },
      });
      tracking.lastClickAt.mockResolvedValue(new Date('2026-11-09T10:00:00Z'));

      const result = await service.ingest(dto);

      expect(result.duplicate).toBe(false);
      expect(prisma.affiliateAttribution.create).toHaveBeenCalled();
      expect(prisma.affiliateConversion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ATTRIBUTED' }),
        }),
      );
      expect(rewards.applyToConversion).toHaveBeenCalledWith('conv-1');
    });

    it('leaves the conversion RECEIVED (unmatched) when no tracking code is supplied', async () => {
      const result = await service.ingest({ ...dto, trackingCode: undefined });
      expect(prisma.affiliateConversion.create).toHaveBeenCalled();
      expect(prisma.affiliateAttribution.create).not.toHaveBeenCalled();
      expect(result.duplicate).toBe(false);
    });
  });

  // ── Attribution (FR-5) ─────────────────────────────────────────────────

  describe('attribute', () => {
    const link = {
      id: 'link-1',
      code: 'k7Qm2xR9pA',
      isActive: true,
      localAffiliateId: 'aff-1',
      offerId: 'offer-1',
      campaignId: null,
      localAffiliate: { id: 'aff-1', userId: 'aff-user', status: 'ACTIVE' },
      offer: { id: 'offer-1', integrationLevel: 'PROVIDER_API', status: 'ACTIVE', campaignLinks: [] },
    };

    it('rejects a self-referral and credits nobody', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        ...baseConversion,
        customerUserId: 'aff-user',
      });
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(link);

      const result: any = await service.attribute('conv-1', 'k7Qm2xR9pA');

      expect(result.attributed).toBe(false);
      expect(result.reason).toBe('SELF_REFERRAL');
      expect(prisma.affiliateAttribution.create).not.toHaveBeenCalled();
      expect(rewards.applyToConversion).not.toHaveBeenCalled();
      const update = prisma.affiliateConversion.update.mock.calls[0][0];
      expect(update.data.status).toBe('REJECTED');
    });

    it('expires a purchase made outside the attribution window', async () => {
      const conversion = {
        ...baseConversion,
        occurredAt: new Date('2026-12-30T10:00:00Z'),
      };
      prisma.affiliateConversion.findUnique.mockResolvedValue(conversion);
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(link);
      tracking.lastClickAt.mockResolvedValue(new Date('2026-11-01T10:00:00Z'));

      const result: any = await service.attribute('conv-1', 'k7Qm2xR9pA');

      expect(result.attributed).toBe(false);
      expect(result.reason).toBe('OUTSIDE_WINDOW');
      const update = prisma.affiliateConversion.update.mock.calls[0][0];
      expect(update.data.status).toBe('EXPIRED_UNATTRIBUTED');
    });

    it('attributes a purchase made inside the window', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue(baseConversion);
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(link);
      tracking.lastClickAt.mockResolvedValue(new Date('2026-11-05T10:00:00Z'));

      const result: any = await service.attribute('conv-1', 'k7Qm2xR9pA');

      expect(result.attributed).toBe(true);
      const attribution = prisma.affiliateAttribution.create.mock.calls[0][0].data;
      expect(attribution.windowDays).toBe(30);
      expect(attribution.confidence).toBe('HIGH');
      expect(attribution.attributionMethod).toBe(
        AffiliateAttributionMethod.INTERNAL_LAST_CLICK,
      );
    });

    it('records the effective window on the conversion so later policy changes do not rewrite history', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue(baseConversion);
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(link);
      tracking.lastClickAt.mockResolvedValue(new Date('2026-11-05T10:00:00Z'));

      await service.attribute('conv-1', 'k7Qm2xR9pA');

      const update = prisma.affiliateConversion.update.mock.calls[0][0];
      expect(update.data.attributionWindowDays).toBe(30);
    });

    it('attributes a redemption with MEDIUM confidence when there is no click', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        ...baseConversion,
        eventType: 'VERIFIED_REDEMPTION',
      });
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(link);

      await service.attribute('conv-1', 'k7Qm2xR9pA');

      const attribution = prisma.affiliateAttribution.create.mock.calls[0][0].data;
      expect(attribution.confidence).toBe('MEDIUM');
      expect(attribution.clickedAt).toBeNull();
    });

    it('does not double-attribute an already attributed conversion', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        ...baseConversion,
        attribution: { id: 'attr-existing' },
      });
      const result: any = await service.attribute('conv-1', 'k7Qm2xR9pA');
      expect(result.alreadyAttributed).toBe(true);
      expect(prisma.affiliateAttribution.create).not.toHaveBeenCalled();
    });

    it('marks unknown tracking codes as unmatched instead of throwing', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(null);
      const result: any = await service.attribute('conv-1', 'nope');
      expect(result.attributed).toBe(false);
      expect(result.reason).toBe('TRACKING_CODE_UNKNOWN');
    });
  });

  // ── Redemption-driven conversions ──────────────────────────────────────

  describe('createRedemptionConversion', () => {
    it('deduplicates on the redemption id', async () => {
      prisma.affiliateConversion.findFirst.mockResolvedValue({ id: 'existing' });
      const result = await service.createRedemptionConversion({
        providerId: 'prov-1',
        redemptionId: 'red-1',
        offerId: 'offer-1',
      } as any);
      expect(result.id).toBe('existing');
      expect(prisma.affiliateConversion.create).not.toHaveBeenCalled();
    });

    it('uses a stable provider transaction id derived from the redemption', async () => {
      await service.createRedemptionConversion({
        providerId: 'prov-1',
        redemptionId: 'red-1',
        offerId: 'offer-1',
      });
      const created = prisma.affiliateConversion.create.mock.calls[0][0].data;
      expect(created.providerTransactionId).toBe('redemption:red-1');
      expect(created.eventType).toBe('VERIFIED_REDEMPTION');
    });
  });

  // ── Maintenance ────────────────────────────────────────────────────────

  describe('expireStaleUnmatched', () => {
    it('ages out old unmatched conversions', async () => {
      prisma.affiliateConversion.updateMany.mockResolvedValue({ count: 3 });
      await expect(service.expireStaleUnmatched()).resolves.toBe(3);
      expect(prisma.affiliateConversion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'EXPIRED_UNATTRIBUTED' }),
        }),
      );
    });
  });
});
