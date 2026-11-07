import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralCommissionService } from './referral-commission.service';

describe('ReferralsService', () => {
  let service: ReferralsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('https://app.example.com'),
  };

  const mockCommission = {
    getEarningsForUser: jest.fn(),
    getReferrerAdminSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: ReferralCommissionService, useValue: mockCommission },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue('https://app.example.com');
  });

  describe('getMyReferralInfo', () => {
    it('returns code and link for a user with a code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'BUSINESS',
        referralCode: 'A1B2C3D4',
      });
      const result = await service.getMyReferralInfo('u1');
      expect(result).toEqual({
        success: true,
        referralCode: 'A1B2C3D4',
        referralLink: 'https://app.example.com/register?ref=A1B2C3D4',
      });
    });

    it('throws 404 for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMyReferralInfo('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lazily assigns a code to a non-admin user without one', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', role: 'BUSINESS', referralCode: null })
        // uniqueness check for the generated candidate
        .mockResolvedValueOnce(null);
      mockPrisma.user.update.mockResolvedValue({ id: 'u1' });

      const result = await service.getMyReferralInfo('u1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { referralCode: expect.stringMatching(/^[A-F0-9]{8}$/) },
        }),
      );
      expect(result.referralCode).toMatch(/^[A-F0-9]{8}$/);
      expect(result.referralLink).toBe(
        `https://app.example.com/register?ref=${result.referralCode}`,
      );
    });

    it('rejects admin accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin1',
        role: 'ADMIN',
        referralCode: null,
      });
      await expect(service.getMyReferralInfo('admin1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('listMyReferrals', () => {
    it('returns a paginated envelope scoped to the caller', async () => {
      const rows = [
        { id: 'u2', email: 'b@example.com', firstName: 'B', lastName: null, role: 'BUSINESS', createdAt: new Date() },
      ];
      mockPrisma.user.findMany.mockResolvedValue(rows);
      mockPrisma.user.count.mockResolvedValue(21);

      const result = await service.listMyReferrals('u1', { page: 2, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(rows);
      expect(result.total).toBe(21);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { referredById: 'u1' },
          skip: 20,
          take: 20,
        }),
      );
      expect(mockPrisma.user.count).toHaveBeenCalledWith({ where: { referredById: 'u1' } });
    });
  });

  describe('getMyReferralStats', () => {
    it('returns the caller referral count', async () => {
      mockPrisma.user.count.mockResolvedValue(3);
      const result = await service.getMyReferralStats('u1');
      expect(result).toEqual({ success: true, totalReferrals: 3 });
    });
  });

  describe('getMyEarnings', () => {
    it('returns the commission breakdown for a non-admin user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'BUSINESS' });
      mockCommission.getEarningsForUser.mockResolvedValue({
        summary: { totalEarnedCredits: 25 },
        referredUsers: [],
        history: [],
      });

      const result = await service.getMyEarnings('u1', 10);

      expect(result.success).toBe(true);
      expect(result.data.summary.totalEarnedCredits).toBe(25);
      expect(mockCommission.getEarningsForUser).toHaveBeenCalledWith('u1', 10);
    });

    it('rejects admin accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin1', role: 'ADMIN' });
      await expect(service.getMyEarnings('admin1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getAdminReferrerDetail', () => {
    it('returns the referrer plus per-referred-user earnings', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@example.com',
        firstName: 'A',
        lastName: null,
        role: 'BUSINESS',
        referralCode: 'ABC12345',
        createdAt: new Date(),
      });
      mockCommission.getReferrerAdminSummary.mockResolvedValue({
        summary: { totalEarnedCredits: 12 },
        referredUsers: [{ id: 'u2', earnedCredits: 12 }],
        history: [],
      });

      const result = await service.getAdminReferrerDetail('u1');
      expect(result.data.referrer.id).toBe('u1');
      expect(result.data.referredUsers[0].earnedCredits).toBe(12);
    });

    it('throws when the referrer does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getAdminReferrerDetail('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
