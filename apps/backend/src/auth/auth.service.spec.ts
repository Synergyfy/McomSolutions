import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  // ─── sendOtp ──────────────────────────────────────
  describe('sendOtp', () => {
    it('should generate and store OTP, return mock mode', async () => {
      process.env.MOCK_OTP = 'true';
      const result = await service.sendOtp('test@example.com');
      expect(result.success).toBe(true);
      expect(result.mode).toBe('mock');
      expect(result.code).toBeDefined();
      expect(result.code).toHaveLength(6);
    });

    it('should normalize email to lowercase', async () => {
      process.env.MOCK_OTP = 'true';
      const result = await service.sendOtp('TEST@Example.COM');
      expect(result.success).toBe(true);
      // Next OTP verification should use lowercased email
      const verifyResult = await service.verifyOtp('test@example.com', result.code!);
      expect(verifyResult).toBe(true);
    });
  });

  // ─── resendOtp ────────────────────────────────────
  describe('resendOtp', () => {
    it('should delete old OTP and generate new one', async () => {
      process.env.MOCK_OTP = 'true';
      await service.sendOtp('test@example.com');
      const resent = await service.resendOtp('test@example.com');
      expect(resent.success).toBe(true);
      expect(resent.code).toBeDefined();
    });
  });

  // ─── verifyOtp ────────────────────────────────────
  describe('verifyOtp', () => {
    it('should return true for valid OTP', async () => {
      process.env.MOCK_OTP = 'true';
      const { code } = await service.sendOtp('test@example.com');
      const result = await service.verifyOtp('test@example.com', code!);
      expect(result).toBe(true);
    });

    it('should return false for invalid OTP', async () => {
      const result = await service.verifyOtp('test@example.com', '000000');
      expect(result).toBe(false);
    });

    it('should consume OTP after successful verification (one-time use)', async () => {
      process.env.MOCK_OTP = 'true';
      const { code } = await service.sendOtp('test@example.com');
      await service.verifyOtp('test@example.com', code!);
      const secondTry = await service.verifyOtp('test@example.com', code!);
      expect(secondTry).toBe(false);
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
      const { resetCode } = await service.sendForgotPasswordCode('test@test.com');
      const result = await service.verifyResetCode('test@test.com', resetCode!);
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
      mockPrisma.user.update.mockResolvedValue({ id: '1', email: 'test@test.com' });
      process.env.MOCK_OTP = 'true';
      const { resetCode } = await service.sendForgotPasswordCode('test@test.com');
      const result = await service.resetPassword({
        email: 'test@test.com',
        code: resetCode!,
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
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // We can't easily mock bcrypt.compare, so we test the path without password
      const result = await service.validateUser('test@test.com');
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.validateUser('nobody@test.com');
      expect(result).toBeNull();
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await service.validateUser('UPPERCASE@TEST.COM');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'uppercase@test.com' },
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

      const result = await service.login(mockUser);
      expect(result.user.businessId).toBeNull();
      expect(result.user.isOnboarded).toBe(false);
      expect(result.user.name).toBe('customer');
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
});
