import { AffiliateCatalogueService } from './affiliate-catalogue.service';

describe('AffiliateCatalogueService', () => {
  const prisma: any = {
    affiliateOffer: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    affiliateTrackingLink: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    affiliateCampaignOffer: { findUnique: jest.fn() },
    affiliateCampaign: { findMany: jest.fn(), findUnique: jest.fn() },
    affiliateRewardRule: { findMany: jest.fn() },
    localAffiliateProfile: { findUnique: jest.fn() },
    customerProfile: { findUnique: jest.fn() },
    businessProfile: { findFirst: jest.fn() },
  };

  const affiliates = {
    requireActiveProfile: jest.fn(),
    buildTrackingUrl: (code: string) => `https://247gbs.test/r/${code}`,
  } as any;

  let service: AffiliateCatalogueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AffiliateCatalogueService(prisma, affiliates);
    prisma.localAffiliateProfile.findUnique.mockResolvedValue({
      id: 'aff-1',
      status: 'ACTIVE',
      userId: 'user-1',
      user: { role: 'CUSTOMER' },
    });
    prisma.customerProfile.findUnique.mockResolvedValue({
      cityId: 'city-1',
      boroughId: 'borough-1',
      highStreetId: null,
      localMallId: null,
    });
    prisma.businessProfile.findFirst.mockResolvedValue(null);
    prisma.affiliateRewardRule.findMany.mockResolvedValue([]);
    prisma.affiliateOffer.count.mockResolvedValue(0);
  });

  // ── Provider URL building (PRD §8) ─────────────────────────────────────

  describe('buildProviderUrl', () => {
    it('appends an opaque `laf` param for an internal/Mall offer', () => {
      const url = service.buildProviderUrl('k7Qm2xR9pA', {
        destinationUrl: 'https://mall.test/product/abc',
        provider: { code: 'mcom_mall', type: 'INTERNAL_PLATFORM' },
      });
      expect(url).toBe('https://mall.test/product/abc?laf=k7Qm2xR9pA');
    });

    it('uses ThriveCart passthrough variables', () => {
      const url = service.buildProviderUrl('k7Qm2xR9pA', {
        destinationUrl: 'https://vendor.thrivecart.com/product/',
        provider: { code: 'thrivecart', type: 'EXTERNAL_CHECKOUT' },
      });
      expect(url).toContain('passthrough%5Bla_tracking_id%5D=k7Qm2xR9pA');
    });

    it('uses Awin clickRef — the only field a publisher can always read back', () => {
      const url = service.buildProviderUrl('k7Qm2xR9pA', {
        destinationUrl: 'https://advertiser.test/offer',
        provider: { code: 'awin', type: 'AFFILIATE_NETWORK' },
      });
      expect(url).toBe('https://advertiser.test/offer?clickref=k7Qm2xR9pA');
      expect(url).not.toContain('orderRef');
    });

    it('never includes the affiliate code, offer id or campaign id', () => {
      const url = service.buildProviderUrl('k7Qm2xR9pA', {
        destinationUrl: 'https://ext.test/x',
        provider: { code: 'tamina', type: 'EXTERNAL_BUSINESS' },
      });
      expect(url).not.toContain('LAF-');
      expect(url).not.toContain('offer');
    });
  });

  // ── Marketplace eligibility (FR-14) ────────────────────────────────────

  describe('listOffers', () => {
    const baseOffer = {
      id: 'offer-1',
      slug: 'haircut',
      title: 'Haircut',
      subtitle: null,
      description: null,
      imageUrl: null,
      media: [],
      rewardRuleId: null,
      customerBenefit: null,
      redemptionMethod: 'PLATFORM_CODE',
      integrationLevel: 'REDEMPTION_CODE',
      eligibilityScope: 'GLOBAL',
      eligibility: null,
      startsAt: null,
      endsAt: null,
      businessId: null,
      allowOwnerPromotion: false,
      provider: { code: 'mcom_mall', name: 'MCOM Mall', type: 'INTERNAL_PLATFORM' },
      category: { slug: 'local-businesses', name: 'Local Businesses' },
      externalBusiness: null,
    };

    it('hides a city-scoped offer from an affiliate in another city', async () => {
      prisma.affiliateOffer.findMany.mockResolvedValue([
        {
          ...baseOffer,
          eligibilityScope: 'CITY',
          eligibility: { cityIds: ['city-other'] },
        },
      ]);

      const result: any = await service.listOffers({} as any, 'user-1');
      expect(result.data).toHaveLength(0);
    });

    it('shows a city-scoped offer to an affiliate in that city', async () => {
      prisma.affiliateOffer.findMany.mockResolvedValue([
        {
          ...baseOffer,
          eligibilityScope: 'CITY',
          eligibility: { cityIds: ['city-1'] },
        },
      ]);

      const result: any = await service.listOffers({} as any, 'user-1');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].canPromote).toBe(true);
    });

    it('shows GLOBAL offers to an anonymous visitor but marks them non-promotable', async () => {
      prisma.affiliateOffer.findMany.mockResolvedValue([baseOffer]);
      const result: any = await service.listOffers({} as any, undefined);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].canPromote).toBe(false);
    });

    it('degrades location-scoped offers to hidden when the affiliate has no postcode', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);
      prisma.affiliateOffer.findMany.mockResolvedValue([
        {
          ...baseOffer,
          eligibilityScope: 'CITY',
          eligibility: { cityIds: ['city-1'] },
        },
      ]);
      const result: any = await service.listOffers({} as any, 'user-1');
      expect(result.data).toHaveLength(0);
    });
  });

  // ── Link creation (FR-2, FR-5.2) ───────────────────────────────────────

  describe('createLink', () => {
    const offer = {
      id: 'offer-1',
      status: 'ACTIVE',
      providerId: 'prov-1',
      destinationUrl: 'https://mall.test/p/1',
      businessId: null,
      allowOwnerPromotion: false,
      provider: { code: 'mcom_mall', type: 'INTERNAL_PLATFORM' },
    };

    beforeEach(() => {
      affiliates.requireActiveProfile.mockResolvedValue({
        id: 'aff-1',
        status: 'ACTIVE',
        affiliateCode: 'LAF-000125',
      });
      prisma.affiliateOffer.findUnique.mockResolvedValue(offer);
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(null);
      prisma.affiliateTrackingLink.create.mockImplementation(async ({ data }: any) => ({
        id: 'link-1',
        ...data,
        providerLinkUrl: null,
      }));
      prisma.affiliateTrackingLink.update.mockResolvedValue({});
    });

    it('creates an opaque tracking code and returns the tracking + destination urls', async () => {
      const result: any = await service.createLink('user-1', 'offer-1', {});

      expect(result.data.trackingCode).toMatch(/^[0-9a-zA-Z]{10}$/);
      expect(result.data.trackingUrl).toContain('/r/');
      expect(result.data.destinationUrl).toContain('?laf=');
      expect(result.data.destinationUrl).not.toContain('LAF-000125');
    });

    it('is idempotent: returns the existing link for the same offer', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        id: 'link-1',
        code: 'existing12',
        providerLinkUrl: 'https://mall.test/p/1?laf=existing12',
      });

      const result: any = await service.createLink('user-1', 'offer-1', {});
      expect(result.data.trackingCode).toBe('existing12');
      expect(prisma.affiliateTrackingLink.create).not.toHaveBeenCalled();
    });

    it('blocks promoting your own business offer', async () => {
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        ...offer,
        businessId: 'biz-1',
      });
      prisma.businessProfile.findFirst.mockResolvedValue({ id: 'biz-1' });

      await expect(service.createLink('user-1', 'offer-1', {})).rejects.toMatchObject(
        { response: { message: 'OFFER_NOT_ELIGIBLE' } },
      );
    });

    it('allows self-promotion when the offer explicitly permits it', async () => {
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        ...offer,
        businessId: 'biz-1',
        allowOwnerPromotion: true,
      });
      prisma.businessProfile.findFirst.mockResolvedValue({ id: 'biz-1' });

      await expect(service.createLink('user-1', 'offer-1', {})).resolves.toBeDefined();
    });

    it('requires the offer to belong to the campaign when a campaignId is supplied', async () => {
      prisma.affiliateCampaignOffer.findUnique.mockResolvedValue(null);
      await expect(
        service.createLink('user-1', 'offer-1', { campaignId: 'camp-1' }),
      ).rejects.toThrow(/not part of the requested campaign/);
    });

    it('refuses a paused or ended offer', async () => {
      prisma.affiliateOffer.findUnique.mockResolvedValue({
        ...offer,
        status: 'PAUSED',
      });
      await expect(service.createLink('user-1', 'offer-1', {})).rejects.toThrow(
        /not found or not active/,
      );
    });
  });
});
