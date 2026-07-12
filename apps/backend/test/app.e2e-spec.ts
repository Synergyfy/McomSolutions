import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('MCOM Backend (e2e)', () => {
  let app: INestApplication;

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
    let accessToken: string;

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
    it('GET /businesses should return business listings', () => {
      return request(app.getHttpServer())
        .get('/businesses')
        .expect(200);
    });

    it('GET /businesses/google-search should return mock results', () => {
      return request(app.getHttpServer())
        .get('/businesses/google-search?query=Coffee')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('GET /businesses/proximity should return proximity info', () => {
      return request(app.getHttpServer())
        .get('/businesses/proximity?postcode=NW1%200JH')
        .expect(200);
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
    it('POST /data-sharing/user-context should return 401 without API key', () => {
      return request(app.getHttpServer())
        .post('/data-sharing/user-context')
        .send({ email: 'test@test.com' })
        .expect(401);
    });
  });
});
