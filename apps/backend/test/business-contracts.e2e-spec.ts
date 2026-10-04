import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 4 e2e: route-shadowing fix, FK-scoped tickets, userId notification
 * scoping, header-only integration key, and validated contract DTOs.
 * Requires the local test database (see test/jest-setup.ts).
 */
describe('Business contracts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const ownerEmail = `phase4-owner-${stamp}@test.com`;
  const customerEmail = `phase4-cust-${stamp}@test.com`;
  const intruderEmail = `phase4-intruder-${stamp}@test.com`;
  const password = 'StrongP@ssw0rd!';
  let ownerToken: string;
  let ownerBusinessId: string;
  let ownerUserId: string;
  let customerToken: string;
  let customerUserId: string;
  let intruderToken: string;
  let businessApiKey: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ownerEmail, password, businessName: 'Phase4 E2E Biz' })
      .expect(201);
    ownerToken = owner.body.accessToken;
    ownerBusinessId = owner.body.user.businessId;
    ownerUserId = owner.body.user.id;

    const customer = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: customerEmail, password, role: 'CUSTOMER', firstName: 'Phase', lastName: 'Four' })
      .expect(201);
    customerToken = customer.body.accessToken;
    customerUserId = customer.body.user.id;

    const intruder = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: intruderEmail, password, role: 'CUSTOMER', firstName: 'In', lastName: 'Truder' })
      .expect(201);
    intruderToken = intruder.body.accessToken;

    const profile = await prisma.businessProfile.findUnique({
      where: { id: ownerBusinessId },
      select: { apiKey: true },
    });
    businessApiKey = profile!.apiKey!;
    if (!businessApiKey) {
      // Registered profiles start without an API key — issue one like a real integrator would.
      const issued = await request(app.getHttpServer())
        .post('/business/api-key')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);
      businessApiKey = issued.body.apiKey;
    }
    expect(businessApiKey).toBeDefined();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  // ─── 4A: route shadowing ──────────────────────────
  describe('support-ticket routes', () => {
    it('GET /business/support-tickets returns 200 (not swallowed by :id)', async () => {
      await request(app.getHttpServer())
        .get('/business/support-tickets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('POST then GET round-trips a ticket scoped by businessId FK', async () => {
      const created = await request(app.getHttpServer())
        .post('/business/support-tickets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ subject: 'Phase4 probe', message: 'Route order works', priority: 'High' })
        .expect(201);
      expect(created.body.businessId).toBe(ownerBusinessId);

      const listed = await request(app.getHttpServer())
        .get('/business/support-tickets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(listed.body.map((t: any) => t.id)).toContain(created.body.id);
    });

    it('GET /business/:id still resolves real IDs', async () => {
      await request(app.getHttpServer())
        .get(`/business/${ownerBusinessId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('customers without a business profile get 404 on ticket routes', async () => {
      await request(app.getHttpServer())
        .get('/business/support-tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(404);
    });

    it('rejects invalid ticket bodies with 400', async () => {
      await request(app.getHttpServer())
        .post('/business/support-tickets')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ subject: '', message: 'x'.repeat(6000), priority: 'Urgent' })
        .expect(400);
    });
  });

  // ─── 4C: notification scoping ─────────────────────
  describe('notification scoping', () => {
    let businessRowId: string;
    let customerRowId: string;
    let broadcastRowId: string;

    beforeAll(async () => {
      const businessRow = await prisma.notification.create({
        data: { businessId: ownerBusinessId, type: 'membership', title: 'Biz', message: 'biz msg' },
      });
      businessRowId = businessRow.id;
      const customerRow = await prisma.notification.create({
        data: { userId: customerUserId, type: 'update', title: 'Cust', message: 'cust msg' },
      });
      customerRowId = customerRow.id;
      const broadcast = await prisma.notification.create({
        data: { type: 'announcement', title: 'All', message: 'broadcast msg' },
      });
      broadcastRowId = broadcast.id;
    });

    it('owner sees business rows + broadcasts, not the customer’s user rows', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      const ids = res.body.map((n: any) => n.id);
      expect(ids).toEqual(expect.arrayContaining([businessRowId, broadcastRowId]));
      expect(ids).not.toContain(customerRowId);
    });

    it('customer sees own user rows + broadcasts, not business rows', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const ids = res.body.map((n: any) => n.id);
      expect(ids).toEqual(expect.arrayContaining([customerRowId, broadcastRowId]));
      expect(ids).not.toContain(businessRowId);
    });

    it('intruder cannot delete another user’s notification', async () => {
      await request(app.getHttpServer())
        .delete(`/notifications/${customerRowId}`)
        .set('Authorization', `Bearer ${intruderToken}`)
        .expect(404);
      const stillThere = await prisma.notification.findUnique({ where: { id: customerRowId } });
      expect(stillThere).not.toBeNull();
    });
  });

  // ─── 4D: header-only integration key ──────────────
  describe('integration API key', () => {
    it('accepts the x-api-key header', async () => {
      const res = await request(app.getHttpServer())
        .get('/integration/business')
        .set('x-api-key', businessApiKey)
        .expect(200);
      expect(res.body.businessId).toBe(ownerBusinessId);
    });

    it('rejects the removed ?apiKey query param with 401', async () => {
      await request(app.getHttpServer()).get(`/integration/business?apiKey=${businessApiKey}`).expect(401);
    });

    it('rejects missing and wrong keys with the same 401', async () => {
      await request(app.getHttpServer()).get('/integration/business').expect(401);
      await request(app.getHttpServer())
        .get('/integration/business')
        .set('x-api-key', 'wrong-key')
        .expect(401);
    });
  });

  // ─── 4E: validated contract DTOs ──────────────────
  describe('contract DTO validation', () => {
    it('rejects invalid billing cycles on payment initiate', async () => {
      await request(app.getHttpServer())
        .post('/payment/stripe/initiate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ level: 'Silver', tier: 'Normal', billing: 'weekly' })
        .expect(400);
    });

    it('rejects non-URL return URLs on PayPal initiate', async () => {
      await request(app.getHttpServer())
        .post('/payment/paypal/initiate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ level: 'Silver', tier: 'Normal', billing: 'monthly', returnUrl: 'not-a-url', cancelUrl: 'also-bad' })
        .expect(400);
    });

    it('rejects missing placeId on claim/start', async () => {
      await request(app.getHttpServer()).post('/claim/start').send({}).expect(400);
    });

    it('coerces page/limit numbers and rejects garbage', async () => {
      await request(app.getHttpServer())
        .get('/business?page=abc&limit=5')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
      await request(app.getHttpServer())
        .get('/business?page=1&limit=5')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });
});
