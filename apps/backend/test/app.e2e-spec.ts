import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createHmac } from 'crypto';

/**
 * Helper: generate valid HMAC headers for a given service ID and secret.
 * Mirrors the signing logic that every MCOM platform service uses.
 */
function buildHmacHeaders(serviceId: string, secret: string, timestampOverride?: number) {
  const timestamp = (timestampOverride ?? Math.floor(Date.now() / 1000)).toString();
  const message = `${serviceId}:${timestamp}`;
  const signature = createHmac('sha256', secret).update(message).digest('hex');
  return {
    'X-Service-Id': serviceId,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
  };
}

describe('MCOM Backend (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Health / Readiness', () => {
    it('GET /auth/me should return 401 when not authenticated', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });

    it('POST /auth/login should return 401 with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' })
        .expect(401);
    });

    it('GET /auth/sso/userinfo should return 400 without bearer token', () => {
      return request(app.getHttpServer())
        .get('/auth/sso/userinfo')
        .expect(400);
    });
  });

  describe('Auth Flow', () => {
    const testUser = {
      email: `e2e-test-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'BUSINESS',
      businessName: 'E2E Test Business',
    };
    // Uses global accessToken variable

    it('POST /auth/register should register a new business user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user.email).toBe(testUser.email.toLowerCase());
          expect(res.body.user.role).toBe('BUSINESS');
          accessToken = res.body.accessToken;
        });
    });

    it('POST /auth/register should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('GET /auth/me should return profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(testUser.email.toLowerCase());
          expect(res.body.role).toBe('BUSINESS');
        });
    });

    it('POST /auth/send-otp should send OTP', () => {
      return request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({ email: testUser.email })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('POST /auth/sso/token/refresh should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/sso/token/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });
  });

  describe('Pricing Flow', () => {
    it('GET /pricing/plans should return membership plans', () => {
      return request(app.getHttpServer())
        .get('/pricing/plans')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(4);
          const planIds = res.body.map((p: any) => p.id);
          expect(planIds).toContain('Bronze');
          expect(planIds).toContain('Silver');
          expect(planIds).toContain('Gold');
          expect(planIds).toContain('Platinum');
        });
    });
  });

  describe('Business Flow', () => {
    it('GET /business should return business listings when authenticated', () => {
      return request(app.getHttpServer())
        .get('/business')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('GET /google/google-business should return mock results', () => {
      return request(app.getHttpServer())
        .get('/google/google-business?queryText=Coffee')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('POST /localmall/onboarding/check-location should return proximity info', () => {
      return request(app.getHttpServer())
        .post('/localmall/onboarding/check-location')
        .send({ postcode: 'NW1 0JH' })
        .expect(201);
    });
  });

  describe('Notification Flow', () => {
    it('GET /notifications should return 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/notifications')
        .expect(401);
    });
  });

  describe('Data Sharing Flow', () => {
    const SERVICE_ID = 'mcom-rewards';
    // This matches MCOM_REWARDS_SECRET in backend .env for tests
    const SERVICE_SECRET = 'mcom_rewards_dev_secret_change_in_prod';

    it('GET /data/user should return 401 with no headers', () => {
      return request(app.getHttpServer())
        .get('/data/user?email=test@test.com')
        .expect(401);
    });

    it('GET /data/user should return 401 with invalid signature', () => {
      const headers = buildHmacHeaders(SERVICE_ID, SERVICE_SECRET);
      headers['X-Signature'] = 'deadbeefdeadbeefdeadbeefdeadbeef';
      return request(app.getHttpServer())
        .get('/data/user?email=nonexistent@test.com')
        .set(headers)
        .expect(401);
    });

    it('GET /data/user should return 401 with expired timestamp', () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago, > 5-min window
      const headers = buildHmacHeaders(SERVICE_ID, SERVICE_SECRET, expiredTimestamp);
      return request(app.getHttpServer())
        .get('/data/user?email=nonexistent@test.com')
        .set(headers)
        .expect(401);
    });

    it('GET /data/user should return 401 with unknown service ID', () => {
      const headers = buildHmacHeaders('mcom-unknown', SERVICE_SECRET);
      return request(app.getHttpServer())
        .get('/data/user?email=nonexistent@test.com')
        .set(headers)
        .expect(401);
    });

    it('GET /data/user should return 404 for non-existent user with valid HMAC', () => {
      const headers = buildHmacHeaders(SERVICE_ID, SERVICE_SECRET);
      return request(app.getHttpServer())
        .get('/data/user?email=nonexistent-e2e@test.com')
        .set(headers)
        .expect(404);
    });
  });

  describe('Security & Onboarding Flow Extensions', () => {
    it('POST /upload should reject non-image file extensions to prevent path traversals / arbitrary writes', () => {
      return request(app.getHttpServer())
        .post('/upload')
        .attach('file', Buffer.from('malicious code'), 'exploit.exe')
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Only image files are allowed');
        });
    });

    it('POST /upload should accept valid image files and return secure_url', () => {
      return request(app.getHttpServer())
        .post('/upload')
        .attach('file', Buffer.from('dummy image data'), 'logo.png')
        .expect(201)
        .expect((res) => {
          expect(res.body.secure_url).toBeDefined();
          expect(res.body.secure_url).toContain('/uploads/');
        });
    });

    it('GET /business/google/callback should render failure script if placeId has script injection', () => {
      const stateObj = { placeId: 'mock-place-001<script>alert(1)</script>', returnUrl: 'http://localhost:3000' };
      const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
      return request(app.getHttpServer())
        .get(`/business/google/callback?code=mock-code&state=${state}`)
        .expect(200)
        .expect((res) => {
          expect(res.text).toContain('GOOGLE_CLAIM_RESULT');
          expect(res.text).toContain('success: false');
        });
    });
  });
});
