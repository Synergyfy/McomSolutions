import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { NotFoundException } from '@nestjs/common';

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
  };

  const mockAuthService = {
    login: jest.fn().mockResolvedValue({ accessToken: 'mock-token', user: { id: 'user-1' } }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: mockAuthService },
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

    it('should return fallback address on API failure', async () => {
      const result = await service.searchAddresses('NW1 0JH');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].postcode).toBe('NW1 0JH');
    });
  });

  // ─── checkLocationProximity ─────────────────────
  describe('checkLocationProximity', () => {
    it('should return fallback result when postcodes.io fails', async () => {
      const result = await service.checkLocationProximity('NW1 0JH');
      expect(result.resolvedArea).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  // ─── searchGoogleBusinesses ────────────────────
  describe('searchGoogleBusinesses', () => {
    it('should return all mock results when no query', async () => {
      const result = await service.searchGoogleBusinesses('');
      expect(result).toHaveLength(3);
    });

    it('should filter results by query text', async () => {
      const result = await service.searchGoogleBusinesses('Coffee');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('The Coffee Lounge');
    });

    it('should be case-insensitive', async () => {
      const result = await service.searchGoogleBusinesses('coffee');
      expect(result).toHaveLength(1);
    });
  });

  // ─── getGooglePlaceDetails ─────────────────────
  describe('getGooglePlaceDetails', () => {
    it('should return details for known place ID', async () => {
      const result = await service.getGooglePlaceDetails('mock-place-001');
      expect(result.name).toBe('The Coffee Lounge');
      expect(result.postcode).toBe('NW1 0JH');
    });

    it('should throw NotFoundException for unknown place ID', async () => {
      await expect(service.getGooglePlaceDetails('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── claimStart ────────────────────────────────
  describe('claimStart', () => {
    it('should generate auth URL with placeId and returnUrl', async () => {
      const result = await service.claimStart('mock-place-001', 'https://example.com/return');
      expect(result.authUrl).toContain('mock-place-001');
      expect(result.authUrl).toContain(encodeURIComponent('https://example.com/return'));
    });
  });

  // ─── mapGoogleCategory ─────────────────────────
  describe('mapGoogleCategory', () => {
    it('should return mapped category for known ID', async () => {
      const result = await service.mapGoogleCategory('gcid:coffee_shop');
      expect(result.sectorId).toBe('sector-2');
      expect(result.categoryId).toBe('cat-4');
    });

    it('should return default for unknown ID', async () => {
      const result = await service.mapGoogleCategory('gcid:unknown');
      expect(result.sectorId).toBe('sector-1');
    });
  });

  // ─── completeGoogleOnboarding ──────────────────
  describe('completeGoogleOnboarding', () => {
    it('should login existing user and update profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'existing@test.com' });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'existing@test.com',
        businessProfile: { id: 'b1', businessName: 'Updated Biz' },
      });

      const result = await service.completeGoogleOnboarding({
        email: 'existing@test.com',
        businessName: 'Updated Biz',
        googlePlaceId: 'mock-place-001',
      });

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(authService.login).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-token');
    });

    it('should create new user and business when not existing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'new@test.com',
        businessProfile: { id: 'b-new' },
      });
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await service.completeGoogleOnboarding({
        email: 'new@test.com',
        businessName: 'New Biz',
        googlePlaceId: 'mock-place-002',
      });

      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.notification.createMany).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-token');
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
    it('should update and return profile', async () => {
      const updated = { id: 'b1', businessName: 'Updated' };
      mockPrisma.businessProfile.update.mockResolvedValue(updated);
      const result = await service.updateProfile('b1', { businessName: 'Updated' });
      expect(result.businessName).toBe('Updated');
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
});
