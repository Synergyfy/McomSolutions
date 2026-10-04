import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy (Phase 3)', () => {
  const mockConfig = { get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined)) };
  const mockPrisma: any = {
    user: { findFirst: jest.fn() },
    refreshSession: { findFirst: jest.fn().mockResolvedValue(null) },
  };

  const strategy = new JwtStrategy(mockConfig as any, mockPrisma);

  beforeEach(() => jest.clearAllMocks());

  const liveUser = {
    id: 'u1',
    email: 'u@test.com',
    role: 'BUSINESS',
    tokenVersion: 3,
    businessProfile: { id: 'b1' },
  };

  it('should return identity for a live user with matching tokenVersion', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(liveUser);

    const result = await strategy.validate({ sub: 'u1', tv: 3, jti: 'a1', businessId: 'b1' });

    expect(result).toEqual(
      expect.objectContaining({ userId: 'u1', email: 'u@test.com', role: 'BUSINESS', businessId: 'b1' }),
    );
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1', deletedAt: null } }),
    );
  });

  it('should reject tokens for deleted/missing users', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'gone', tv: 0 })).rejects.toThrow(UnauthorizedException);
  });

  it('should reject when tokenVersion changed (role-change / ban / password reset)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(liveUser);

    await expect(strategy.validate({ sub: 'u1', tv: 2 })).rejects.toThrow(UnauthorizedException);
  });

  it('should accept legacy tokens without a tv claim (backwards compat)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(liveUser);

    const result = await strategy.validate({ sub: 'u1' });

    expect(result.userId).toBe('u1');
  });

  it('should reject a logged-out access jti', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(liveUser);
    mockPrisma.refreshSession.findFirst.mockResolvedValue({ id: 'rs-revoked' });

    await expect(strategy.validate({ sub: 'u1', tv: 3, jti: 'logged-out' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject payloads without a subject', async () => {
    await expect(strategy.validate({})).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});
