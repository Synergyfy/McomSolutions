import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

function hmacBody(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('Mcom Console (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let businessToken: string;

  const unique = Date.now();
  const clientId = `e2e-console-${unique}`;
  const hmacClientId = `e2e-hmac-${unique}`;
  let hmacSecret: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const admin = await prisma.user.create({
      data: {
        email: `admin-${unique}@test.com`,
        password: await bcrypt.hash('TestPass123!', 10),
        role: 'ADMIN',
      },
    });
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: 'ADMIN' },
      { secret: process.env.JWT_SECRET },
    );

    const biz = await prisma.user.create({
      data: {
        email: `biz-${unique}@test.com`,
        password: await bcrypt.hash('TestPass123!', 10),
        role: 'BUSINESS',
      },
    });
    businessToken = jwtService.sign(
      { sub: biz.id, email: biz.email, role: 'BUSINESS' },
      { secret: process.env.JWT_SECRET },
    );
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { contains: `-${unique}@test.com` } } });
      await prisma.ssoClient.deleteMany({
        where: { clientId: { in: [clientId, hmacClientId, 'e2e-system-app'] } },
      });
    }
    await app.close();
  });

  describe('Console CRUD', () => {
    it('registers an app and returns one-time credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/console/apps')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Console App',
          clientId,
          platformSlug: 'e2econsole',
          redirectUris: ['https://app.mcom.com/auth/callback'],
          corsOrigins: ['https://app.mcom.com'],
          scopes: ['profile', 'email', 'business'],
          billingApiUrl: 'https://api.mcom.com',
        })
        .expect(201);

      expect(res.body.plainSecrets.clientSecret).toMatch(/^cs_/);
      expect(res.body.plainSecrets.apiKey).toMatch(/^ak_/);
      expect(res.body.plainSecrets.hmacSecret).toMatch(/^hm_/);
      expect(res.body.plainSecrets.webhookSecret).toMatch(/^wh_/);
      expect(res.body.client.clientId).toBe(clientId);
      expect(res.body.client.clientSecret).toContain('•');
    });

    it('rejects non-admin users with 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/console/apps')
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(403);
    });

    it('rejects unauthenticated requests with 401', async () => {
      await request(app.getHttpServer())
        .get('/admin/console/apps')
        .expect(401);
    });

    it('lists registered apps', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/console/apps')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const found = res.body.find((a: any) => a.clientId === clientId);
      expect(found).toBeDefined();
      expect(found.isActive).toBe(true);
    });

    it('returns masked secrets on detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/console/apps/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.clientSecret).toContain('•');
      expect(res.body.apiKey).toContain('ak_****');
    });

    it('returns 404 for unknown app', async () => {
      await request(app.getHttpServer())
        .get('/admin/console/apps/nonexistent-app')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('updates app config via PATCH', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/console/apps/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description' })
        .expect(200);
      expect(res.body.description).toBe('Updated description');
    });

    it('rotates the client secret', async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/console/apps/${clientId}/rotate-secret`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'e2e rotation' })
        .expect(201);
      expect(res.body.clientSecret).toMatch(/^cs_/);
    });

    it('blocks deactivation of system apps', async () => {
      await prisma.ssoClient.create({
        data: {
          clientId: 'e2e-system-app',
          name: 'E2E System App',
          clientSecret: await bcrypt.hash('x', 10),
          redirectUris: [],
          scopes: [],
          apiKey: 'ak_e2e_system',
          isSystemApp: true,
        },
      });
      await request(app.getHttpServer())
        .delete('/admin/console/apps/e2e-system-app')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('deactivates a non-system app', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/admin/console/apps/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);

      const detail = await request(app.getHttpServer())
        .get(`/admin/console/apps/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body.isActive).toBe(false);
    });

    it('returns paginated audit logs', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/console/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('HMAC new scheme (X-Mcom-Client-ID)', () => {
    it('registers an app with an HMAC secret', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/console/apps')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E HMAC App',
          clientId: hmacClientId,
          platformSlug: 'e2ehmac',
          redirectUris: ['https://hmac.mcom.com/auth/callback'],
          corsOrigins: ['https://hmac.mcom.com'],
          scopes: ['profile', 'email'],
        })
        .expect(201);
      hmacSecret = res.body.plainSecrets.hmacSecret;
      expect(hmacSecret).toMatch(/^hm_/);
    });

    it('accepts a valid per-client DB HMAC (Tier 1)', async () => {
      const body = JSON.stringify({ emailsOrIds: [`missing-${unique}@test.com`] });
      await request(app.getHttpServer())
        .post('/data/user/bulk')
        .set('X-Mcom-Client-ID', hmacClientId)
        .set('X-Mcom-Signature', hmacBody(body, hmacSecret))
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(201);
    });

    it('rejects an invalid signature with 401', async () => {
      const body = JSON.stringify({ emailsOrIds: [`missing-${unique}@test.com`] });
      await request(app.getHttpServer())
        .post('/data/user/bulk')
        .set('X-Mcom-Client-ID', hmacClientId)
        .set('X-Mcom-Signature', hmacBody(body, 'wrong-secret'))
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(401);
    });

    it('falls back to the global SSO_API_SECRET when client has no secret (Tier 3)', async () => {
      const body = JSON.stringify({ emailsOrIds: [`missing-${unique}@test.com`] });
      await request(app.getHttpServer())
        .post('/data/user/bulk')
        .set('X-Mcom-Client-ID', `e2e-legacy-${unique}`)
        .set('X-Mcom-Signature', hmacBody(body, process.env.SSO_API_SECRET as string))
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(201);
    });
  });
});