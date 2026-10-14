import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SsoUserGuard } from './sso-user.guard';

describe('SsoUserGuard', () => {
  let guard: SsoUserGuard;
  let jwtService: { verify: jest.Mock };
  let configService: { get: jest.Mock };
  let prisma: { user: { findFirst: jest.Mock } };

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('test-sso-secret') };
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
    };

    guard = new SsoUserGuard(
      jwtService as any,
      configService as any,
      prisma as any,
    );
  });

  function createMockContext(authHeader?: string) {
    const request: any = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('should throw UnauthorizedException if Authorization header is missing', async () => {
    const { context } = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing or invalid Authorization header'),
    );
  });

  it('should throw UnauthorizedException if Authorization header does not start with Bearer', async () => {
    const { context } = createMockContext('Basic xyz123');
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing or invalid Authorization header'),
    );
  });

  it('should throw UnauthorizedException if SSO_JWT_SECRET is not configured', async () => {
    configService.get.mockReturnValue(undefined);
    const { context } = createMockContext('Bearer valid-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('SSO_JWT_SECRET is not configured'),
    );
  });

  it('should throw UnauthorizedException if token verification fails', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const { context } = createMockContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired SSO token'),
    );
  });

  it('should throw UnauthorizedException if payload is missing sub/id', async () => {
    jwtService.verify.mockReturnValue({ role: 'USER' });
    const { context } = createMockContext('Bearer token-without-sub');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid token payload: missing subject'),
    );
  });

  it('should throw UnauthorizedException if user is not found in database', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-123' });
    prisma.user.findFirst.mockResolvedValue(null);
    const { context } = createMockContext('Bearer token-valid');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('User not found or account deactivated'),
    );
  });

  it('should throw UnauthorizedException if Bearer token is empty', async () => {
    const { context } = createMockContext('Bearer   ');
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing or invalid Authorization header'),
    );
  });

  it('should throw UnauthorizedException if session is revoked due to tokenVersion mismatch', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-123',
      tv: 0,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'owner@test.com',
      role: 'BUSINESS',
      tokenVersion: 1,
      businessProfile: null,
    });
    const { context } = createMockContext('Bearer valid-sso-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Session revoked. Please log in again.'),
    );
  });

  it('should attach normalized user to request and return true on success (including lowercase bearer)', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-123',
      name: 'Test Business',
      scopes: ['read', 'write'],
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'owner@test.com',
      role: 'BUSINESS',
      tokenVersion: 0,
      businessProfile: {
        id: 'biz-123',
        businessName: 'Test Business',
      },
    });

    const { context, request } = createMockContext('bearer valid-sso-token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: 'user-123',
      id: 'user-123',
      email: 'owner@test.com',
      role: 'BUSINESS',
      name: 'Test Business',
      businessId: 'biz-123',
      scopes: ['read', 'write'],
    });
  });
});

