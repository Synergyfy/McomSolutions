import { BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPassCatalogService } from './access-pass-catalog.service';

describe('AccessPassCatalogService', () => {
  let service: AccessPassCatalogService;
  let prisma: {
    ssoClient: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      ssoClient: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    service = new AccessPassCatalogService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listPlatforms', () => {
    it('only returns active apps with an access pass plans endpoint configured', async () => {
      prisma.ssoClient.findMany.mockResolvedValue([
        {
          name: 'MCOM Rewards',
          clientId: 'mcom-rewards',
          platformSlug: 'rewards',
          metadata: { accessPassPlansEndpoint: 'https://rewards.test/api/v1/access-passes/plans' },
        },
        {
          name: 'MCOM Mall',
          clientId: 'mcom-mall',
          platformSlug: 'mall',
          metadata: { planSchemaEndpoint: 'https://mall.test/api/v1/system/plans/schema' },
        },
      ]);

      const result = await service.listPlatforms();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        {
          name: 'MCOM Rewards',
          clientId: 'mcom-rewards',
          platformSlug: 'rewards',
          endpoint: 'https://rewards.test/api/v1/access-passes/plans',
        },
      ]);
    });
  });

  describe('getPlans', () => {
    it('fetches and normalizes the platform access pass catalogue', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({
        name: 'MCOM Rewards',
        clientId: 'mcom-rewards',
        platformSlug: 'rewards',
        apiKey: 'ak_test',
        metadata: { accessPassPlansEndpoint: 'https://rewards.test/api/v1/access-passes/plans' },
      });
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          data: [
            {
              id: 'plan_1',
              name: '7-Day Rewards Pass',
              slug: '7-day-rewards',
              price: '12.50',
              currency: 'GBP',
              durationDays: 7,
              features: ['Campaigns'],
              configuration: { quotas: { maxActiveCampaigns: 3 }, featureFlags: { hasAccessToCRM: true } },
              isActive: true,
            },
          ],
        },
      } as never);

      const result = await service.getPlans('MCOM Rewards');

      expect(getSpy).toHaveBeenCalledWith(
        'https://rewards.test/api/v1/access-passes/plans',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-mcom-solution-api-key': 'ak_test' }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.platform).toEqual({
        name: 'MCOM Rewards',
        clientId: 'mcom-rewards',
        platformSlug: 'rewards',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'plan_1',
        name: '7-Day Rewards Pass',
        price: 12.5,
        durationDays: 7,
        features: ['Campaigns'],
        isActive: true,
      });
    });

    it('rejects platforms without an access pass plans endpoint', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({
        name: 'MCOM Mall',
        clientId: 'mcom-mall',
        platformSlug: 'mall',
        apiKey: 'ak_test',
        metadata: {},
      });

      await expect(service.getPlans('MCOM Mall')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown platforms', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue(null);

      await expect(service.getPlans('Unknown')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requires a platform name', async () => {
      await expect(service.getPlans('  ')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
