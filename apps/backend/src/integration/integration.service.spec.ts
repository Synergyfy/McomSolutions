import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationService } from './integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let prisma: any;

  const mockPrisma = {
    businessProfile: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ─── getBusinessByApiKey ───────────────────────
  describe('getBusinessByApiKey', () => {
    it('should throw UnauthorizedException if API key is missing', async () => {
      await expect(service.getBusinessByApiKey('')).rejects.toThrow(UnauthorizedException);
      await expect(service.getBusinessByApiKey(null as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if business not found', async () => {
      mockPrisma.businessProfile.findUnique.mockResolvedValue(null);
      await expect(service.getBusinessByApiKey('invalid-key')).rejects.toThrow(UnauthorizedException);
    });

    it('should return business data with packages for valid key', async () => {
      const mockBusiness = {
        id: 'b1',
        businessName: 'Test Biz',
        businessType: 'retail',
        email: 'test@test.com',
        phone: '123',
        address: '14 High Street',
        postcode: 'NW1 0JH',
        category: 'Cafe',
        industry: 'Food & Beverage',
        description: 'A test business',
        logoUrl: 'https://example.com/logo.png',
        openingHours: '9-5',
        socialMedia: '@test',
        membershipLevel: 'Silver',
        membershipTier: 'Pro',
        membershipStatus: 'active',
        proximityTier: 'high_street',
        packages: [
          { platform: 'mall', packageName: 'Standard', status: 'active', limits: { campaignsLimit: 5 } },
        ],
      };
      mockPrisma.businessProfile.findUnique.mockResolvedValue(mockBusiness);

      const result = await service.getBusinessByApiKey('valid-api-key');
      expect(result.businessId).toBe('b1');
      expect(result.businessName).toBe('Test Biz');
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].platform).toBe('mall');
    });
  });
});
