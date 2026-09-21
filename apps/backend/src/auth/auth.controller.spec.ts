import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockAuthService = {
    registerBusiness: jest.fn().mockResolvedValue({
      accessToken: 'token-123',
      user: { id: 'u1', email: 'test@biz.com', role: 'BUSINESS' },
    }),
    registerCustomer: jest.fn().mockResolvedValue({
      accessToken: 'token-cust',
      user: { id: 'u2', email: 'cust@test.com', role: 'CUSTOMER' },
    }),
    registerAffiliate: jest.fn().mockResolvedValue({
      accessToken: 'token-aff',
      user: { id: 'u3', email: 'aff@test.com', role: 'AGENT' },
    }),
  };

  const mockPrismaService = {};
  const mockGoogleOAuth = {};
  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRes = {
    cookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GoogleOAuthService, useValue: mockGoogleOAuth },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should throw BadRequestException when confirm_password does not match password', async () => {
      await expect(
        controller.register(
          {
            email: 'test@biz.com',
            password: 'Password123!',
            confirm_password: 'DifferentPassword!',
          },
          mockRes,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when confirmPassword does not match password', async () => {
      await expect(
        controller.register(
          {
            email: 'test@biz.com',
            password: 'Password123!',
            confirmPassword: 'DifferentPassword!',
          },
          mockRes,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully register when confirm_password matches password', async () => {
      const result = await controller.register(
        {
          email: 'test@biz.com',
          password: 'Password123!',
          confirm_password: 'Password123!',
          role: 'BUSINESS',
        },
        mockRes,
      );

      expect(authService.registerBusiness).toHaveBeenCalled();
      expect(result.accessToken).toBe('token-123');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'mcom_session',
        'token-123',
        expect.any(Object),
      );
    });

    it('should successfully register when confirm_password is not provided', async () => {
      const result = await controller.register(
        {
          email: 'test@biz.com',
          password: 'Password123!',
          role: 'BUSINESS',
        },
        mockRes,
      );

      expect(authService.registerBusiness).toHaveBeenCalled();
      expect(result.accessToken).toBe('token-123');
    });
  });
});
