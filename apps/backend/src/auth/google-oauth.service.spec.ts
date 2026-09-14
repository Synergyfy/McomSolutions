import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { GoogleOAuthService } from './google-oauth.service';
import { BadGatewayException, UnauthorizedException } from '@nestjs/common';

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let env: Record<string, string>;

  const mockConfigService = {
    get: jest.fn((key: string) => env[key]),
  };

  const createService = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleOAuthService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();
    return module.get<GoogleOAuthService>(GoogleOAuthService);
  };

  beforeEach(async () => {
    env = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_OAUTH_STATE_SECRET: 'test-state-secret',
      JWT_SECRET: 'test-jwt-secret',
      NODE_ENV: 'test',
      GOOGLE_OAUTH_SIMULATOR: 'false',
      APP_URL: 'http://localhost:3010',
    };
    service = await createService();
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should be true when both client id and secret are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should be false when client id is missing', () => {
      env.GOOGLE_CLIENT_ID = '';
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('isSimulatorEnabled', () => {
    it('should be false when the flag is off', () => {
      expect(service.isSimulatorEnabled()).toBe(false);
    });

    it('should be true only when flag is on and not production', () => {
      env.GOOGLE_OAUTH_SIMULATOR = 'true';
      expect(service.isSimulatorEnabled()).toBe(true);
    });

    it('should be false in production even when flag is on', () => {
      env.GOOGLE_OAUTH_SIMULATOR = 'true';
      env.NODE_ENV = 'production';
      expect(service.isSimulatorEnabled()).toBe(false);
    });
  });

  describe('getRedirectUri', () => {
    it('should point at the business google callback', () => {
      expect(service.getRedirectUri()).toBe('http://localhost:3010/api/v1/business/google/callback');
    });
  });

  describe('getAuthUrl', () => {
    it('should build a google auth URL with state and redirect uri', () => {
      const url = new URL(service.getAuthUrl('signed-state'));
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.get('state')).toBe('signed-state');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3010/api/v1/business/google/callback',
      );
    });

    it('should include business.manage scope and offline access when requested', () => {
      const url = new URL(
        service.getAuthUrl('signed-state', {
          scopes: 'https://www.googleapis.com/auth/business.manage openid email profile',
          accessType: 'offline',
          prompt: 'consent',
        }),
      );
      expect(url.searchParams.get('scope')).toContain('business.manage');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
    });
  });

  describe('signState / verifyState', () => {
    it('should round-trip a signed payload', () => {
      const state = service.signState({ type: 'login' });
      const payload = service.verifyState(state);
      expect(payload.type).toBe('login');
      expect(payload.exp).toBeGreaterThan(Date.now());
    });

    it('should return null for a tampered signature', () => {
      const state = service.signState({ type: 'claim', placeId: 'abc', returnUrl: 'https://x.com' });
      const [body] = state.split('.');
      expect(service.verifyState(`${body}.tampered-signature`)).toBeNull();
    });

    it('should return null for a modified body', () => {
      const state = service.signState({ type: 'login' });
      const [, sig] = state.split('.');
      const forgedBody = Buffer.from(JSON.stringify({ type: 'claim', placeId: 'abc' })).toString('base64url');
      expect(service.verifyState(`${forgedBody}.${sig}`)).toBeNull();
    });

    it('should return null for an expired payload', () => {
      const state = service.signState({ type: 'login' });
      const [body, sig] = state.split('.');
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
      payload.exp = Date.now() - 1000;
      const expiredBody = Buffer.from(JSON.stringify(payload)).toString('base64url');
      expect(service.verifyState(`${expiredBody}.${sig}`)).toBeNull();
    });

    it('should return null for garbage input', () => {
      expect(service.verifyState('')).toBeNull();
      expect(service.verifyState('no-dot')).toBeNull();
      expect(service.verifyState('a.b')).toBeNull();
    });
  });

  describe('signEmailGrant / verifyEmailGrant', () => {
    it('should round-trip a signed email grant and normalize the email', () => {
      const grant = service.signEmailGrant('Owner@Test.com ', 'place-1');
      expect(service.verifyEmailGrant(grant)).toEqual({
        email: 'owner@test.com',
        placeId: 'place-1',
      });
    });

    it('should allow a grant without a placeId', () => {
      const grant = service.signEmailGrant('a@b.com');
      expect(service.verifyEmailGrant(grant)).toEqual({ email: 'a@b.com', placeId: undefined });
    });

    it('should reject a signed state that is not an email-grant type', () => {
      const state = service.signState({ type: 'login' });
      expect(service.verifyEmailGrant(state)).toBeNull();
    });

    it('should reject a tampered grant', () => {
      const grant = service.signEmailGrant('a@b.com', 'place-1');
      const [body] = grant.split('.');
      expect(service.verifyEmailGrant(`${body}.forged-signature`)).toBeNull();
    });

    it('should reject an expired grant', () => {
      const secret = env.GOOGLE_OAUTH_STATE_SECRET;
      const now = Date.now();
      const body = Buffer.from(
        JSON.stringify({ type: 'email-grant', email: 'a@b.com', iat: now - 2000000, exp: now - 1000 }),
      ).toString('base64url');
      const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
      expect(service.verifyEmailGrant(`${body}.${sig}`)).toBeNull();
    });

    it('should return null for missing or empty input', () => {
      expect(service.verifyEmailGrant(undefined)).toBeNull();
      expect(service.verifyEmailGrant(null)).toBeNull();
      expect(service.verifyEmailGrant('')).toBeNull();
    });
  });

  describe('exchangeCodeForEmail', () => {
    it('should return the verified email from the id_token', async () => {
      const idToken = [
        Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url'),
        Buffer.from(JSON.stringify({ email: 'user@test.com', email_verified: true })).toString('base64url'),
        'sig',
      ].join('.');
      jest.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'tok', id_token: idToken } });

      const email = await service.exchangeCodeForEmail('auth-code', service.getRedirectUri());
      expect(email).toBe('user@test.com');
    });

    it('should fall back to userinfo when id_token is missing', async () => {
      jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { access_token: 'tok' } });
      jest
        .spyOn(axios, 'get')
        .mockResolvedValue({ data: { email: 'user@test.com', verified_email: true } });

      const email = await service.exchangeCodeForEmail('auth-code', service.getRedirectUri());
      expect(email).toBe('user@test.com');
    });

    it('should reject an unverified email', async () => {
      jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { access_token: 'tok' } });
      jest
        .spyOn(axios, 'get')
        .mockResolvedValue({ data: { email: 'user@test.com', verified_email: false } });

      await expect(service.exchangeCodeForEmail('auth-code', service.getRedirectUri())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadGatewayException when token exchange fails', async () => {
      jest.spyOn(axios, 'post').mockRejectedValue(new Error('network down'));

      await expect(service.exchangeCodeForEmail('auth-code', service.getRedirectUri())).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});