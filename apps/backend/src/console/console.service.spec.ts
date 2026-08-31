import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConsoleService } from './console.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SsoService } from '../auth/sso.service';
import { decrypt } from './crypto.util';

const ENCRYPTION_KEY = '86d3b8c8ad1519806cd90234050daebe4d2dc95f1ea9d83d780cc73ebed00a3b';

describe('ConsoleService', () => {
  let service: ConsoleService;
  let prisma: any;
  let redis: any;
  let ssoService: any;

  const mockRedis = {
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    delPattern: jest.fn(),
  };

  const mockSsoService = {
    invalidateCorsCache: jest.fn().mockResolvedValue(undefined),
    invalidateMemCache: jest.fn().mockResolvedValue(undefined),
    getClientByClientId: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const map: Record<string, any> = {
        CONSOLE_ENCRYPTION_KEY: ENCRYPTION_KEY,
        NODE_ENV: 'test',
      };
      return map[key];
    }),
  };

  const mockPrisma = {
    ssoClient: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ssoSession: {
      deleteMany: jest.fn(),
    },
    consoleAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsoleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SsoService, useValue: mockSsoService },
      ],
    }).compile();

    service = module.get<ConsoleService>(ConsoleService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    ssoService = module.get(SsoService);
    jest.clearAllMocks();
  });

  const baseDto = {
    name: 'Mcom vCard',
    clientId: 'mcom-vcard',
    platformSlug: 'vcard',
    description: 'Digital business cards',
    appUrl: 'https://vcard.mcom.com',
    billingApiUrl: 'https://api.vcard.mcom.com',
    redirectUris: ['https://vcard.mcom.com/auth/callback'],
    corsOrigins: ['https://vcard.mcom.com'],
    scopes: ['profile', 'email', 'business'],
    webhookUrl: 'https://api.vcard.mcom.com/webhooks',
  };

  function clientRecord(overrides: Record<string, any> = {}) {
    return {
      id: 'cl_1',
      clientId: 'mcom-vcard',
      name: 'Mcom vCard',
      platformSlug: 'vcard',
      redirectUris: baseDto.redirectUris,
      corsOrigins: baseDto.corsOrigins,
      scopes: baseDto.scopes,
      webhookUrl: baseDto.webhookUrl,
      logoUrl: null,
      apiKey: 'ak_old',
      isActive: true,
      isSystemApp: false,
      webhookFailCount: 0,
      lastWebhookAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe('registerApp', () => {
    it('should create the app, hash the client secret, encrypt hmac/webhook secrets, and audit', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(null);
      mockPrisma.ssoClient.findFirst.mockResolvedValue(null);
      mockPrisma.ssoClient.create.mockImplementation(async (args: any) => ({ id: 'cl_1', ...args.data }));

      const result = await service.registerApp(baseDto as any, 'admin-1');

      expect(prisma.ssoClient.create).toHaveBeenCalled();
      const createdData = prisma.ssoClient.create.mock.calls[0][0].data;

      // clientSecret stored as a bcrypt hash matching the returned plain secret
      expect(createdData.clientSecret).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare(result.plainSecrets.clientSecret, createdData.clientSecret)).resolves.toBe(true);

      // hmac + webhook secrets encrypted at rest
      expect(decrypt(createdData.hmacSecret, ENCRYPTION_KEY)).toBe(result.plainSecrets.hmacSecret);
      expect(decrypt(createdData.webhookSecret, ENCRYPTION_KEY)).toBe(result.plainSecrets.webhookSecret);

      // apiKey stored plain
      expect(createdData.apiKey).toBe(result.plainSecrets.apiKey);

      // plain secrets returned once
      expect(result.plainSecrets.clientSecret).toMatch(/^cs_/);
      expect(result.plainSecrets.apiKey).toMatch(/^ak_/);
      expect(result.plainSecrets.hmacSecret).toMatch(/^hm_/);
      expect(result.plainSecrets.webhookSecret).toMatch(/^wh_/);

      // cache + cors invalidated, audit logged
      expect(redis.del).toHaveBeenCalledWith('sso_client:mcom-vcard');
      expect(ssoService.invalidateCorsCache).toHaveBeenCalled();
      expect(prisma.consoleAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'register_app', adminId: 'admin-1' }) }),
      );
    });

    it('should throw ConflictException when clientId already exists', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue({ clientId: 'mcom-vcard' });
      await expect(service.registerApp(baseDto as any, 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when platformSlug already used', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(null);
      mockPrisma.ssoClient.findFirst.mockResolvedValue({ clientId: 'other-app' });
      await expect(service.registerApp(baseDto as any, 'admin-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getApp / listApps', () => {
    it('should return masked secrets in detail', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(
        clientRecord({ apiKey: 'ak_1234567890abcdef', hmacSecret: 'encrypted', webhookSecret: 'encrypted' }),
      );
      const app = await service.getApp('mcom-vcard');
      expect(app.clientSecret).toContain('•');
      expect(app.apiKey).toContain('ak_****');
      expect(app.hmacSecret).toContain('•');
      expect(app.webhookSecret).toContain('•');
    });

    it('should throw NotFoundException for missing app', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(null);
      await expect(service.getApp('nope')).rejects.toThrow(NotFoundException);
    });

    it('should list apps without exposing secrets', async () => {
      mockPrisma.ssoClient.findMany.mockResolvedValue([clientRecord()]);
      const apps = await service.listApps();
      expect(apps[0]).not.toHaveProperty('clientSecret');
      expect(apps[0]).not.toHaveProperty('hmacSecret');
      expect(apps[0].clientId).toBe('mcom-vcard');
    });
  });

  describe('deactivateApp', () => {
    it('should block system apps', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(clientRecord({ clientId: 'mcom-mall', isSystemApp: true }));
      await expect(service.deactivateApp('mcom-mall', 'admin-1')).rejects.toThrow(ForbiddenException);
    });

    it('should soft-deactivate non-system app and cascade sessions', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(clientRecord());
      mockPrisma.ssoClient.update.mockResolvedValue({});
      mockPrisma.ssoSession.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.deactivateApp('mcom-vcard', 'admin-1');
      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('sso_client:mcom-vcard');
      expect(ssoService.invalidateCorsCache).toHaveBeenCalled();
      expect(prisma.consoleAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'deactivate_app' }) }),
      );
    });
  });

  describe('rotateClientSecret', () => {
    it('should store a new bcrypt hash, purge cache, and audit', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(clientRecord());
      mockPrisma.ssoClient.update.mockImplementation(async (args: any) => ({ ...clientRecord(), ...args.data }));

      const result = await service.rotateClientSecret('mcom-vcard', 'admin-1');
      expect(result.clientSecret).toMatch(/^cs_/);
      const data = prisma.ssoClient.update.mock.calls[0][0].data;
      await expect(bcrypt.compare(result.clientSecret, data.clientSecret)).resolves.toBe(true);
      expect(redis.del).toHaveBeenCalledWith('sso_client:mcom-vcard');
      expect(prisma.consoleAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'rotate_client_secret' }) }),
      );
    });
  });

  describe('rotateApiKey', () => {
    it('should store a new plain api key and audit', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(clientRecord());
      mockPrisma.ssoClient.update.mockImplementation(async (args: any) => ({ ...clientRecord(), ...args.data }));

      const result = await service.rotateApiKey('mcom-vcard', 'admin-1');
      expect(result.apiKey).toMatch(/^ak_/);
      const data = prisma.ssoClient.update.mock.calls[0][0].data;
      expect(data.apiKey).toBe(result.apiKey);
      expect(prisma.consoleAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'rotate_api_key' }) }),
      );
    });
  });

  describe('rotateHmacSecret', () => {
    it('should store an encrypted hmac secret and audit', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(clientRecord());
      mockPrisma.ssoClient.update.mockImplementation(async (args: any) => ({ ...clientRecord(), ...args.data }));

      const result = await service.rotateHmacSecret('mcom-vcard', 'admin-1');
      expect(result.hmacSecret).toMatch(/^hm_/);
      const data = prisma.ssoClient.update.mock.calls[0][0].data;
      expect(decrypt(data.hmacSecret, ENCRYPTION_KEY)).toBe(result.hmacSecret);
      expect(prisma.consoleAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'rotate_hmac_secret' }) }),
      );
    });
  });

  describe('updateApp', () => {
    it('should update allowed fields and invalidate caches', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(clientRecord());
      mockPrisma.ssoClient.update.mockImplementation(async (args: any) => ({ ...clientRecord(), ...args.data }));

      await service.updateApp('mcom-vcard', { name: 'Mcom vCard Pro', corsOrigins: ['https://vcard.mcom.com', 'https://app.vcard.mcom.com'] } as any, 'admin-1');

      const data = prisma.ssoClient.update.mock.calls[0][0].data;
      expect(data.name).toBe('Mcom vCard Pro');
      expect(redis.del).toHaveBeenCalledWith('sso_client:mcom-vcard');
      expect(ssoService.invalidateCorsCache).toHaveBeenCalled();
      expect(prisma.consoleAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'update_app' }) }),
      );
    });
  });

  describe('listAuditLogs', () => {
    it('should paginate audit logs', async () => {
      mockPrisma.consoleAuditLog.findMany.mockResolvedValue([{ id: 'log1' }]);
      mockPrisma.consoleAuditLog.count.mockResolvedValue(21);
      const result = await service.listAuditLogs({ page: 1, limit: 20 });
      expect(result.total).toBe(21);
      expect(result.totalPages).toBe(2);
      expect(result.data).toHaveLength(1);
    });
  });
});