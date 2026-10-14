import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ServiceKeyService } from './keys/service-key.service';
import { ServiceTokenService } from './service-token.service';

const SSO_SECRET = 'test-sso-secret';

function mockConfig(map: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => map[key] } as unknown as ConfigService;
}

function baseClient(overrides: Record<string, unknown> = {}) {
  return {
    clientId: 'mcom-mall',
    isActive: true,
    serviceEnabled: true,
    serviceScopes: ['rewards:read', 'rewards:write'],
    allowedAudiences: ['mcom-rewards'],
    ...overrides,
  } as any;
}

describe('ServiceTokenService', () => {
  let service: ServiceTokenService;
  let keys: ServiceKeyService;
  let jwt: JwtService;
  let prisma: any;

  beforeEach(() => {
    keys = new ServiceKeyService(
      mockConfig({ NODE_ENV: 'test', SSO_JWT_SECRET: SSO_SECRET, SERVICE_JWT_ISSUER: 'mcom-solutions' }),
    );
    keys.onModuleInit();
    jwt = new JwtService();

    prisma = {
      ssoClient: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
      serviceTokenAudit: { create: jest.fn().mockResolvedValue({}) },
    };

    service = new ServiceTokenService(
      prisma,
      keys,
      jwt,
      mockConfig({ NODE_ENV: 'test', SSO_JWT_SECRET: SSO_SECRET }),
    );
  });

  const verify = (token: string) =>
    jwt.verify(token, { publicKey: keys.getPublicKey(), algorithms: ['RS256'] }) as any;

  describe('client_credentials', () => {
    it('issues a signed service token bound to the audience', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({ clientId: 'mcom-rewards', platformSlug: 'rewards' });

      const res = await service.issueClientCredentialsToken(baseClient(), ['rewards:read'], 'mcom-rewards');

      expect(res.token_type).toBe('Bearer');
      expect(res.scope).toBe('rewards:read');
      const payload = verify(res.access_token);
      expect(payload.iss).toBe('mcom-solutions');
      expect(payload.sub).toBe('mcom-mall');
      expect(payload.aud).toBe('mcom-rewards');
      expect(payload.typ).toBe('service');
      expect(payload.jti).toBeDefined();
      expect(prisma.serviceTokenAudit.create).toHaveBeenCalled();
    });

    it('defaults audience to mcom-ecosystem', async () => {
      const res = await service.issueClientCredentialsToken(baseClient(), [], undefined);
      expect(verify(res.access_token).aud).toBe('mcom-ecosystem');
    });

    it('rejects scopes outside serviceScopes', async () => {
      await expect(
        service.issueClientCredentialsToken(baseClient(), ['admin:all'], 'mcom-rewards'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects unknown audiences', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue(null);
      await expect(
        service.issueClientCredentialsToken(baseClient(), [], 'does-not-exist'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when allowedAudiences excludes the target', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({ clientId: 'mcom-rewards', platformSlug: 'rewards' });
      await expect(
        service.issueClientCredentialsToken(
          baseClient({ allowedAudiences: ['mcom-spin'] }),
          [],
          'mcom-rewards',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies by default when no audiences are configured', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({ clientId: 'mcom-rewards', platformSlug: 'rewards' });
      await expect(
        service.issueClientCredentialsToken(baseClient({ allowedAudiences: [] }), [], 'mcom-rewards'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows any target when allowedAudiences contains the wildcard', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({ clientId: 'fundordonate', platformSlug: 'fundo' });
      const res = await service.issueClientCredentialsToken(
        baseClient({ allowedAudiences: ['*'] }),
        [],
        'fundordonate',
      );
      expect(verify(res.access_token).aud).toBe('fundordonate');
    });

    it('matches a target by platformSlug when listed', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({ clientId: 'mcom-rewards', platformSlug: 'rewards' });
      const res = await service.issueClientCredentialsToken(
        baseClient({ allowedAudiences: ['rewards'] }),
        [],
        'mcom-rewards',
      );
      expect(verify(res.access_token).aud).toBe('mcom-rewards');
    });

    it('rejects when service is disabled', async () => {
      await expect(
        service.issueClientCredentialsToken(baseClient({ serviceEnabled: false }), [], undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('token exchange (RFC 8693)', () => {
    it('issues a delegated token with sub=user and act=caller', async () => {
      prisma.ssoClient.findFirst.mockResolvedValue({ clientId: 'mcom-rewards', platformSlug: 'rewards' });
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'u@example.com',
        role: 'BUSINESS',
        businessProfile: { id: 'biz-1' },
      });

      const subjectToken = jwt.sign({ sub: 'user-1', email: 'u@example.com' }, { secret: SSO_SECRET });
      const res = await service.exchangeUserToken(baseClient(), subjectToken, 'mcom-rewards', ['rewards:read']);

      const payload = verify(res.access_token);
      expect(payload.typ).toBe('delegated');
      expect(payload.sub).toBe('user-1');
      expect(payload.act).toEqual({ sub: 'mcom-mall' });
      expect(payload.aud).toBe('mcom-rewards');
      expect(payload.businessId).toBe('biz-1');
    });

    it('rejects an invalid subject token', async () => {
      await expect(
        service.exchangeUserToken(baseClient(), 'not-a-jwt', 'mcom-rewards', []),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the subject user no longer exists', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const subjectToken = jwt.sign({ sub: 'ghost' }, { secret: SSO_SECRET });
      await expect(
        service.exchangeUserToken(baseClient(), subjectToken, 'mcom-rewards', []),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
