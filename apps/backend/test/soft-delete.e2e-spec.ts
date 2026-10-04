import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 5 e2e: admin deletes soft-delete (rows + audit trail preserved),
 * trashed users are locked out everywhere, and emails stay reserved (409).
 * Requires the local test database (see test/jest-setup.ts).
 */
describe('Soft deletes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const victimEmail = `phase5-victim-${stamp}@test.com`;
  const adminEmail = `phase5-admin-${stamp}@test.com`;
  const password = 'StrongP@ssw0rd!';
  let adminToken: string;
  let victimProfileId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // Victim customer via public registration.
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: victimEmail, password, role: 'CUSTOMER', firstName: 'Vic', lastName: 'Tim' })
      .expect(201);

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

    const list = await request(app.getHttpServer())
      .get('/admin/users/customers?search=' + encodeURIComponent(victimEmail))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    victimProfileId = list.body.data.find((u: any) => u.email === victimEmail).id;
    expect(victimProfileId).toBeDefined();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('admin delete soft-deletes the customer (204, rows preserved)', async () => {
    await request(app.getHttpServer())
      .delete(`/admin/users/customers/${victimProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // Rows preserved with deletedAt stamped (audit trail intact).
    const user = await prisma.user.findFirst({
      where: { email: victimEmail, deletedAt: { not: null } },
    });
    expect(user).not.toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'Customer Deleted', targetName: victimProfileId },
    });
    expect(audit).not.toBeNull();
  });

  it('second delete returns 404 (already trashed, not a crash)', async () => {
    await request(app.getHttpServer())
      .delete(`/admin/users/customers/${victimProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('trashed user cannot log in and disappears from admin lists', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: victimEmail, password })
      .expect(401);

    const list = await request(app.getHttpServer())
      .get('/admin/users/customers?search=' + encodeURIComponent(victimEmail))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.data.find((u: any) => u.email === victimEmail)).toBeUndefined();
  });

  it('trashed email stays reserved (409, not 500)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: victimEmail, password, role: 'CUSTOMER', firstName: 'Re', lastName: 'Try' })
      .expect(409);
  });
});
