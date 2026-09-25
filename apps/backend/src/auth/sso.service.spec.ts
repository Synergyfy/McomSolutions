import { Test, TestingModule } from '@nestjs/testing';
import { SsoService } from './sso.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('SsoService', () => {
  let service: SsoService;
  let prisma: any;
  let jwtService: any;
  let configService: any;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setex: jest.fn(),
    delPattern: jest.fn(),
  };

  const mockPrisma = {
    ssoClient: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    ssoAuthCode: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ssoSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    membershipPlan: {
      findFirst: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn().mockReturnValue({ sub: 'user-1', scopes: ['profile'] }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        SSO_JWT_SECRET: 'test-sso-secret',
        SSO_CODE_TTL_SECONDS: '300',
        SSO_ACCESS_TOKEN_TTL: '3600',
        SSO_REFRESH_TOKEN_TTL: '604800',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SsoService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<SsoService>(SsoService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  // ─── generateToken ────────────────────────────────
  describe('generateToken', () => {
    it('should sign a payload and return a JWT', () => {
      const result = service.generateToken({ sub: 'user-1', role: 'BUSINESS' });
      expect(result).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-1', role: 'BUSINESS' },
        expect.objectContaining({ expiresIn: '5m', algorithm: 'HS256' }),
      );
    });
  });

  // ─── generateAuthCode ─────────────────────────────
  describe('generateAuthCode', () => {
    it('should throw BadRequestException if client not found', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(null);
      await expect(
        service.generateAuthCode('user-1', 'unknown-client', 'https://example.com/callback', ['profile']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if redirect URI not allowed', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue({
        id: 1,
        clientId: 'test-client',
        redirectUris: ['https://allowed.com/callback'],
      });
      await expect(
        service.generateAuthCode('user-1', 'test-client', 'https://evil.com/callback', ['profile']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create auth code and return it', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue({
        id: 1,
        clientId: 'test-client',
        redirectUris: ['https://example.com/callback'],
      });
      mockPrisma.ssoAuthCode.create.mockResolvedValue({ code: 'generated-code-hex' });

      const code = await service.generateAuthCode(
        'user-1',
        'test-client',
        'https://example.com/callback',
        ['profile', 'email'],
      );

      expect(code).toBeDefined();
      expect(mockPrisma.ssoAuthCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            clientId: 1,
            redirectUri: 'https://example.com/callback',
            scopes: ['profile', 'email'],
          }),
        }),
      );
    });
  });

  // ─── exchangeCodeForTokens ────────────────────────
  describe('exchangeCodeForTokens', () => {
    const validAuthCode = {
      code: 'valid-code',
      used: false,
      expiresAt: new Date(Date.now() + 3600000),
      client: { id: 1, clientId: 'test-client' },
      redirectUri: 'https://example.com/callback',
      userId: 'user-1',
    };

    it('should throw UnauthorizedException if auth code not found', async () => {
      mockPrisma.ssoAuthCode.findUnique.mockResolvedValue(null);
      await expect(
        service.exchangeCodeForTokens('bad-code', 'test-client', 'https://example.com/callback'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if code already used', async () => {
      mockPrisma.ssoAuthCode.findUnique.mockResolvedValue({
        ...validAuthCode,
        used: true,
      });
      await expect(
        service.exchangeCodeForTokens('used-code', 'test-client', 'https://example.com/callback'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if code expired', async () => {
      mockPrisma.ssoAuthCode.findUnique.mockResolvedValue({
        ...validAuthCode,
        expiresAt: new Date(Date.now() - 3600000),
      });
      await expect(
        service.exchangeCodeForTokens('expired-code', 'test-client', 'https://example.com/callback'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on client mismatch', async () => {
      mockPrisma.ssoAuthCode.findUnique.mockResolvedValue(validAuthCode);
      await expect(
        service.exchangeCodeForTokens('valid-code', 'wrong-client', 'https://example.com/callback'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should exchange code and return tokens on success', async () => {
      mockPrisma.ssoAuthCode.findUnique.mockResolvedValue(validAuthCode);
      mockPrisma.ssoAuthCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'BUSINESS',
        firstName: 'John',
        lastName: 'Doe',
        businessProfile: {
          id: 'b1',
          businessName: 'Test Biz',
          membershipLevel: 'Bronze',
          membershipStatus: 'active',
        },
      });
      mockPrisma.ssoSession.create.mockResolvedValue({ id: 'session-1' });

      const result = await service.exchangeCodeForTokens(
        'valid-code',
        'test-client',
        'https://example.com/callback',
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
      expect(result.user.email).toBe('test@test.com');
      expect(result.user.businessProfile).toBeDefined();
    });
  });

  // ─── refreshSsoToken ──────────────────────────────
  describe('refreshSsoToken', () => {
    it('should throw UnauthorizedException if session not found', async () => {
      mockPrisma.ssoSession.findUnique.mockResolvedValue(null);
      await expect(service.refreshSsoToken('invalid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if session expired', async () => {
      mockPrisma.ssoSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'expired-token',
        expiresAt: new Date(Date.now() - 3600000),
        userId: 'user-1',
      });
      mockPrisma.ssoSession.delete.mockResolvedValue({});
      await expect(service.refreshSsoToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.ssoSession.delete).toHaveBeenCalled();
    });

    it('should refresh token successfully', async () => {
      mockPrisma.ssoSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        userId: 'user-1',
      });
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', scopes: ['profile'] });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'BUSINESS',
        firstName: 'John',
        lastName: 'Doe',
        businessProfile: { id: 'b1', businessName: 'Test Biz' },
      });
      mockPrisma.ssoSession.update.mockResolvedValue({});

      const result = await service.refreshSsoToken('valid-refresh-token');
      expect(result.accessToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
    });
  });

  // ─── logout ───────────────────────────────────────
  describe('logout', () => {
    it('should delete session if found', async () => {
      mockPrisma.ssoSession.findUnique.mockResolvedValue({ id: 'session-1' });
      mockPrisma.ssoSession.delete.mockResolvedValue({});
      const result = await service.logout('valid-access-token');
      expect(result.success).toBe(true);
      expect(mockPrisma.ssoSession.delete).toHaveBeenCalled();
    });

    it('should return success even if session not found', async () => {
      mockPrisma.ssoSession.findUnique.mockResolvedValue(null);
      const result = await service.logout('no-session-token');
      expect(result.success).toBe(true);
    });
  });

  // ─── registerClient ───────────────────────────────
  describe('registerClient', () => {
    it('should create a new SSO client', async () => {
      mockPrisma.ssoClient.create.mockResolvedValue({
        id: 1,
        clientId: 'new-client',
        name: 'New Client',
        redirectUris: ['https://example.com/callback'],
        scopes: ['profile'],
      });

      const result = await service.registerClient({
        clientId: 'new-client',
        clientSecret: 'secret',
        name: 'New Client',
        redirectUris: ['https://example.com/callback'],
        scopes: ['profile'],
      });
      expect(result.clientId).toBe('new-client');
      expect(mockPrisma.ssoClient.create).toHaveBeenCalled();
    });
  });

  // ─── listClients ──────────────────────────────────
  describe('listClients', () => {
    it('should return all clients with selected fields', async () => {
      const clients = [
        { id: 1, clientId: 'client-1', name: 'Client 1', redirectUris: [], scopes: [], logoUrl: null, apiKey: 'key', isActive: true, createdAt: new Date() },
      ];
      mockPrisma.ssoClient.findMany.mockResolvedValue(clients);
      const result = await service.listClients();
      expect(result).toEqual(clients);
    });
  });

  // ─── getClientByClientId (multi-layer cache) ──────
  describe('getClientByClientId', () => {
    it('should hit Redis (L2) when L1 miss and cache into L1', async () => {
      const client = { id: 1, clientId: 'mcom-mall' };
      mockRedisService.get.mockResolvedValue(client);
      const result = await service.getClientByClientId('mcom-mall');
      expect(result).toEqual(client);
      expect(mockRedisService.get).toHaveBeenCalledWith('sso_client:mcom-mall');
      // L1 now warm — second call should skip Redis
      mockRedisService.get.mockClear();
      const second = await service.getClientByClientId('mcom-mall');
      expect(second).toEqual(client);
      expect(mockRedisService.get).not.toHaveBeenCalled();
    });

    it('should hit DB (L3) on Redis miss and populate caches', async () => {
      const client = { id: 1, clientId: 'new-app' };
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.ssoClient.findUnique.mockResolvedValue(client);
      const result = await service.getClientByClientId('new-app');
      expect(result).toEqual(client);
      expect(mockRedisService.set).toHaveBeenCalledWith('sso_client:new-app', client, 300);
    });

    it('should return null when not found anywhere', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.ssoClient.findUnique.mockResolvedValue(null);
      expect(await service.getClientByClientId('missing')).toBeNull();
    });

    it('should strip clientSecret and webhookSecret before caching in Redis', async () => {
      const dbClient = {
        id: 'c1',
        clientId: 'app-with-secrets',
        clientSecret: 'super-secret-hash',
        webhookSecret: 'enc-webhook-secret',
        hmacSecret: 'enc-hmac-secret',
        name: 'App With Secrets',
      };
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.ssoClient.findUnique.mockResolvedValue(dbClient);

      const result = await service.getClientByClientId('app-with-secrets');
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('clientSecret');
      expect(result).not.toHaveProperty('webhookSecret');
      expect(result).toMatchObject({
        id: 'c1',
        clientId: 'app-with-secrets',
        name: 'App With Secrets',
        hmacSecret: 'enc-hmac-secret',
      });

      // Assert L1 in-memory cache also returns the sanitized client
      mockPrisma.ssoClient.findUnique.mockClear();
      const l1Result = await service.getClientByClientId('app-with-secrets');
      expect(mockPrisma.ssoClient.findUnique).not.toHaveBeenCalled();
      expect(l1Result).not.toHaveProperty('clientSecret');
      expect(l1Result).not.toHaveProperty('webhookSecret');

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'sso_client:app-with-secrets',
        expect.not.objectContaining({
          clientSecret: 'super-secret-hash',
          webhookSecret: 'enc-webhook-secret',
        }),
        300,
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'sso_client:app-with-secrets',
        expect.objectContaining({
          id: 'c1',
          clientId: 'app-with-secrets',
          name: 'App With Secrets',
        }),
        300,
      );
    });
  });

  // ─── getAllCorsOrigins ────────────────────────────
  describe('getAllCorsOrigins', () => {
    it('should return cached origins from Redis when present', async () => {
      mockRedisService.get.mockResolvedValue(['https://vcard.mcom.com']);
      const result = await service.getAllCorsOrigins();
      expect(result).toEqual(['https://vcard.mcom.com']);
      expect(mockPrisma.ssoClient.findMany).not.toHaveBeenCalled();
    });

    it('should flatten unique origins from active clients and cache for 60s', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.ssoClient.findMany.mockResolvedValue([
        { corsOrigins: ['https://vcard.mcom.com', 'https://app.vcard.mcom.com'] },
        { corsOrigins: ['https://vcard.mcom.com'] },
        { corsOrigins: [] },
      ]);
      const result = await service.getAllCorsOrigins();
      expect(result).toEqual(['https://vcard.mcom.com', 'https://app.vcard.mcom.com']);
      expect(mockRedisService.set).toHaveBeenCalledWith('cors:all_origins', result, 60);
    });
  });

  // ─── invalidateCorsCache ──────────────────────────
  describe('invalidateCorsCache', () => {
    it('should delete the cors:all_origins Redis key', async () => {
      await service.invalidateCorsCache();
      expect(mockRedisService.del).toHaveBeenCalledWith('cors:all_origins');
    });
  });

  // ─── getUserInfoFromToken & Entitlement Resolution ─
  describe('getUserInfoFromToken', () => {
    it('should throw UnauthorizedException if token verification fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });
      await expect(service.getUserInfoFromToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-unknown' });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserInfoFromToken('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should service user with direct platform package (the former standalone system)', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-direct' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-direct',
        email: 'direct@test.com',
        role: 'BUSINESS',
        firstName: 'Alice',
        lastName: 'Direct',
        businessProfile: {
          id: 'b-direct',
          businessName: 'Direct Shop',
          membershipLevel: 'Bronze',
          membershipStatus: 'active',
          membershipPlanName: null,
          packages: [
            {
              id: 'pkg-1',
              platform: 'MCOM Mall',
              packageName: 'Standard',
              externalPlanId: 'tier-1',
              planName: 'Standard Plan',
              planType: 'STANDARD',
              status: 'active',
              limits: { maxProducts: 50 },
              amount: 29.99,
              expiresAt: new Date(Date.now() + 86400000),
            },
          ],
        },
      });

      mockPrisma.ssoSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        client: {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
        },
      });

      const result = await service.getUserInfoFromToken('token-direct');
      expect(result.sub).toBe('user-direct');
      expect(result.appPlan).toBeDefined();
      expect(result.appPlan.source).toBe('direct');
      expect(result.appPlan.planId).toBe('tier-1');
      expect(result.appPlan.planName).toBe('Standard Plan');
      expect(result.appPlan.limits).toEqual({ maxProducts: 50 });
      expect(result.appPlan.directPlan).toBeDefined();
      expect(result.appPlan.membershipPlan).toBeNull();
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].source).toBe('direct');
      expect(result.permissions.canAccessMall).toBe(true);
    });

    it('should service user with active membership plan (multi-app bundle system)', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-member' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-member',
        email: 'member@test.com',
        role: 'BUSINESS',
        firstName: 'Bob',
        lastName: 'Member',
        businessProfile: {
          id: 'b-member',
          businessName: 'Member Store',
          membershipLevel: 'Gold',
          membershipStatus: 'active',
          membershipPlanName: 'Gold',
          packages: [],
        },
      });

      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        id: 'plan-gold',
        name: 'Gold',
        includedApps: [
          {
            platform: 'MCOM Mall',
            clientId: 'mcom-mall',
            planId: 'mall-gold-tier',
            planName: 'Gold Mall Plan',
            quotas: { maxProducts: 500, bannerAds: 5 },
          },
          {
            platform: 'MCOM Loyalty',
            clientId: 'mcom-loyalty',
            planId: 'loyalty-gold-tier',
            planName: 'Gold Loyalty Plan',
            quotas: { maxPoints: 10000 },
          },
        ],
      });

      mockPrisma.ssoSession.findUnique.mockResolvedValue({
        id: 'sess-2',
        client: {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
        },
      });

      const result = await service.getUserInfoFromToken('token-member');
      expect(result.sub).toBe('user-member');
      expect(result.appPlan).toBeDefined();
      expect(result.appPlan.source).toBe('membership');
      expect(result.appPlan.planId).toBe('mall-gold-tier');
      expect(result.appPlan.planName).toBe('Gold Mall Plan');
      expect(result.appPlan.membershipPlanName).toBe('Gold');
      expect(result.appPlan.quotas).toEqual({ maxProducts: 500, bannerAds: 5 });
      expect(result.appPlan.membershipPlan).toBeDefined();
      expect(result.appPlan.directPlan).toBeNull();
      expect(result.membership.hasActiveMembership).toBe(true);
      expect(result.membership.appPlans).toHaveLength(2);
      expect(result.permissions.canAccessMall).toBe(true);
    });

    it('should service user with both direct plan and membership, preserving both details', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-both' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-both',
        email: 'both@test.com',
        role: 'BUSINESS',
        firstName: 'Charlie',
        lastName: 'Both',
        businessProfile: {
          id: 'b-both',
          businessName: 'Both Enterprises',
          membershipLevel: 'Silver',
          membershipStatus: 'active',
          membershipPlanName: 'Silver',
          packages: [
            {
              id: 'pkg-direct-pro',
              platform: 'MCOM Mall',
              packageName: 'Pro',
              externalPlanId: 'mall-pro-paid',
              planName: 'Pro Tier',
              planType: 'STANDARD',
              status: 'active',
              limits: { customDomains: 3 },
              amount: 79.99,
              expiresAt: new Date(Date.now() + 86400000),
            },
          ],
        },
      });

      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        id: 'plan-silver',
        name: 'Silver',
        includedApps: [
          {
            platform: 'MCOM Mall',
            clientId: 'mcom-mall',
            planId: 'mall-silver-tier',
            planName: 'Silver Mall Plan',
            quotas: { maxProducts: 200 },
          },
        ],
      });

      mockPrisma.ssoSession.findUnique.mockResolvedValue({
        id: 'sess-3',
        client: {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
        },
      });

      const result = await service.getUserInfoFromToken('token-both');
      expect(result.appPlan).toBeDefined();
      expect(result.appPlan.directPlan).toBeDefined();
      expect(result.appPlan.directPlan.planId).toBe('mall-pro-paid');
      expect(result.appPlan.membershipPlan).toBeDefined();
      expect(result.appPlan.membershipPlan.planId).toBe('mall-silver-tier');
      expect(result.membership.appPlans).toHaveLength(1);
    });

    it('should return appPlan null when user has no package and membership does not include app', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-none' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-none',
        email: 'none@test.com',
        role: 'BUSINESS',
        firstName: 'David',
        lastName: 'None',
        businessProfile: {
          id: 'b-none',
          businessName: 'No Access Co',
          membershipLevel: 'Bronze',
          membershipStatus: 'active',
          membershipPlanName: 'Bronze',
          packages: [],
        },
      });

      mockPrisma.membershipPlan.findFirst.mockResolvedValue({
        id: 'plan-bronze',
        name: 'Bronze',
        includedApps: [],
      });

      mockPrisma.ssoSession.findUnique.mockResolvedValue({
        id: 'sess-4',
        client: {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
        },
      });

      const result = await service.getUserInfoFromToken('token-none');
      expect(result.appPlan).toBeNull();
      expect(result.permissions.canAccessMall).toBe(false);
    });
  });
});
