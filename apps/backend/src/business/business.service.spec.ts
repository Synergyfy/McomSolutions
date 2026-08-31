import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException, ConflictException, UnauthorizedException } from '@nestjs/common';

// Force external lookups (Nominatim, postcodes.io) to fail so the service
// exercise its error paths deterministically without network access.
jest.mock('axios', () => ({
  get: jest.fn().mockRejectedValue(new Error('network error')),
  post: jest.fn().mockRejectedValue(new Error('network error')),
}));

describe('BusinessService', () => {
  let service: BusinessService;
  let prisma: any;
  let authService: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    businessProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    localMall: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    membershipPlan: {
      findFirst: jest.fn().mockResolvedValue({ name: 'Bronze', price: 10 }),
    },
    googleCategoryMapping: {
      findUnique: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
  };

  const mockAuthService = {
    login: jest.fn().mockResolvedValue({ accessToken: 'mock-token', user: { id: 'user-1' } }),
  };

  const mockGoogleOAuth = {
    isConfigured: jest.fn().mockReturnValue(true),
    isSimulatorEnabled: jest.fn().mockReturnValue(false),
    getAuthUrl: jest.fn(
      (state: string, options?: any) =>
        `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}&scope=${options?.scopes || 'openid email profile'}`,
    ),
    signState: jest.fn((payload: object) => `signed.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`),
    verifyState: jest.fn(() => null),
    signEmailGrant: jest.fn((email: string, placeId?: string) => `grant.${Buffer.from(JSON.stringify({ email, placeId })).toString('base64url')}`),
    verifyEmailGrant: jest.fn(() => null),
    exchangeCodeForEmail: jest.fn(),
    getRedirectUri: jest.fn(() => 'http://localhost:3010/api/v1/business/google/callback'),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => (key === 'APP_URL' ? 'http://localhost:3010' : undefined)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: GoogleOAuthService, useValue: mockGoogleOAuth },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
    prisma = module.get(PrismaService);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  // ─── searchAddresses ─────────────────────────────
  describe('searchAddresses', () => {
    it('should return empty array for short postcodes', async () => {
      const result = await service.searchAddresses('ab');
      expect(result).toEqual([]);
    });

    it('should return empty array on API failure (no fabricated fallback)', async () => {
      const result = await service.searchAddresses('NW1 0JH');
      expect(result).toEqual([]);
    });
  });

  // ─── checkLocationProximity ─────────────────────
  describe('checkLocationProximity', () => {
    it('should return an inactive result when postcodes.io fails and no mall matches', async () => {
      const result = await service.checkLocationProximity('NW1 0JH');
      expect(result.resolvedArea).toBeDefined();
      expect(result.status).toBe('inactive');
      expect(result.localMallId).toBeNull();
    });

    it('should return the matching LocalMall when the postcode area is covered', async () => {
      mockPrisma.localMall.findMany.mockResolvedValue([
        { id: 'mall-1', name: 'Peckham LocalMall', borough: 'Southwark', postcodes: ['SE15', 'SE5', 'SE22'] },
      ]);
      const result = await service.checkLocationProximity('SE15 4PT');
      expect(result.status).toBe('active');
      expect(result.localMallId).toBe('mall-1');
      expect(result.localMallName).toBe('Peckham LocalMall');
    });
  });

  // ─── searchGoogleBusinesses ────────────────────
  describe('searchGoogleBusinesses', () => {
    it('should throw ServiceUnavailableException when the API key is not configured', async () => {
      await expect(service.searchGoogleBusinesses('Coffee')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ─── getGooglePlaceDetails ─────────────────────
  describe('getGooglePlaceDetails', () => {
    it('should throw ServiceUnavailableException when the API key is not configured', async () => {
      await expect(service.getGooglePlaceDetails('mock-place-001')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ─── claimStart ────────────────────────────────
  describe('claimStart', () => {
    it('should generate a signed Google auth URL with claim state', async () => {
      const result = await service.claimStart('mock-place-001', 'https://example.com/return');
      expect(result.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(mockGoogleOAuth.signState).toHaveBeenCalledWith({
        type: 'claim',
        placeId: 'mock-place-001',
        returnUrl: 'https://example.com/return',
      });
    });

    it('should throw ServiceUnavailableException when Google OAuth is not configured and simulator is off', async () => {
      mockGoogleOAuth.isConfigured.mockReturnValue(false);
      await expect(service.claimStart('mock-place-001', 'https://example.com/return')).rejects.toThrow();
    });

    it('should return the simulator URL when Google is unconfigured and the simulator is enabled (dev)', async () => {
      mockGoogleOAuth.isConfigured.mockReturnValue(false);
      mockGoogleOAuth.isSimulatorEnabled.mockReturnValue(true);
      const result = await service.claimStart('mock-place-001', 'https://example.com/return');
      expect(result.authUrl).toContain('/api/v1/business/google-claim-simulator');
    });
  });

  // ─── mapGoogleCategory ─────────────────────────
  describe('mapGoogleCategory', () => {
    it('should return mapped category for known ID', async () => {
      mockPrisma.googleCategoryMapping.findUnique.mockResolvedValue({
        googleType: 'coffee_shop',
        category: {
          id: 'cat-coffee',
          name: 'Cafes & Coffee',
          sectorId: 'sec-food',
          sector: { name: 'Food & Drink' },
          subCategories: [{ id: 'sub-coffee' }],
        },
      });
      const result = await service.mapGoogleCategory('gcid:coffee_shop');
      expect(result.sectorId).toBe('sec-food');
      expect(result.categoryId).toBe('cat-coffee');
      expect(result.subCategoryId).toBe('sub-coffee');
    });

    it('should return default category for unknown ID', async () => {
      mockPrisma.googleCategoryMapping.findUnique.mockResolvedValue(null);
      mockPrisma.category.findFirst.mockResolvedValue({
        id: 'cat-other',
        name: 'Other',
        sectorId: 'sec-other',
        sector: { name: 'Other' },
        subCategories: [{ id: 'sub-other' }],
      });
      const result = await service.mapGoogleCategory('gcid:unknown');
      expect(result.categoryId).toBe('cat-other');
    });
  });

  // ─── completeGoogleOnboarding ──────────────────
  describe('completeGoogleOnboarding', () => {
    it('should update and login an existing user when a valid Google grant is presented', async () => {
      mockGoogleOAuth.verifyEmailGrant.mockReturnValue({
        email: 'existing@test.com',
        placeId: 'mock-place-001',
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'existing@test.com' });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'existing@test.com',
        businessProfile: { id: 'b1', businessName: 'Updated Biz' },
      });

      const result = await service.completeGoogleOnboarding({
        email: 'attacker-controlled@test.com', // must be ignored — grant wins
        grant: 'signed.grant.token',
        businessName: 'Updated Biz',
        googlePlaceId: 'mock-place-001',
      });

      expect(mockGoogleOAuth.verifyEmailGrant).toHaveBeenCalledWith('signed.grant.token');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'existing@test.com' },
      });
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(authService.login).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-token');
    });

    it('should throw ConflictException and never touch an existing account without a grant', async () => {
      mockGoogleOAuth.verifyEmailGrant.mockReturnValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'existing@test.com' });

      await expect(
        service.completeGoogleOnboarding({
          email: 'existing@test.com',
          businessName: 'Hijacked Biz',
          googlePlaceId: 'mock-place-001',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should create a new user using the verified grant email', async () => {
      mockGoogleOAuth.verifyEmailGrant.mockReturnValue({
        email: 'new@test.com',
        placeId: 'mock-place-002',
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'new@test.com',
        businessProfile: { id: 'b-new' },
      });
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await service.completeGoogleOnboarding({
        email: 'forged@test.com', // must be ignored — grant wins
        grant: 'signed.grant.token',
        businessName: 'New Biz',
        googlePlaceId: 'mock-place-002',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@test.com' }),
        }),
      );
      expect(mockPrisma.notification.createMany).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-token');
    });

    it('should allow manual creation (no grant, no googlePlaceId) for a brand-new account', async () => {
      mockGoogleOAuth.verifyEmailGrant.mockReturnValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'manual-user',
        email: 'manual@test.com',
        businessProfile: { id: 'b-manual' },
      });
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await service.completeGoogleOnboarding({
        email: 'manual@test.com',
        businessName: 'Manual Biz',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'manual@test.com' }),
        }),
      );
      expect(result.accessToken).toBe('mock-token');
    });

    it('should reject a new-account Google claim without a grant', async () => {
      mockGoogleOAuth.verifyEmailGrant.mockReturnValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.completeGoogleOnboarding({
          email: 'claimed@test.com',
          googlePlaceId: 'mock-place-003',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  // ─── getProfile ────────────────────────────────
  describe('getProfile', () => {
    it('should return profile if found', async () => {
      const profile = { id: 'b1', businessName: 'Test Biz', user: {}, packages: [] };
      mockPrisma.businessProfile.findUnique.mockResolvedValue(profile);
      const result = await service.getProfile('b1');
      expect(result).toEqual(profile);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('b-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateProfile ─────────────────────────────
  describe('updateProfile', () => {
    it('should update and return profile with standard inputs', async () => {
      const updated = { id: 'b1', businessName: 'Updated' };
      mockPrisma.businessProfile.update.mockResolvedValue(updated);
      const result = await service.updateProfile('b1', { businessName: 'Updated' });
      expect(result.businessName).toBe('Updated');
    });

    it('should correctly map nested manual onboarding inputs', async () => {
      mockPrisma.businessProfile.update.mockImplementation((args: any) => {
        return Promise.resolve({
          id: args.where.id,
          ...args.data,
        });
      });

      const result = await service.updateProfile('b1', {
        businessName: 'Super Store',
        businessPhone: '0123456789',
        shortDescription: 'Best store in London',
        listingType: ['product', 'service'],
        location: {
          addressLine1: '456 Oxford St',
          postcode: 'W1D 1AN',
        },
        sectorId: 'retail-sector',
        categoryId: 'retail-category',
        subCategoryId: 'retail-subcategory',
        businessHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00' },
          { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00' },
        ],
      });

      expect(result.businessName).toBe('Super Store');
      expect(result.phone).toBe('0123456789');
      expect(result.description).toBe('Best store in London');
      expect(result.businessType).toBe('both');
      expect(result.address).toBe('456 Oxford St');
      expect(result.postcode).toBe('W1D 1AN');
      expect(result.industry).toBe('retail-sector');
      expect(result.category).toBe('retail-category');
      expect(result.subCategory).toBe('retail-subcategory');
      expect(result.openingHours).toBe('Monday: 09:00 - 18:00, Tuesday: 09:00 - 18:00');
    });
  });

  // ─── generateApiKey ────────────────────────────
  describe('generateApiKey', () => {
    it('should generate a new API key', async () => {
      mockPrisma.businessProfile.update.mockResolvedValue({ apiKey: 'mcom_central_abc123' });
      const result = await service.generateApiKey('b1');
      expect(result.apiKey).toContain('mcom_central_');
    });
  });

  // ─── findAll ───────────────────────────────────
  describe('findAll', () => {
    it('should return all profiles', async () => {
      mockPrisma.businessProfile.findMany.mockResolvedValue([{ id: 'b1' }]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by search query', async () => {
      mockPrisma.businessProfile.findMany.mockResolvedValue([{ id: 'b1', businessName: 'Test' }]);
      const result = await service.findAll('Test');
      expect(result).toHaveLength(1);
      expect(mockPrisma.businessProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              expect.objectContaining({ businessName: expect.anything() }),
            ]),
          },
        }),
      );
    });
  });

  // ─── findOne ───────────────────────────────────
  describe('findOne', () => {
    it('should return profile with relations if found', async () => {
      const profile = { id: 'b1', user: {}, packages: [], transactions: [] };
      mockPrisma.businessProfile.findUnique.mockResolvedValue(profile);
      const result = await service.findOne('b1');
      expect(result).toEqual(profile);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue(null);
      await expect(service.findOne('b-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteBusiness ────────────────────────────
  describe('deleteBusiness', () => {
    it('should delete user and return success', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue({ id: 'b1', userId: 'user-1' });
      mockPrisma.user.delete.mockResolvedValue({});
      const result = await service.deleteBusiness('b1');
      expect(result.success).toBe(true);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should throw NotFoundException if profile not found', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue(null);
      await expect(service.deleteBusiness('b-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── handleGoogleCallback ───────────────────────
  describe('handleGoogleCallback', () => {
    it('should return failure script when state is invalid or forged', async () => {
      mockGoogleOAuth.verifyState.mockReturnValue(null);
      const result = await service.handleGoogleCallback('mock-code', 'forged-state');
      expect(result).toContain('GOOGLE_CLAIM_RESULT');
      expect(result).toContain('success: false');
    });

    it('should return failure script for a claim with a malicious placeId', async () => {
      mockGoogleOAuth.verifyState.mockReturnValue({
        type: 'claim',
        placeId: 'mock-place-001<script>alert(1)</script>',
        returnUrl: 'http://localhost:3000',
      });
      const result = await service.handleGoogleCallback('real-code', 'signed-state');
      expect(result).toContain('GOOGLE_CLAIM_RESULT');
      expect(result).toContain('success: false');
    });

    it('should return success script if token exchange and profile fetch succeeds', async () => {
      mockGoogleOAuth.verifyState.mockReturnValue({
        type: 'claim',
        placeId: 'mock-place-001',
        returnUrl: 'http://localhost:3000',
      });
      mockGoogleOAuth.exchangeCodeForEmail.mockResolvedValue('business-owner@test.com');

      const result = await service.handleGoogleCallback('real-code', 'signed-state');
      expect(result).toContain('success: true');
      expect(result).toContain('placeId: \'mock-place-001\'');
      expect(mockGoogleOAuth.signEmailGrant).toHaveBeenCalledWith(
        'business-owner@test.com',
        'mock-place-001',
      );
      expect(result).toContain('grant');
      expect(mockGoogleOAuth.exchangeCodeForEmail).toHaveBeenCalledWith(
        'real-code',
        'http://localhost:3010/api/v1/business/google/callback',
      );
    });

    it('should reject the mock-google-code when the simulator is disabled', async () => {
      mockGoogleOAuth.verifyState.mockReturnValue({ type: 'login' });
      const result = await service.handleGoogleCallback('mock-google-code', 'signed-state');
      expect(result).toContain('GOOGLE_LOGIN_FAILURE');
      expect(mockGoogleOAuth.exchangeCodeForEmail).not.toHaveBeenCalled();
    });

    it('should not auto-create an account when the Google email has no MCOM user', async () => {
      mockGoogleOAuth.verifyState.mockReturnValue({ type: 'login' });
      mockGoogleOAuth.exchangeCodeForEmail.mockResolvedValue('new-user@test.com');
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.handleGoogleCallback('real-code', 'signed-state');
      expect(result).toContain('GOOGLE_LOGIN_FAILURE');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should login an existing user and emit GOOGLE_LOGIN_SUCCESS', async () => {
      mockGoogleOAuth.verifyState.mockReturnValue({ type: 'login' });
      mockGoogleOAuth.exchangeCodeForEmail.mockResolvedValue('existing@test.com');
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'existing@test.com' });

      const result = await service.handleGoogleCallback('real-code', 'signed-state', { cookie: jest.fn() });
      expect(result).toContain('GOOGLE_LOGIN_SUCCESS');
      expect(authService.login).toHaveBeenCalled();
    });
  });
});
