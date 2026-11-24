import { LocalAffiliateService } from './local-affiliate.service';
import { LOCAL_AFFILIATE_TERMS_VERSION } from './local-affiliate.constants';

describe('LocalAffiliateService', () => {
  const profile = {
    id: 'aff-1',
    userId: 'user-1',
    affiliateCode: 'LAF-000125',
    status: 'ACTIVE',
    displayName: 'John',
    termsVersion: LOCAL_AFFILIATE_TERMS_VERSION,
    termsAcceptedAt: new Date(),
    activatedFrom: 'EXISTING_CHS',
    firstClickAt: null,
    firstRewardAt: null,
    createdAt: new Date(),
    cards: [{ provider: 'vcard', status: 'NOT_LINKED', externalCardId: null, linkedAt: null }],
  };

  const prisma: any = {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    localAffiliateProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    localAffiliateCard: { create: jest.fn() },
    customerProfile: { findUnique: jest.fn(), update: jest.fn() },
    affiliateConversion: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    affiliateClick: { count: jest.fn(), findMany: jest.fn() },
    affiliateOffer: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const config = {
    get: jest.fn().mockReturnValue('https://247gbs.test'),
  } as any;

  const auth = { login: jest.fn() } as any;
  const locationAssignment = {
    resolvePostcode: jest.fn(),
    assignCustomer: jest.fn(),
  } as any;
  const rewards = { getBalances: jest.fn() } as any;

  let service: LocalAffiliateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LocalAffiliateService(
      prisma,
      config,
      auth,
      locationAssignment,
      rewards,
    );
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    prisma.$queryRawUnsafe.mockResolvedValue([{ nextval: BigInt(125) }]);
    prisma.localAffiliateProfile.create.mockResolvedValue(profile);
    prisma.localAffiliateCard.create.mockResolvedValue({});
    prisma.localAffiliateProfile.findUnique.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue(null);
    rewards.getBalances.mockResolvedValue({
      unit: 'POINTS',
      pending: 0,
      approved: 0,
      available: 0,
      redeemed: 0,
      expired: 0,
      reversed: 0,
      totalEarned: 0,
    });
  });

  describe('links', () => {
    it('builds the personal page url from the frontend base', () => {
      expect(service.buildAffiliateLink('LAF-000125')).toBe(
        'https://247gbs.test/a/LAF-000125',
      );
    });

    it('builds the tracking redirect url', () => {
      expect(service.buildTrackingUrl('k7Qm2xR9pA')).toBe(
        'https://247gbs.test/r/k7Qm2xR9pA',
      );
    });
  });

  describe('activate (Scenario A)', () => {
    const dto = {
      termsVersion: LOCAL_AFFILIATE_TERMS_VERSION,
      acceptTerms: true,
    };

    it('rejects an admin account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
        deletedAt: null,
      });
      await expect(service.activate('user-1', dto)).rejects.toMatchObject({
        response: { message: 'AFFILIATE_NOT_ELIGIBLE' },
      });
    });

    it('requires explicit terms acceptance', async () => {
      await expect(
        service.activate('user-1', { ...dto, acceptTerms: false }),
      ).rejects.toMatchObject({ response: { message: 'TERMS_NOT_ACCEPTED' } });
    });

    it('rejects a stale terms version', async () => {
      await expect(
        service.activate('user-1', { ...dto, termsVersion: '2020-01-01' }),
      ).rejects.toMatchObject({ response: { message: 'TERMS_VERSION_OUTDATED' } });
    });

    it('returns the existing profile instead of creating a second identity', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'CUSTOMER',
        deletedAt: null,
      });
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(profile);

      const result: any = await service.activate('user-1', dto);

      expect(result.data.alreadyActive).toBe(true);
      expect(result.data.affiliateCode).toBe('LAF-000125');
      expect(prisma.localAffiliateProfile.create).not.toHaveBeenCalled();
      expect(prisma.localAffiliateCard.create).not.toHaveBeenCalled();
    });

    it('creates the profile and a card row for a new affiliate', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'CUSTOMER',
        deletedAt: null,
      });

      const result: any = await service.activate('user-1', {
        ...dto,
        inviteCode: 'QR-1',
      });

      expect(result.data.alreadyActive).toBe(false);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('local_affiliate_code_seq'),
      );
      const created = prisma.localAffiliateProfile.create.mock.calls[0][0].data;
      expect(created.affiliateCode).toBe('LAF-000125');
      expect(created.status).toBe('ACTIVE');
      expect(created.activatedFrom).toBe('EXISTING_CHS');
      expect(created.acquisitionRef).toBe('QR-1');
      expect(prisma.localAffiliateCard.create).toHaveBeenCalledWith({
        data: { localAffiliateId: 'aff-1', provider: 'vcard', status: 'NOT_LINKED' },
      });
    });

    it('never mutates the user role or the agency registration source', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'CUSTOMER',
        deletedAt: null,
      });
      await service.activate('user-1', dto);
      expect(prisma.user.update).not.toBeDefined();
    });
  });

  describe('register (Scenario B)', () => {
    const dto = {
      email: 'New@Example.com',
      password: 'Str0ngPass',
      firstName: 'Mary',
      lastName: 'Jones',
      termsVersion: LOCAL_AFFILIATE_TERMS_VERSION,
      acceptTerms: true,
    };

    it('rejects an email that already exists with a specific code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.register(dto as any)).rejects.toMatchObject({
        response: { message: 'EMAIL_ALREADY_REGISTERED' },
      });
      expect(prisma.localAffiliateProfile.create).not.toHaveBeenCalled();
    });

    it('rejects an email owned by a soft-deleted account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'deleted-user' });
      await expect(service.register(dto as any)).rejects.toMatchObject({
        response: { message: 'ACCOUNT_DELETED' },
      });
      expect(prisma.localAffiliateProfile.create).not.toHaveBeenCalled();
    });

    it('creates the user, wallet, customer profile and affiliate profile in one transaction', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.email) return null;
        if (where.id) {
          return { id: 'user-2', email: 'new@example.com', role: 'CUSTOMER' };
        }
        return null;
      });
      prisma.user.create = jest.fn().mockResolvedValue({
        id: 'user-2',
        email: 'new@example.com',
        customerProfile: { id: 'cp-1' },
      });
      prisma.customerProfile.update = jest.fn().mockResolvedValue({});
      prisma.localAffiliateProfile.create.mockResolvedValue({
        ...profile,
        status: 'PENDING',
        activatedFrom: 'NEW_CHS',
      });
      auth.login.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: { id: 'user-2' },
      });

      const result: any = await service.register(dto as any);

      expect(result.accessToken).toBe('token');
      expect(result.data.emailVerified).toBe(false);

      const created = prisma.localAffiliateProfile.create.mock.calls[0][0].data;
      expect(created.status).toBe('PENDING');
      expect(created.activatedFrom).toBe('NEW_CHS');
      expect(prisma.user.create).toHaveBeenCalled();
      const userData = prisma.user.create.mock.calls[0][0].data;
      expect(userData.role).toBe('CUSTOMER');
      expect(userData.registrationSource).toBe('local-affiliate');
      expect(userData.wallet.create).toBeDefined();
      expect(userData.customerProfile.create).toBeDefined();
    });

    it('does not set registrationSource to the agency portal value', async () => {
      prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.email) return null;
        if (where.referralCode) return null;
        if (where.id) return { id: 'user-2', email: 'new@example.com', role: 'CUSTOMER' };
        return null;
      });
      prisma.user.create = jest.fn().mockResolvedValue({
        id: 'user-2',
        customerProfile: { id: 'cp-1' },
      });
      auth.login.mockResolvedValue({ accessToken: 't', refreshToken: 'r', user: {} });

      await service.register(dto as any);

      const userData = prisma.user.create.mock.calls[0][0].data;
      expect(userData.registrationSource).not.toBe('affiliate-portal');
    });
  });

  describe('requireActiveProfile', () => {
    it('throws when the user has no profile', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(null);
      await expect(service.requireProfile('user-1')).rejects.toMatchObject({
        response: { message: 'AFFILIATE_PROFILE_NOT_FOUND' },
      });
    });

    it('blocks a PENDING profile (verification not finished)', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue({
        ...profile,
        status: 'PENDING',
      });
      await expect(service.requireActiveProfile('user-1')).rejects.toMatchObject({
        response: { message: 'AFFILIATE_NOT_ACTIVE' },
      });
    });

    it('blocks a SUSPENDED profile', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue({
        ...profile,
        status: 'SUSPENDED',
      });
      await expect(service.requireActiveProfile('user-1')).rejects.toMatchObject({
        response: { message: 'AFFILIATE_SUSPENDED' },
      });
    });

    it('returns an ACTIVE profile', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(profile);
      await expect(service.requireActiveProfile('user-1')).resolves.toBeDefined();
    });
  });

  describe('verifyEmail', () => {
    it('activates a PENDING profile when the code is correct', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue({
        ...profile,
        status: 'PENDING',
      });
      prisma.user.findUnique.mockResolvedValue({ email: 'new@example.com' });
      auth.verifyOtp = jest.fn().mockResolvedValue(true);
      prisma.localAffiliateProfile.update.mockResolvedValue({
        ...profile,
        status: 'ACTIVE',
      });

      const result: any = await service.verifyEmail('user-1', '123456');

      expect(result.data.status).toBe('ACTIVE');
      expect(prisma.localAffiliateProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('rejects a wrong code without activating', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue({
        ...profile,
        status: 'PENDING',
      });
      prisma.user.findUnique.mockResolvedValue({ email: 'new@example.com' });
      auth.verifyOtp = jest.fn().mockResolvedValue(false);

      await expect(service.verifyEmail('user-1', '000000')).rejects.toMatchObject({
        response: { message: 'INVALID_VERIFICATION_CODE' },
      });
      expect(prisma.localAffiliateProfile.update).not.toHaveBeenCalled();
    });

    it('is idempotent for an already active profile', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(profile);
      const result: any = await service.verifyEmail('user-1', '123456');
      expect(result.data.alreadyVerified).toBe(true);
      expect(prisma.localAffiliateProfile.update).not.toHaveBeenCalled();
    });

    it('404s when the caller has no affiliate profile', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(null);
      await expect(service.verifyEmail('user-1', '123456')).rejects.toMatchObject({
        response: { message: 'AFFILIATE_PROFILE_NOT_FOUND' },
      });
    });
  });

  describe('me / link', () => {
    it('returns null when the caller is not an affiliate yet', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(null);
      await expect(service.me('user-1')).resolves.toEqual({
        success: true,
        data: null,
      });
    });

    it('returns the profile with balances', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(profile);
      const result: any = await service.me('user-1');
      expect(result.data.affiliateCode).toBe('LAF-000125');
      expect(result.data.balances.available).toBe(0);
    });

    it('returns the permanent link and card status', async () => {
      prisma.localAffiliateProfile.findUnique.mockResolvedValue(profile);
      const result: any = await service.link('user-1');
      expect(result.data.personalPageUrl).toBe('https://247gbs.test/a/LAF-000125');
      expect(result.data.status).toBe('ACTIVE');
    });
  });
});
