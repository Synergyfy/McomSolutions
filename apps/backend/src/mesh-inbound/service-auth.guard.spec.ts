import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import { sign } from 'jsonwebtoken';
import { ServiceAuthGuard } from './service-auth.guard';
import { ServiceScopesGuard } from './service-scopes.guard';
import { REQUIRE_SERVICE_SCOPES_KEY } from './require-service-scopes.decorator';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const ISSUER = 'mcom-solutions';
const AUDIENCE = 'mcom-central';

function contextFor(token?: string): ExecutionContext {
  const req: any = { headers: {}, serviceCaller: undefined };
  if (token) req.headers.authorization = `Bearer ${token}`;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeToken(
  overrides: Record<string, unknown> = {},
  options: { expiresIn?: number | string; key?: string } = {},
): string {
  return sign(
    {
      iss: ISSUER,
      aud: AUDIENCE,
      sub: 'mcom-rewards',
      scope: 'central:read central:issue',
      typ: 'service',
      ...overrides,
    },
    options.key ?? privateKey,
    { algorithm: 'RS256', expiresIn: (options.expiresIn as any) ?? 300 },
  );
}

describe('ServiceAuthGuard', () => {
  let guard: ServiceAuthGuard;
  let prisma: any;
  let config: any;

  const registeredCaller = {
    clientId: 'mcom-rewards',
    platformSlug: null,
    serviceEnabled: true,
    allowedCallers: ['mcom-rewards'],
  };

  beforeEach(() => {
    prisma = {
      ssoClient: { findFirst: jest.fn() },
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'SERVICE_JWT_AUDIENCE') return AUDIENCE;
        if (key === 'MCOM_ALLOWED_CALLERS') return 'mcom-rewards';
        if (key === 'MCOM_CLIENT_ID') return 'mcom-central';
        return undefined;
      }),
    };
    guard = new ServiceAuthGuard(prisma, {
      getIssuer: () => ISSUER,
      getPublicKey: () => publicKey,
    } as any, config);
    // 1) caller is a registered, active service peer; 2) Central's ingress policy.
    prisma.ssoClient.findFirst.mockResolvedValueOnce(registeredCaller).mockResolvedValue({
      allowedCallers: ['mcom-rewards'],
    });
  });

  it('rejects a missing token (401)', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a malformed token (401)', async () => {
    await expect(guard.canActivate(contextFor('not-a-jwt'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token (401)', async () => {
    const token = makeToken({}, { expiresIn: -10 });
    await expect(guard.canActivate(contextFor(token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects the wrong audience (401)', async () => {
    const token = makeToken({ aud: 'mcom-mall' });
    await expect(guard.canActivate(contextFor(token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects the wrong issuer (401)', async () => {
    const token = makeToken({ iss: 'someone-else' });
    await expect(guard.canActivate(contextFor(token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unregistered caller (403)', async () => {
    prisma.ssoClient.findFirst.mockReset();
    prisma.ssoClient.findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor(makeToken()))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a registered caller that is not in Central allowedCallers (403)', async () => {
    prisma.ssoClient.findFirst.mockReset();
    prisma.ssoClient.findFirst
      .mockResolvedValueOnce(registeredCaller)
      .mockResolvedValueOnce({ allowedCallers: ['mcom-central'] });
    await expect(guard.canActivate(contextFor(makeToken()))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepts a valid token from an allowed caller and derives identity from the token', async () => {
    const ctx = contextFor(makeToken({ act: { sub: 'mcom-rewards' }, sub: 'user-1' }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req: any = (ctx.switchToHttp() as any).getRequest();
    expect(req.serviceCaller).toEqual(
      expect.objectContaining({
        callerAppId: 'mcom-rewards',
        isDelegated: true,
        userId: 'user-1',
        scopes: ['central:read', 'central:issue'],
      }),
    );
  });
});

describe('ServiceScopesGuard', () => {
  function ctxWith(scopes: string[]): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ serviceCaller: { scopes } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  function reflectorFor(required: string[]) {
    return {
      getAllAndMerge: jest.fn().mockReturnValue(required),
    } as any;
  }

  it('allows a caller holding the required scope', () => {
    const guard = new ServiceScopesGuard(reflectorFor(['central:read']));
    expect(guard.canActivate(ctxWith(['central:read']))).toBe(true);
  });

  it('rejects a caller missing the required scope (403)', () => {
    const guard = new ServiceScopesGuard(reflectorFor(['central:issue']));
    expect(() => guard.canActivate(ctxWith(['central:read']))).toThrow(
      ForbiddenException,
    );
  });

  it('does nothing when no scopes are declared', () => {
    const guard = new ServiceScopesGuard(reflectorFor([]));
    expect(guard.canActivate(ctxWith([]))).toBe(true);
  });
});

describe('REQUIRE_SERVICE_SCOPES_KEY', () => {
  it('is stable for metadata reads', () => {
    expect(REQUIRE_SERVICE_SCOPES_KEY).toBe('service.requiredScopes');
  });
});
