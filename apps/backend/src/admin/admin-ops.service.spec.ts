import { Test, TestingModule } from '@nestjs/testing';
import { AdminOpsService } from './admin-ops.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceConnectorsService } from '../service-connectors/service-connectors.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('AdminOpsService', () => {
  let service: AdminOpsService;

  const mockConnectorsService = {
    getPlans: jest.fn().mockResolvedValue([]),
    getPlanSchema: jest.fn().mockResolvedValue(null),
    getSeasons: jest.fn().mockResolvedValue([]),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    deletePlan: jest.fn(),
    getPlanById: jest.fn(),
  };

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    $transaction: jest.fn((queries) => Promise.all(queries)),
    systemApiKey: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    systemIntegration: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    assessmentQuestion: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { order: null } }),
    },
    activityFeed: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    boroughMetric: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    borough: {
      findUnique: jest.fn(),
    },
    highStreet: {
      findUnique: jest.fn(),
    },
    backgroundJob: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    errorLog: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    externalPlan: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: {
      count: jest.fn().mockResolvedValue(0),
    },
    ssoClient: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOpsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ServiceConnectorsService,
          useValue: mockConnectorsService,
        },
      ],
    }).compile();

    service = module.get<AdminOpsService>(AdminOpsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getApiKeys', () => {
    it('returns masked API keys (never full values)', async () => {
      mockPrisma.systemApiKey.findMany.mockResolvedValue([
        { id: 'k1', name: 'Prod Key', key: 'sk_abcdefghijklmnopqrstuvwxyz1234', permissions: [], status: 'Active', lastUsed: null, createdAt: new Date(), updatedAt: new Date() },
      ]);
      const result = await service.getApiKeys();
      expect(result.success).toBe(true);
      const key = result.data[0];
      expect(key.key).not.toContain('abcdefghijklmnopqrstuvwxyz');
      expect(key.key).toContain('****');
    });
  });

  describe('createApiKey', () => {
    it('returns the full raw key once at creation', async () => {
      mockPrisma.systemApiKey.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'k1', ...data }),
      );
      const result = await service.createApiKey({ name: 'Key', permissions: ['read'] });
      expect(result.data.key.startsWith('sk_')).toBe(true);
    });
  });

  describe('getSystemHealth', () => {
    it('returns healthy when DB query succeeds', async () => {
      const result = await service.getSystemHealth();
      expect(result.data.status).toBe('healthy');
      expect(result.data.services.database).toBe('ok');
    });
  });

  describe('getBoroughStats', () => {
    it('throws NotFoundException when borough does not exist', async () => {
      mockPrisma.borough.findUnique.mockResolvedValue(null);
      await expect(service.getBoroughStats('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAssessmentQuestions', () => {
    it('returns questions ordered by order asc', async () => {
      await service.getAssessmentQuestions();
      expect(mockPrisma.assessmentQuestion.findMany).toHaveBeenCalledWith({
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('External Plans', () => {
    it('getSupportedPlatforms returns named platforms and dynamic DB clients', async () => {
      mockPrisma.ssoClient.findMany.mockResolvedValue([
        {
          name: 'Mcom vCard',
          clientId: 'mcom-vcard',
          platformSlug: 'vcard',
          billingApiUrl: 'https://api.vcard.mcom.com',
          metadata: { planSchemaEndpoint: 'https://api.vcard.mcom.com/api/v1/system/plans/schema' },
        },
      ]);
      const result = await service.getSupportedPlatforms();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { name: 'MCOM Mall', clientId: 'mcom-mall', platformSlug: 'mall', isNamed: true, hasBillingApi: true },
        { name: 'MCOM Rewards', clientId: 'mcom-loyalty', platformSlug: 'rewards', isNamed: true, hasBillingApi: true },
        {
          name: 'Mcom vCard',
          clientId: 'mcom-vcard',
          platformSlug: 'vcard',
          isNamed: false,
          hasBillingApi: true,
          billingApiUrl: 'https://api.vcard.mcom.com',
          planSchemaEndpoint: 'https://api.vcard.mcom.com/api/v1/system/plans/schema',
        },
      ]);
    });

    it('getExternalPlanSchema delegates to the connectors service', async () => {
      const schema = {
        quotas: [{ key: 'maxVCards', label: 'Max VCards', type: 'number', unlimited: true }],
        featureFlags: [{ key: 'allowNfc', label: 'Allow NFC', type: 'boolean' }],
      };
      mockConnectorsService.getPlanSchema.mockResolvedValue(schema);
      const result = await service.getExternalPlanSchema('Mcom vCard');
      expect(mockConnectorsService.getPlanSchema).toHaveBeenCalledWith('Mcom vCard');
      expect(result).toEqual({ success: true, data: schema });
    });

    it('getExternalPlatformSeasons delegates to the connectors service', async () => {
      const seasons = [{ id: 's-1', name: 'Summer 2026', isActive: true }];
      mockConnectorsService.getSeasons.mockResolvedValue(seasons);
      const result = await service.getExternalPlatformSeasons('Mcom vCard');
      expect(mockConnectorsService.getSeasons).toHaveBeenCalledWith('Mcom vCard');
      expect(result).toEqual({ success: true, data: seasons });
    });

    it('getExternalPlans live-fetches from the platform connector when platform is provided', async () => {
      mockConnectorsService.getPlans.mockResolvedValue([
        { id: 'p1', name: 'Mall Basic', monthlyPrice: 9.99 },
      ]);
      const result = await service.getExternalPlans('MCOM Mall');
      expect(mockConnectorsService.getPlans).toHaveBeenCalledWith('MCOM Mall');
      expect(result.data).toEqual([{ id: 'p1', name: 'Mall Basic', monthlyPrice: 9.99 }]);
    });

    it('createExternalPlan returns the plan from the target platform connector', async () => {
      const decimal = new Prisma.Decimal('9.99');
      mockConnectorsService.createPlan.mockResolvedValue({
        id: 'p1',
        name: 'MCOM Mall Basic',
        monthlyPrice: decimal,
        quarterlyPrice: null,
        annualPrice: null,
        features: [],
        configuration: null,
        isActive: true,
        isDefault: false,
      });
      const result = await service.createExternalPlan({
        name: 'MCOM Mall Basic',
        platform: 'MCOM Mall',
        monthlyPrice: 9.99,
      } as any);
      expect(mockConnectorsService.createPlan).toHaveBeenCalledWith(
        'MCOM Mall',
        expect.objectContaining({ name: 'MCOM Mall Basic', monthlyPrice: 9.99 }),
      );
      expect(result.data.monthlyPrice).toBe(decimal);
    });

    it('getExternalPlan throws NotFoundException when missing', async () => {
      mockPrisma.externalPlan.findUnique.mockResolvedValue(null);
      await expect(service.getExternalPlan('nope')).rejects.toThrow(NotFoundException);
    });

    it('deleteExternalPlan deletes an existing plan', async () => {
      mockPrisma.externalPlan.findUnique.mockResolvedValue({ id: 'p1', name: 'Plan' });
      const result = await service.deleteExternalPlan('p1', 'MCOM Mall');
      expect(result.success).toBe(true);
      expect(mockConnectorsService.deletePlan).toHaveBeenCalledWith('MCOM Mall', 'p1');
      expect(mockPrisma.externalPlan.deleteMany).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('getActivities', () => {
    it('filters by highStreetId when provided', async () => {
      mockPrisma.activityFeed.count.mockResolvedValue(1);
      mockPrisma.activityFeed.findMany.mockResolvedValue([{ id: 'a1' }]);
      const result = await service.getActivities({ highStreetId: 'hs-1', page: 1, limit: 10 });
      expect(mockPrisma.activityFeed.findMany).toHaveBeenCalledWith({
        where: { highStreetId: 'hs-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('updateApiKey', () => {
    it('throws NotFoundException when the key does not exist', async () => {
      mockPrisma.systemApiKey.findUnique.mockResolvedValue(null);
      await expect(service.updateApiKey('nope', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('masks the key in the response', async () => {
      mockPrisma.systemApiKey.findUnique.mockResolvedValue({ id: 'k1' });
      mockPrisma.systemApiKey.update.mockResolvedValue({
        id: 'k1',
        key: 'sk_abcdefghijklmnopqrstuvwxyz1234',
      });
      const result = await service.updateApiKey('k1', { name: 'Renamed' });
      expect(result.data.key).toContain('****');
      expect(result.data.key).not.toContain('abcdefghijklmnopqrstuvwxyz');
    });
  });

  describe('deleteApiKey', () => {
    it('throws NotFoundException when the key does not exist', async () => {
      mockPrisma.systemApiKey.findUnique.mockResolvedValue(null);
      await expect(service.deleteApiKey('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createIntegration / updateIntegration / deleteIntegration', () => {
    it('creates an integration with defaults', async () => {
      mockPrisma.systemIntegration.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'i1', ...data }),
      );
      const result = await service.createIntegration({ name: 'Stripe', type: 'payment' });
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('Disconnected');
    });

    it('throws NotFoundException when updating a missing integration', async () => {
      mockPrisma.systemIntegration.findUnique.mockResolvedValue(null);
      await expect(service.updateIntegration('nope', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when deleting a missing integration', async () => {
      mockPrisma.systemIntegration.findUnique.mockResolvedValue(null);
      await expect(service.deleteIntegration('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAssessmentQuestion', () => {
    it('auto-assigns the next order when not provided', async () => {
      mockPrisma.assessmentQuestion.aggregate.mockResolvedValue({ _max: { order: 3 } });
      mockPrisma.assessmentQuestion.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'q1', ...data }),
      );
      const result = await service.createAssessmentQuestion({
        question: 'Sector?',
        iconName: 'Briefcase',
        fieldType: 'single-choice',
      });
      expect(result.data.order).toBe(4);
    });
  });

  describe('reorderAssessmentQuestions', () => {
    it('updates order for each id in the transaction', async () => {
      await service.reorderAssessmentQuestions({ orderedIds: ['a', 'b', 'c'] });
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('createActivity', () => {
    it('throws NotFoundException when the high street does not exist', async () => {
      mockPrisma.highStreet.findUnique.mockResolvedValue(null);
      await expect(
        service.createActivity({ type: 'x', title: 'y', highStreetId: 'hs-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBoroughMetric', () => {
    it('throws NotFoundException when the borough does not exist', async () => {
      mockPrisma.borough.findUnique.mockResolvedValue(null);
      await expect(
        service.createBoroughMetric('nope', { month: '2026-07' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on duplicate borough/month', async () => {
      mockPrisma.borough.findUnique.mockResolvedValue({ id: 'b1' });
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
      mockPrisma.boroughMetric.create.mockRejectedValue(err);
      await expect(
        service.createBoroughMetric('b1', { month: '2026-07' }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('updateBoroughMetric / deleteBoroughMetric', () => {
    it('throws NotFoundException when updating a missing metric', async () => {
      mockPrisma.boroughMetric.findUnique.mockResolvedValue(null);
      await expect(service.updateBoroughMetric('nope', { footfall: 1 })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when deleting a missing metric', async () => {
      mockPrisma.boroughMetric.findUnique.mockResolvedValue(null);
      await expect(service.deleteBoroughMetric('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBoroughStats', () => {
    it('returns computed stats, trends, and chart data', async () => {
      mockPrisma.borough.findUnique.mockResolvedValue({
        id: 'b1',
        name: 'Lewisham',
        area: 'SE London',
        region: 'London',
        activity: 'High',
        engagement: 'High',
        health: 'Good',
      });
      mockPrisma.boroughMetric.findMany.mockResolvedValue([
        { month: '2026-06', footfall: 8000, revenue: 100000, activeCustomers: 100, businesses: 50 },
        { month: '2026-07', footfall: 10000, revenue: 120000, activeCustomers: 125, businesses: 60 },
      ]);
      mockPrisma.user.count
        .mockResolvedValueOnce(60) // businesses
        .mockResolvedValueOnce(125); // customers

      const result = await service.getBoroughStats('b1');
      expect(result.success).toBe(true);
      expect(result.data.stats.totalBusinesses).toBe(60);
      expect(result.data.stats.activeCustomers).toBe(125);
      expect(result.data.trends.footfallTrend).toBe(25); // (10000-8000)/8000
      expect(result.data.trends.revenueTrend).toBe(20); // (120000-100000)/100000
      expect(result.data.trends.customerGrowth).toBe(25); // (125-100)/100
      expect(result.data.trends.businessGrowth).toBe(20); // (60-50)/50
      expect(result.data.chart.footfall).toEqual([8000, 10000]);
    });
  });

  describe('createBackgroundJob / updateBackgroundJob / deleteBackgroundJob', () => {
    it('creates a background job with defaults', async () => {
      mockPrisma.backgroundJob.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'j1', ...data }),
      );
      const result = await service.createBackgroundJob({ name: 'Expire subs' });
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('pending');
    });

    it('throws NotFoundException when updating a missing job', async () => {
      mockPrisma.backgroundJob.findUnique.mockResolvedValue(null);
      await expect(service.updateBackgroundJob('nope', { status: 'running' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when deleting a missing job', async () => {
      mockPrisma.backgroundJob.findUnique.mockResolvedValue(null);
      await expect(service.deleteBackgroundJob('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createErrorLog / getErrorLogs', () => {
    it('creates an error log', async () => {
      mockPrisma.errorLog.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'e1', ...data }),
      );
      const result = await service.createErrorLog({ message: 'boom' });
      expect(result.success).toBe(true);
      expect(result.data.level).toBe('error');
    });

    it('lists error logs', async () => {
      const result = await service.getErrorLogs();
      expect(result.success).toBe(true);
      expect(mockPrisma.errorLog.findMany).toHaveBeenCalled();
    });
  });
});
