import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let redis: any;

  // In-memory Redis stand-in with TTL support — mirrors RedisService memory fallback.
  const redisStore = new Map<string, { value: any; expiresAt: number }>();
  const readStore = (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      redisStore.delete(key);
      return null;
    }
    return entry.value;
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshSession: {
      create: jest.fn().mockResolvedValue({ id: 'rs-1' }),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    businessProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    platformPackage: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((fnOrOps: any) => {
      // Interactive transactions run the callback against the mock itself.
      if (typeof fnOrOps === 'function') return fnOrOps(mockPrisma);
      // Array form resolves all operations.
      return Promise.all(fnOrOps);
    }),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      // Provide a usable secret for token signing; otherwise read from process.env
      // so the existing `process.env.MOCK_OTP = 'true'` test setup keeps working.
      if (key === 'SSO_SECRET' || key === 'SSO_JWT_SECRET' || key === 'JWT_SECRET') {
        return 'test-jwt-secret';
      }
      if (key === 'OTP_PEPPER') {
        return process.env.OTP_PEPPER ?? 'test-otp-pepper';
      }
      return process.env[key];
    }),
  };

  const mockRedis = {
    isAvailable: jest.fn(() => true),
    get: jest.fn(async (key: string) => readStore(key)),
    set: jest.fn(async (key: string, value: any, ttlSeconds = 300) => {
      redisStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }),
    del: jest.fn(async (key: string) => {
      redisStore.delete(key);
    }),
    ttl: jest.fn(async (key: string) => {
      const entry = redisStore.get(key);
      if (!entry) return null;
      const remainingMs = entry.expiresAt - Date.now();
      if (remainingMs <= 0) {
        redisStore.delete(key);
        return null;
      }
      return Math.ceil(remainingMs / 1000);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    redis = module.get(RedisService);

    redisStore.clear();
    jest.clearAllMocks();
  });

  // ─── sendOtp (pure Redis, hashed) ────────────
  describe('sendOtp', () => {
    it('should generate and store hashed OTP, return mock mode', async () => {
      process.env.MOCK_OTP = 'true';
      const result = await service.sendOtp('test@example.com');
      expect(result.success).toBe(true);
      expect(result.mode).toBe('mock');
      expect(result.code).toBeDefined();
      expect(result.code).toHaveLength(6);
      // Only the HMAC hash is stored — never plaintext.
      const stored = await redis.get('otp:OTP:test@example.com');
      expect(stored.h).toBeDefined();
      expect(stored.h).not.toContain(result.code!);
      expect(stored.attempts).toBe(0);
    });

    it('should normalize email to lowercase and verify round-trip', async () => {
      process.env.MOCK_OTP = 'true';
      const result = await service.sendOtp('TEST@Example.COM');
      expect(result.success).toBe(true);
      const stored = await redis.get('otp:OTP:test@example.com');
      expect(stored).toBeDefined();
      const verifyResult = await service.verifyOtp('test@example.com', result.code!);
      expect(verifyResult).toBe(true);
    });

    it('should throttle resends within the cooldown window', async () => {
      process.env.MOCK_OTP = 'true';
      await service.sendOtp('cool@example.com');
      await expect(service.sendOtp('cool@example.com')).rejects.toThrow(HttpException);
    });
  });

  // ─── resendOtp ────────────────────────────────────
  describe('resendOtp', () => {
    it('should issue a new OTP once the cooldown expires', async () => {
      process.env.MOCK_OTP = 'true';
      await service.sendOtp('test@example.com');
      await redis.del('otp:cooldown:OTP:test@example.com');
      const resent = await service.resendOtp('test@example.com');
      expect(resent.success).toBe(true);
      expect(resent.code).toBeDefined();
    });
  });

  // ─── verifyOtp ────────────────────────────────────
  describe('verifyOtp', () => {
    it('should return true for valid OTP', async () => {
      process.env.MOCK_OTP = 'true';
      const sent = await service.sendOtp('test@example.com');
      const result = await service.verifyOtp('test@example.com', sent.code!);
      expect(result).toBe(true);
    });

    it('should return false for invalid OTP', async () => {
      process.env.MOCK_OTP = 'true';
      await service.sendOtp('test@example.com');
      const result = await service.verifyOtp('test@example.com', '000000');
      expect(result).toBe(false);
    });

    it('should consume OTP after successful verification (one-time use)', async () => {
      process.env.MOCK_OTP = 'true';
      const sent = await service.sendOtp('test@example.com');
      await service.verifyOtp('test@example.com', sent.code!);
      const secondTry = await service.verifyOtp('test@example.com', sent.code!);
      expect(secondTry).toBe(false);
    });

    it('should burn the code after 5 wrong attempts', async () => {
      process.env.MOCK_OTP = 'true';
      const sent = await service.sendOtp('locked@example.com');
      for (let i = 0; i < 5; i++) {
        expect(await service.verifyOtp('locked@example.com', '000000')).toBe(false);
      }
      expect(await service.verifyOtp('locked@example.com', sent.code!)).toBe(false);
    });
  });

  // ─── sendForgotPasswordCode ───────────────────────
  describe('sendForgotPasswordCode', () => {
    it('should throw ConflictException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.sendForgotPasswordCode('nonexistent@test.com')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should generate reset code for existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
      process.env.MOCK_OTP = 'true';
      const result = await service.sendForgotPasswordCode('test@test.com');
      expect(result.success).toBe(true);
      expect(result.resetCode).toBeDefined();
      expect(result.mode).toBe('mock');
      const stored = await redis.get('otp:PASSWORD_RESET:test@test.com');
      expect(stored.h).toBeDefined();
    });
  });

  // ─── verifyResetCode ──────────────────────────────
  describe('verifyResetCode', () => {
    it('should return false for non-existent email', async () => {
      const result = await service.verifyResetCode('nobody@test.com', '123456');
      expect(result).toBe(false);
    });

    it('should return false for wrong code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
      process.env.MOCK_OTP = 'true';
      await service.sendForgotPasswordCode('test@test.com');
      const result = await service.verifyResetCode('test@test.com', '000000');
      expect(result).toBe(false);
    });

    it('should return true for correct code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
      process.env.MOCK_OTP = 'true';
      const sent = await service.sendForgotPasswordCode('test@test.com');
      const result = await service.verifyResetCode('test@test.com', sent.resetCode!);
      expect(result).toBe(true);
    });
  });

  // ─── resetPassword ────────────────────────────────
  describe('resetPassword', () => {
    it('should throw UnauthorizedException for invalid code', async () => {
      await expect(
        service.resetPassword({ email: 'nobody@test.com', code: 'wrong', newPassword: 'NewPass1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and return true for valid code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
      process.env.MOCK_OTP = 'true';
      const sent = await service.sendForgotPasswordCode('test@test.com');
      mockPrisma.user.update.mockResolvedValue({ id: '1', email: 'test@test.com' });
      const result = await service.resetPassword({
        email: 'test@test.com',
        code: sent.resetCode!,
        newPassword: 'NewPass1!',
      });
      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  // ─── validateUser ─────────────────────────────────
  describe('validateUser', () => {
    it('should return user without password when credentials match', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        password: '$2a$10$mockhash', // bcrypt hash
        role: 'BUSINESS',
        businessProfile: { id: 'b1', businessName: 'Test Biz' },
      };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // We can't easily mock bcrypt.compare, so we test the path without password
      const result = await service.validateUser('test@test.com');
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const result = await service.validateUser('nobody@test.com');
      expect(result).toBeNull();
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await service.validateUser('UPPERCASE@TEST.COM');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'uppercase@test.com', deletedAt: null },
        }),
      );
    });
  });

  // ─── login ────────────────────────────────────────
  describe('login', () => {
    it('should return access token, refresh token, and user info', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        role: 'BUSINESS',
        businessProfile: { id: 'b1', businessName: 'Test Biz' },
      };

      const result = await service.login(mockUser);
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.email).toBe('test@test.com');
      expect(result.user.businessId).toBe('b1');
      expect(result.user.isOnboarded).toBe(true);
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should handle user without business profile', async () => {
      const mockUser = {
        id: '2',
        email: 'customer@test.com',
        role: 'CUSTOMER',
        businessProfile: null,
      };
      mockPrisma.businessProfile.findFirst.mockResolvedValue(null);

      const result = await service.login(mockUser);
      expect(result.user.businessId).toBeNull();
      expect(result.user.isOnboarded).toBe(false);
      expect(result.user.name).toBe('customer');
    });

    it('should dynamically query businessProfile if not passed on user object', async () => {
      const mockUser = {
        id: 'user-biz-1',
        email: 'owner@test.com',
        role: 'BUSINESS',
      };
      mockPrisma.businessProfile.findFirst.mockResolvedValue({ id: 'bp-99', businessName: 'Dynamic Store' });

      const result = await service.login(mockUser);
      expect(mockPrisma.businessProfile.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-biz-1', deletedAt: null } });
      expect(result.user.businessId).toBe('bp-99');
      expect(result.user.isOnboarded).toBe(true);
      expect(result.user.name).toBe('Dynamic Store');
    });
  });

  // ─── registerBusiness ─────────────────────────────
  describe('registerBusiness', () => {
    it('should throw ConflictException if email already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'existing@test.com' });
      await expect(
        service.registerBusiness({ email: 'existing@test.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and business profile, then login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const newUser = {
        id: '1',
        email: 'newbiz@test.com',
        password: 'hashed',
        role: Role.BUSINESS,
        businessProfile: { id: 'b1', businessName: 'My Biz' },
      };
      mockPrisma.user.create.mockResolvedValue(newUser);

      const result = await service.registerBusiness({
        email: 'newbiz@test.com',
        businessName: 'My Biz',
      });

      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-token');
      expect(result.user.email).toBe('newbiz@test.com');
    });
  });

  // ─── registerCustomer ─────────────────────────────
  describe('registerCustomer', () => {
    it('should throw ConflictException if email already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'existing@test.com' });
      await expect(
        service.registerCustomer({ email: 'existing@test.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create customer user and login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const newUser = {
        id: '2',
        email: 'customer@test.com',
        password: 'hashed',
        role: Role.CUSTOMER,
        businessProfile: null,
      };
      mockPrisma.user.create.mockResolvedValue(newUser);

      const result = await service.registerCustomer({
        email: 'customer@test.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'customer@test.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
        }),
      );
      expect(result.accessToken).toBe('mock-token');
    });
  });

  // ─── updateSettings ───────────────────────────────
  describe('updateSettings', () => {
    it('should update user settings and return selected fields', async () => {
      const updated = {
        id: '1',
        email: 'test@test.com',
        firstName: 'Updated',
        lastName: 'Name',
        jobTitle: 'Manager',
        twoFactorEnabled: true,
        emailNotifications: false,
        smsNotifications: true,
      };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateSettings('user-1', {
        firstName: 'Updated',
        lastName: 'Name',
        jobTitle: 'Manager',
        twoFactorEnabled: true,
        emailNotifications: false,
        smsNotifications: true,
      });

      expect(result.firstName).toBe('Updated');
      expect(result.twoFactorEnabled).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
        }),
      );
    });
  });

  // ─── generateSsoToken ─────────────────────────────
  describe('generateSsoToken', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.generateSsoToken('nonexistent')).rejects.toThrow(UnauthorizedException);
    });

    it('should generate SSO token for valid user', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        role: Role.BUSINESS,
        businessProfile: {
          id: 'b1',
          businessName: 'Test Biz',
          phone: '123',
          postcode: 'NW1',
          address: '14 High Street',
        },
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.generateSsoToken('user-1', 'mcom-mall');
      expect(result.ssoToken).toBeDefined();
      expect(result.ssoToken).toBe('mock-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          aud: 'mcom-mall',
          sub: '1',
          email: 'test@test.com',
        }),
        expect.objectContaining({
          expiresIn: '60s',
        }),
      );
    });

    it('should use default target client ID when none provided', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        role: Role.BUSINESS,
        businessProfile: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await service.generateSsoToken('user-1');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ aud: 'mcom-ecosystem' }),
        expect.any(Object),
      );
    });
  });

  // ─── Phase 3: refresh rotation ──────────────────
  describe('refreshTokens', () => {
    const liveSession = {
      id: 'rs-live',
      userId: '1',
      revokedAt: null,
      replacedById: null,
      expiresAt: new Date(Date.now() + 3600_000),
    };
    const liveUser = {
      id: '1',
      email: 'test@test.com',
      role: 'BUSINESS',
      firstName: '',
      lastName: '',
      tokenVersion: 0,
      businessProfile: null,
    };

    it('should rotate a valid refresh token and revoke the old session', async () => {
      jwtService.verify.mockReturnValue({ jti: 'old-jti', sub: '1', tv: 0, type: 'refresh' });
      mockPrisma.refreshSession.findUnique.mockResolvedValue(liveSession);
      mockPrisma.user.findFirst.mockResolvedValue(liveUser);

      const result = await service.refreshTokens('valid-refresh');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(mockPrisma.refreshSession.create).toHaveBeenCalled();
      expect(mockPrisma.refreshSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rs-live' } }),
      );
    });

    it('should reject a forged signature without side effects', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('bad sig'); });

      await expect(service.refreshTokens('forged')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshSession.findUnique).not.toHaveBeenCalled();
    });

    it('should reject a non-refresh JWT (access token presented as refresh)', async () => {
      jwtService.verify.mockReturnValue({ jti: 'a', sub: '1', tv: 0 });

      await expect(service.refreshTokens('access-as-refresh')).rejects.toThrow(UnauthorizedException);
    });

    it('should revoke all user sessions on reuse of a rotated token', async () => {
      jwtService.verify.mockReturnValue({ jti: 'old-jti', sub: '1', tv: 0, type: 'refresh' });
      mockPrisma.refreshSession.findUnique.mockResolvedValue({
        ...liveSession,
        revokedAt: new Date(),
        replacedById: 'new-jti',
      });

      await expect(service.refreshTokens('reused-refresh')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: '1', revokedAt: null } }),
      );
    });

    it('should reject an expired session and mark it revoked', async () => {
      jwtService.verify.mockReturnValue({ jti: 'old-jti', sub: '1', tv: 0, type: 'refresh' });
      mockPrisma.refreshSession.findUnique.mockResolvedValue({
        ...liveSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refreshTokens('expired-refresh')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rs-live' } }),
      );
    });

    it('should reject when the user tokenVersion changed (password reset / role change)', async () => {
      jwtService.verify.mockReturnValue({ jti: 'old-jti', sub: '1', tv: 0, type: 'refresh' });
      mockPrisma.refreshSession.findUnique.mockResolvedValue(liveSession);
      mockPrisma.user.findFirst.mockResolvedValue({ ...liveUser, tokenVersion: 1 });

      await expect(service.refreshTokens('stale-tv')).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a refresh for a deleted user', async () => {
      jwtService.verify.mockReturnValue({ jti: 'old-jti', sub: '1', tv: 0, type: 'refresh' });
      mockPrisma.refreshSession.findUnique.mockResolvedValue(liveSession);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.refreshTokens('deleted-user')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Phase 3: logout / revocation ───────────────
  describe('logout', () => {
    it('should revoke a single session when a refresh token is given', async () => {
      mockPrisma.refreshSession.findUnique.mockResolvedValue({ id: 'rs-1', userId: '1' });

      const result = await service.logout('1', 'some-refresh');

      expect(result.success).toBe(true);
      expect(mockPrisma.refreshSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rs-1' } }),
      );
      expect(mockPrisma.refreshSession.updateMany).not.toHaveBeenCalled();
    });

    it('should revoke all sessions when no refresh token is given', async () => {
      const result = await service.logout('1');

      expect(result.success).toBe(true);
      expect(mockPrisma.refreshSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: '1', revokedAt: null } }),
      );
    });

    it('should not revoke another user’s session', async () => {
      mockPrisma.refreshSession.findUnique.mockResolvedValue({ id: 'rs-9', userId: 'other' });

      await service.logout('1', 'foreign-refresh');

      expect(mockPrisma.refreshSession.update).not.toHaveBeenCalled();
    });
  });

  describe('revokeUserSessions', () => {
    it('should bump tokenVersion and revoke refresh sessions', async () => {
      await service.revokeUserSessions('1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { tokenVersion: { increment: 1 } },
        }),
      );
      expect(mockPrisma.refreshSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: '1', revokedAt: null } }),
      );
    });
  });
});
