import { AffiliateTrackingService } from './affiliate-tracking.service';

describe('AffiliateTrackingService', () => {
  const prisma: any = {
    affiliateTrackingLink: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    affiliateClick: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    localAffiliateProfile: { updateMany: jest.fn() },
  };

  const catalogue = {
    buildProviderUrl: jest.fn(
      (_code: string, offer: any) => `${offer.destinationUrl}?laf=${_code}`,
    ),
  } as any;

  let service: AffiliateTrackingService;

  const activeLink = {
    id: 'link-1',
    code: 'k7Qm2xR9pA',
    isActive: true,
    localAffiliateId: 'aff-1',
    offerId: 'offer-1',
    providerLinkUrl: null,
    offer: {
      id: 'offer-1',
      status: 'ACTIVE',
      destinationUrl: 'https://mall.test/p/1',
      provider: { code: 'mcom_mall', type: 'INTERNAL_PLATFORM' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AffiliateTrackingService(prisma, catalogue);
    prisma.affiliateTrackingLink.findUnique.mockResolvedValue(activeLink);
    prisma.affiliateClick.create.mockResolvedValue({});
    prisma.affiliateTrackingLink.update.mockResolvedValue({});
    prisma.localAffiliateProfile.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('resolveAndRecord', () => {
    it('resolves the destination and records a click', async () => {
      const result = await service.resolveAndRecord('k7Qm2xR9pA', {
        ip: '203.0.113.7',
        headers: { 'user-agent': 'Jest' } as any,
      });

      expect(result?.destinationUrl).toBe(
        'https://mall.test/p/1?laf=k7Qm2xR9pA',
      );
      expect(prisma.affiliateClick.create).toHaveBeenCalled();

      const click = prisma.affiliateClick.create.mock.calls[0][0].data;
      expect(click.hashedIp ?? click.ipHash).toBeTruthy();
      expect(JSON.stringify(click)).not.toContain('203.0.113.7');
    });

    it('returns null for an unknown code so the controller can redirect to the index', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(null);
      await expect(service.resolveAndRecord('nope')).resolves.toBeNull();
    });

    it('returns null for an inactive link', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        ...activeLink,
        isActive: false,
      });
      await expect(service.resolveAndRecord('k7Qm2xR9pA')).resolves.toBeNull();
    });

    it('returns null when the offer is no longer active', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        ...activeLink,
        offer: { ...activeLink.offer, status: 'ENDED' },
      });
      await expect(service.resolveAndRecord('k7Qm2xR9pA')).resolves.toBeNull();
    });

    it('still resolves when click persistence fails (the visitor is never blocked)', async () => {
      prisma.affiliateClick.create.mockRejectedValue(new Error('db down'));
      const result = await service.resolveAndRecord('k7Qm2xR9pA');
      expect(result?.destinationUrl).toBe(
        'https://mall.test/p/1?laf=k7Qm2xR9pA',
      );
    });

    it('still resolves when the link lookup itself throws', async () => {
      prisma.affiliateTrackingLink.findUnique.mockRejectedValue(new Error('db down'));
      await expect(service.resolveAndRecord('k7Qm2xR9pA')).resolves.toBeNull();
    });

    it('prefers a stored provider link url when one exists', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        ...activeLink,
        providerLinkUrl: 'https://prebuilt.test/x?clickref=k7Qm2xR9pA',
      });
      const result = await service.resolveAndRecord('k7Qm2xR9pA');
      expect(result?.destinationUrl).toBe('https://prebuilt.test/x?clickref=k7Qm2xR9pA');
      expect(catalogue.buildProviderUrl).not.toHaveBeenCalled();
    });
  });

  describe('validateCode', () => {
    it('reports valid with ids but no PII', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        id: 'link-1',
        localAffiliateId: 'aff-1',
        offerId: 'offer-1',
        campaignId: null,
        isActive: true,
        offer: { id: 'offer-1', status: 'ACTIVE', endsAt: null },
        localAffiliate: { id: 'aff-1', status: 'ACTIVE' },
      });

      const result: any = await service.validateCode('k7Qm2xR9pA');
      expect(result.data.valid).toBe(true);
      expect(result.data.affiliateId).toBe('aff-1');
      expect(JSON.stringify(result)).not.toMatch(/email|phone|postcode/i);
    });

    it('reports invalid for a suspended affiliate', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        id: 'link-1',
        isActive: true,
        offer: { id: 'offer-1', status: 'ACTIVE', endsAt: null },
        localAffiliate: { id: 'aff-1', status: 'SUSPENDED' },
      });
      const result: any = await service.validateCode('x');
      expect(result.data.valid).toBe(false);
      expect(result.data.affiliateId).toBeNull();
    });

    it('reports invalid for an expired offer', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue({
        id: 'link-1',
        isActive: true,
        offer: { id: 'o', status: 'ACTIVE', endsAt: new Date(Date.now() - 1000) },
        localAffiliate: { id: 'a', status: 'ACTIVE' },
      });
      const result: any = await service.validateCode('x');
      expect(result.data.valid).toBe(false);
    });

    it('reports invalid for an unknown code without throwing', async () => {
      prisma.affiliateTrackingLink.findUnique.mockResolvedValue(null);
      const result: any = await service.validateCode('nope');
      expect(result.data.valid).toBe(false);
    });
  });

  describe('lastClickAt', () => {
    it('returns the most recent click time', async () => {
      const at = new Date('2026-11-01T00:00:00Z');
      prisma.affiliateClick.findFirst.mockResolvedValue({ occurredAt: at });
      await expect(service.lastClickAt('link-1')).resolves.toBe(at);
    });

    it('returns null when there is no click', async () => {
      prisma.affiliateClick.findFirst.mockResolvedValue(null);
      await expect(service.lastClickAt('link-1')).resolves.toBeNull();
    });
  });
});
