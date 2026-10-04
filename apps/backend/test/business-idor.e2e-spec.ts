import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 7 e2e: business IDOR + hash-leak regression.
 * - Non-owner GET/DELETE /business/:id → 403 (not 404, not 200).
 * - Serialized response bodies never contain a `password` key (asserted on
 *   the raw body string, not the Prisma type).
 * - Owner + ADMIN flows still work; deleted profiles 404 afterwards.
 * Requires the local test database (see test/jest-setup.ts).
 */
describe('Business IDOR + hash leak (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const ownerEmail = `phase7-owner-${stamp}@test.com`;
  const intruderEmail = `phase7-intruder-${stamp}@test.com`;
  const adminEmail = `phase7-admin-${stamp}@test.com`;
  const password = 'StrongP@ssw0rd!';
  let ownerToken: string;
  let intruderToken: string;
  let adminToken: string;
  let ownerBusinessId: string;

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
      .send({ email: ownerEmail, password, businessName: 'Phase7 E2E Biz' })
      .expect(201);
    ownerToken = owner.body.accessToken;
    ownerBusinessId = owner.body.user.businessId;

    const intruder = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: intruderEmail, password, role: 'CUSTOMER', firstName: 'In', lastName: 'Truder' })
      .expect(201);
    intruderToken = intruder.body.accessToken;

    // Admin via direct insert (no admin seed in test DB).
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { email: adminEmail, password: hash, role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(201);
    adminToken = adminLogin.body.accessToken;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated reads with 401', async () => {
    await request(app.getHttpServer()).get(`/business/${ownerBusinessId}`).expect(401);
  });

  it('intruder GET on another business → 403', async () => {
    await request(app.getHttpServer())
      .get(`/business/${ownerBusinessId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);
  });

  it('intruder DELETE on another business → 403 and profile survives', async () => {
    await request(app.getHttpServer())
      .delete(`/business/${ownerBusinessId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/business/${ownerBusinessId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('owner GET → 200 with no password key in the raw body', async () => {
    const res = await request(app.getHttpServer())
      .get(`/business/${ownerBusinessId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.text).not.toContain('"password"');
  });

  it('admin GET → 200 with no password key in the raw body', async () => {
    const res = await request(app.getHttpServer())
      .get(`/business/${ownerBusinessId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.text).not.toContain('"password"');
  });

  it('admin DELETE → 200; profile then 404s for the owner', async () => {
    await request(app.getHttpServer())
      .delete(`/business/${ownerBusinessId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/business/${ownerBusinessId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
