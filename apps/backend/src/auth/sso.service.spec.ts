import { Test, TestingModule } from '@nestjs/testing';
import { SsoService } from './sso.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('SsoService', () => {
  let service: SsoService;
  let prisma: any;
  let jwtService: any;
  let configService: any;

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
      mockPrisma.ssoAuthCode.update.mockResolvedValue({ ...validAuthCode, used: true });
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
});
