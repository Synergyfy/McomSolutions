import { NotFoundException } from '@nestjs/common';
import { EcosystemService } from './ecosystem.service';
import { ECOSYSTEM_SERVICES_CACHE_KEY } from './constants';

describe('EcosystemService', () => {
  let service: EcosystemService;
  let prisma: any;
  let redis: any;
  let keys: any;

  const row = {
    clientId: 'mcom-rewards',
    name: 'MCOM Rewards',
    platformSlug: 'rewards',
    serviceBaseUrl: null,
    billingApiUrl: 'https://api.rewards.test',
    serviceScopes: ['rewards:read'],
    allowedCallers: ['mcom-mall'],
    appUrl: 'https://rewards.test',
    isSystemApp: false,
  };

  beforeEach(() => {
    prisma = { ssoClient: { findMany: jest.fn(), findFirst: jest.fn() } };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    keys = { getIssuer: () => 'mcom-solutions', getKid: () => 'kid-1' };
    service = new EcosystemService(prisma, redis, keys);
  });

  it('lists services including the ingress allowedCallers policy', async () => {
    prisma.ssoClient.findMany.mockResolvedValue([row]);

    const result = await service.listServices();

    expect(result).toHaveLength(1);
    expect(result[0].clientId).toBe('mcom-rewards');
    expect(result[0].allowedCallers).toEqual(['mcom-mall']);
    expect(result[0].baseUrl).toBe('https://api.rewards.test'); // falls back to billingApiUrl
    expect(redis.set).toHaveBeenCalledWith(
      ECOSYSTEM_SERVICES_CACHE_KEY,
      expect.any(Array),
      60,
    );
  });

  it('serves from cache without hitting the database', async () => {
    redis.get.mockResolvedValue([{ clientId: 'cached' }]);
    const result = await service.listServices();
    expect(result[0].clientId).toBe('cached');
    expect(prisma.ssoClient.findMany).not.toHaveBeenCalled();
  });

  it('prefers serviceBaseUrl over billingApiUrl', async () => {
    prisma.ssoClient.findMany.mockResolvedValue([
      { ...row, serviceBaseUrl: 'https://svc.rewards.test' },
    ]);
    const result = await service.listServices();
    expect(result[0].baseUrl).toBe('https://svc.rewards.test');
  });

  it('throws NotFound for an unknown service', async () => {
    prisma.ssoClient.findFirst.mockResolvedValue(null);
    await expect(service.getService('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exposes a discovery document', () => {
    expect(service.discovery()).toMatchObject({
      issuer: 'mcom-solutions',
      jwks_uri: '/.well-known/jwks.json',
      signing_alg: 'RS256',
      key_id: 'kid-1',
    });
  });
});
