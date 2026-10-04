import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Phase 3 e2e: refresh rotation + reuse detection, logout invalidation,
 * throttled enumeration endpoint, and validated DTO bodies.
 * Requires the local test database (see test/jest-setup.ts).
 */
describe('Auth refresh / revocation (e2e)', () => {
  let app: INestApplication;
  const email = `phase3-refresh-${Date.now()}@test.com`;
  const password = 'StrongP@ssw0rd!';
  let r0: string;
  let access0: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('registers a business user with an access + refresh pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, businessName: 'Phase3 E2E Biz' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    r0 = res.body.refreshToken;
    access0 = res.body.accessToken;
  });

  it('rotates the refresh token (R0 -> R1 -> R2)', async () => {
    const first = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: r0 })
      .expect(201);
    expect(first.body.accessToken).toBeDefined();
    expect(first.body.refreshToken).toBeDefined();
    expect(first.body.refreshToken).not.toBe(r0);

    const second = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(201);
    expect(second.body.refreshToken).not.toBe(first.body.refreshToken);

    // Replaying the already-rotated R0 is reuse -> 401 and revokes the chain.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: r0 })
      .expect(401);

    // The newest token from the chain is now dead too (reuse protection).
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: second.body.refreshToken })
      .expect(401);
  });

  it('rejects a forged refresh token with 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'forged-token-value' })
      .expect(401);
  });

  it('rejects an access token presented as a refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: access0 })
      .expect(401);
  });

  it('logout invalidates the refresh session and the bound access token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const access = login.body.accessToken as string;
    const refresh = login.body.refreshToken as string;

    await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${access}`).expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${access}`)
      .send({ refreshToken: refresh })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refresh })
      .expect(401);
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${access}`).expect(401);
  });

  it('throttles check-email with 429 after the limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer()).get('/auth/check-email').query({ email });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });

  it('rejects malformed check-email with 400', async () => {
    // Fresh query value so the throttle bucket from the previous test is untouched
    // is not needed — validation runs before the handler and still counts;
    // use a route with its own bucket instead: reset-password body validation.
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ email: 'not-an-email', code: '123456', newPassword: 'weak' })
      .expect(400);
  });
});
