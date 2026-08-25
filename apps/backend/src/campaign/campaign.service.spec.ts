import { Test, TestingModule } from '@nestjs/testing';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CampaignService', () => {
  let service: CampaignService;

  const mockPrisma = {
    campaign: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    highStreet: {
      findUnique: jest.fn(),
    },
    borough: {
      findUnique: jest.fn(),
    },
    localMall: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCampaigns', () => {
    it('returns a paginated success envelope', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([{ id: 'c1', name: 'Summer' }]);
      mockPrisma.campaign.count.mockResolvedValue(1);
      const result = await service.getCampaigns({});
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 'c1', name: 'Summer' }]);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(mockPrisma.campaign.count).toHaveBeenCalledWith({ where: {} });
    });

    it('filters by locationType and locationId with pagination', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);
      await service.getCampaigns({ locationType: 'high_street', locationId: 'hs_1', page: 2, limit: 10 });
      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
        where: { locationType: 'high_street', locationId: 'hs_1' },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('getCampaign', () => {
    it('returns the campaign when found', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'c1', name: 'Summer' });
      const result = await service.getCampaign('c1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'c1', name: 'Summer' });
    });

    it('throws NotFound when missing', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);
      await expect(service.getCampaign('c1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCampaign', () => {
    it('creates a campaign with a success envelope', async () => {
      const dto = { name: 'Summer Push', locationType: 'high_street' as const, locationId: 'hs_1', locationName: 'Rye Lane' };
      mockPrisma.highStreet.findUnique.mockResolvedValue({ id: 'hs_1' });
      mockPrisma.campaign.create.mockResolvedValue({ id: 'c1', ...dto });
      const result = await service.createCampaign(dto);
      expect(result.success).toBe(true);
      expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
        data: {
          name: 'Summer Push',
          description: undefined,
          locationType: 'high_street',
          locationId: 'hs_1',
          locationName: 'Rye Lane',
          status: 'draft',
          startDate: null,
          endDate: null,
        },
      });
    });

    it('validates that the location exists', async () => {
      mockPrisma.highStreet.findUnique.mockResolvedValue(null);
      await expect(
        service.createCampaign({ name: 'X', locationType: 'high_street', locationId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows a campaign with no location', async () => {
      const dto = { name: 'Site-wide', locationType: 'borough' as const };
      mockPrisma.campaign.create.mockResolvedValue({ id: 'c1', ...dto });
      const result = await service.createCampaign(dto);
      expect(result.success).toBe(true);
      expect(mockPrisma.borough.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('performAction', () => {
    it('pauses an active campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'c1', name: 'Summer', status: 'active' });
      mockPrisma.campaign.update.mockResolvedValue({ id: 'c1', status: 'paused' });
      const result = await service.performAction('c1', { action: 'pause' });
      expect(result.success).toBe(true);
      expect(mockPrisma.campaign.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'paused' } });
    });

    it('rejects pausing a non-active campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'c1', name: 'Summer', status: 'draft' });
      await expect(service.performAction('c1', { action: 'pause' })).rejects.toThrow(BadRequestException);
    });

    it('rejects resuming a non-paused campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'c1', name: 'Summer', status: 'active' });
      await expect(service.performAction('c1', { action: 'resume' })).rejects.toThrow(BadRequestException);
    });

    it('completes any campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue({ id: 'c1', name: 'Summer', status: 'active' });
      mockPrisma.campaign.update.mockResolvedValue({ id: 'c1', status: 'completed' });
      const result = await service.performAction('c1', { action: 'complete' });
      expect(result.data.status).toBe('completed');
    });
  });
});