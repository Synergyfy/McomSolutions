import { Injectable, UnauthorizedException, BadGatewayException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class GoogleOAuthService {
  private static readonly STATE_TTL_MS = 10 * 60 * 1000;
  // Email grants outlive OAuth state so a slow onboarding flow isn't cut short
  // (they are single-purpose: proving the caller holds a Google-verified email).
  private static readonly EMAIL_GRANT_TTL_MS = 30 * 60 * 1000;

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('GOOGLE_CLIENT_ID') &&
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    );
  }

  isSimulatorEnabled(): boolean {
    return (
      this.configService.get<string>('GOOGLE_OAUTH_SIMULATOR') === 'true' &&
      this.configService.get<string>('NODE_ENV') !== 'production'
    );
  }

  getRedirectUri(): string {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3010';
    return `${appUrl}/api/v1/business/google/callback`;
  }

  getAuthUrl(state: string, options?: { scopes?: string; accessType?: string; prompt?: string }): string {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new InternalServerErrorException('GOOGLE_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: options?.scopes || 'openid email profile',
      state,
    });
    if (options?.accessType) params.set('access_type', options.accessType);
    if (options?.prompt) params.set('prompt', options.prompt);

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  signState(payload: object): string {
    const now = Date.now();
    const body = Buffer.from(
      JSON.stringify({ ...payload, iat: now, exp: now + GoogleOAuthService.STATE_TTL_MS }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', this.stateSecret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verifyState(state: string): any | null {
    if (!state || typeof state !== 'string') return null;
    const separator = state.lastIndexOf('.');
    if (separator <= 0) return null;

    const body = state.slice(0, separator);
    const sig = state.slice(separator + 1);

    const expected = crypto.createHmac('sha256', this.stateSecret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    } catch {
      return null;
    }

    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  }

  /**
   * Signs a short-lived grant proving the holder has completed a real Google
   * OAuth flow that returned this verified email (and optionally the claimed
   * place). Used to bind `complete-onboarding` to a server-verified claim so the
   * endpoint can never be called with an arbitrary email.
   */
  signEmailGrant(email: string, placeId?: string): string {
    const now = Date.now();
    const body = Buffer.from(
      JSON.stringify({
        type: 'email-grant',
        email: String(email).toLowerCase().trim(),
        placeId: placeId || undefined,
        iat: now,
        exp: now + GoogleOAuthService.EMAIL_GRANT_TTL_MS,
      }),
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', this.stateSecret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  /**
   * Verifies an email grant. Returns `null` for missing/tampered/expired tokens
   * or tokens that are not an `email-grant` type, so callers can fail closed.
   */
  verifyEmailGrant(token: string | undefined | null): { email: string; placeId?: string } | null {
    const payload = this.verifyState(token || '');
    if (!payload || payload.type !== 'email-grant') return null;
    const email = String(payload.email || '').toLowerCase().trim();
    if (!email) return null;
    return {
      email,
      placeId: payload.placeId ? String(payload.placeId) : undefined,
    };
  }

  async exchangeCodeForEmail(code: string, redirectUri: string): Promise<string> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    let tokenResponse: any;
    try {
      tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        },
        { timeout: 10000 },
      );
    } catch (err: any) {
      console.error('Google token exchange failed:', err?.response?.data || err.message);
      throw new BadGatewayException('Google OAuth token exchange failed');
    }

    const { access_token, id_token } = tokenResponse.data;
    if (!access_token) {
      throw new BadGatewayException('Google OAuth token exchange failed');
    }

    if (id_token) {
      const claims = this.decodeJwtClaims(id_token);
      if (claims?.email && claims?.email_verified === true) {
        return String(claims.email).toLowerCase().trim();
      }
    }

    let userinfo: any;
    try {
      userinfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000,
      });
    } catch (err: any) {
      console.error('Google userinfo fetch failed:', err?.response?.data || err.message);
      throw new BadGatewayException('Could not retrieve Google profile');
    }

    const email = userinfo.data?.email;
    if (!email) {
      throw new BadGatewayException('Google profile did not return an email');
    }
    if (userinfo.data?.verified_email === false) {
      throw new UnauthorizedException('Google email is not verified');
    }
    return String(email).toLowerCase().trim();
  }

  private get stateSecret(): string {
    const secret =
      this.configService.get<string>('GOOGLE_OAUTH_STATE_SECRET') ||
      this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('OAuth state signing secret is not configured');
    }
    return secret;
  }

  private decodeJwtClaims(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    } catch {
      return null;
    }
  }
}