import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { encrypt } from '../src/console/crypto.util';

/**
 * End-to-end coverage for the centralized wallet system.
 * Verifies: auto-created wallet on registration, user-facing endpoints,
 * partner HMAC debit/credit flows, idempotency, and error mapping.
 */
function hmacBody(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('Centralized Wallet (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let userToken: string;
  let userId: string;

  const unique = Date.now();
  const PARTNER_SECRET = process.env.MCOM_MALL_SECRET || 'mcom_mall_dev_secret_change_in_prod';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const user = await prisma.user.create({
      data: {
        email: `wallet-${unique}@test.com`,
        password: await bcrypt.hash('TestPass123!', 10),
        role: 'CUSTOMER',
      },
    });
    userId = user.id;
    userToken = jwtService.sign(
      { sub: user.id, email: user.email, role: 'CUSTOMER' },
      { secret: process.env.JWT_SECRET },
    );

    // The test DB skips the default SsoClient seed (NODE_ENV=test), so ensure
    // the mcom-mall partner exists for HMAC verification. An encrypted
    // hmacSecret (tier-1 resolution) makes verification deterministic.
    const encKey = app.get(ConfigService).get<string>('CONSOLE_ENCRYPTION_KEY') || '';
    await prisma.ssoClient.upsert({
      where: { clientId: 'mcom-mall' },
      update: { isActive: true, hmacSecret: encrypt(PARTNER_SECRET, encKey) },
      create: {
        clientId: 'mcom-mall',
        clientSecret: await bcrypt.hash('test-secret', 10),
        name: 'MCOM Mall',
        redirectUris: [],
        scopes: ['profile'],
        apiKey: 'ak_test_mall',
        platformSlug: 'mall',
        isActive: true,
        hmacSecret: encrypt(PARTNER_SECRET, encKey),
      },
    });
    // A second platform used to verify partner data isolation on lookups.
    const PARTNER2_SECRET = 'mcom_loyalty_dev_secret_change_in_prod';
    await prisma.ssoClient.upsert({
      where: { clientId: 'mcom-loyalty' },
      update: { isActive: true, hmacSecret: encrypt(PARTNER2_SECRET, encKey) },
      create: {
        clientId: 'mcom-loyalty',
        clientSecret: await bcrypt.hash('test-secret', 10),
        name: 'MCOM Loyalty',
        redirectUris: [],
        scopes: ['profile'],
        apiKey: 'ak_test_loyalty',
        platformSlug: 'rewards',
        isActive: true,
        hmacSecret: encrypt(PARTNER2_SECRET, encKey),
      },
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  const partnerHeaders = (body: object, idempotencyKey?: string) => ({
    'Content-Type': 'application/json',
    'X-Mcom-Client-ID': 'mcom-mall',
    'X-Mcom-Signature': hmacBody(JSON.stringify(body), PARTNER_SECRET),
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
  });

  it('GET /wallet returns a zero-balance wallet (auto-created)', async () => {
    return request(app.getHttpServer())
      .get('/wallet')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.balance).toBe(0);
        expect(res.body.status).toBe('ACTIVE');
        expect(res.body.currency).toBe('MCOM');
      });
  });

  it('POST /wallet/partner/debit returns 401 without HMAC headers', async () => {
    return request(app.getHttpServer())
      .post('/wallet/partner/debit')
      .send({ userId, amount: 10, category: 'PURCHASE', description: 'x' })
      .expect(401);
  });

  it('POST /wallet/partner/credit credits the wallet with valid HMAC', async () => {
    const body = { userId, amount: 100, category: 'REWARD', description: 'E2E cashback', reference: `e2e-cb-${unique}` };
    return request(app.getHttpServer())
      .post('/wallet/partner/credit')
      .set(partnerHeaders(body, `e2e-credit-${unique}`))
      .send(body)
      .expect(201)
      .expect((res) => {
        expect(res.body.transactionId).toBeDefined();
        expect(res.body.type).toBe('CREDIT');
        expect(res.body.balanceAfter).toBe(100);
      });
  });

  it('POST /wallet/partner/debit debits the wallet with valid HMAC', async () => {
    const body = { userId, amount: 40, category: 'PURCHASE', description: 'E2E purchase', reference: `e2e-pur-${unique}` };
    return request(app.getHttpServer())
      .post('/wallet/partner/debit')
      .set(partnerHeaders(body, `e2e-debit-${unique}`))
      .send(body)
      .expect(201)
      .expect((res) => {
        expect(res.body.type).toBe('DEBIT');
        expect(res.body.balanceBefore).toBe(100);
        expect(res.body.balanceAfter).toBe(60);
      });
  });

  it('POST /wallet/partner/debit with same idempotency key returns the original result (no double debit)', async () => {
    const body = { userId, amount: 40, category: 'PURCHASE', description: 'E2E purchase', reference: `e2e-pur-${unique}` };
    const first = await request(app.getHttpServer())
      .post('/wallet/partner/debit')
      .set(partnerHeaders(body, `e2e-debit-${unique}`))
      .send(body)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/wallet/partner/debit')
      .set(partnerHeaders(body, `e2e-debit-${unique}`))
      .send(body)
      .expect(201);

    expect(second.body.transactionId).toBe(first.body.transactionId);
    expect(second.body.balanceAfter).toBe(first.body.balanceAfter);
  });

  it('POST /wallet/partner/debit returns 422 INSUFFICIENT_BALANCE when balance is too low', async () => {
    const body = { userId, amount: 9999, category: 'PURCHASE', description: 'Too big', reference: `e2e-big-${unique}` };
    return request(app.getHttpServer())
      .post('/wallet/partner/debit')
      .set(partnerHeaders(body, `e2e-big-${unique}`))
      .send(body)
      .expect(422)
      .expect((res) => {
        expect(res.body.error).toBe('INSUFFICIENT_BALANCE');
      });
  });

  it('GET /wallet/transactions lists history across platforms', async () => {
    return request(app.getHttpServer())
      .get('/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.total).toBe(2);
        expect(res.body.data.some((t: any) => t.type === 'CREDIT')).toBe(true);
        expect(res.body.data.some((t: any) => t.type === 'DEBIT')).toBe(true);
        expect(res.body.data.every((t: any) => t.platformName === 'MCOM Mall')).toBe(true);
      });
  });

  it('GET /wallet/transactions/:id returns transaction detail', async () => {
    const list = await request(app.getHttpServer())
      .get('/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const id = list.body.data[0].id;
    return request(app.getHttpServer())
      .get(`/wallet/transactions/${id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(id);
      });
  });

  it('GET /wallet/summary returns spending breakdown', async () => {
    return request(app.getHttpServer())
      .get('/wallet/summary?period=30d')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.totalSpent).toBe(40);
        expect(res.body.totalCredited).toBe(100);
        expect(res.body.netFlow).toBe(60);
      });
  });

  it('GET /partner/transaction/:id is scoped to the calling platform (200 for owner)', async () => {
    const list = await request(app.getHttpServer())
      .get('/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const mallTxn = list.body.data.find((t: any) => t.platformClientId === 'mcom-mall');
    expect(mallTxn).toBeDefined();

    return request(app.getHttpServer())
      .get(`/wallet/partner/transaction/${mallTxn.id}?by=id`)
      .set({
        'Content-Type': 'application/json',
        'X-Mcom-Client-ID': 'mcom-mall',
        'X-Mcom-Signature': hmacBody('', PARTNER_SECRET), // GET → HMAC over empty body
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(mallTxn.id);
        expect(res.body.platformClientId).toBe('mcom-mall');
      });
  });

  it('GET /partner/transaction/:id rejects lookups of another platform transaction (403)', async () => {
    const list = await request(app.getHttpServer())
      .get('/wallet/transactions')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const mallTxn = list.body.data.find((t: any) => t.platformClientId === 'mcom-mall');
    expect(mallTxn).toBeDefined();

    return request(app.getHttpServer())
      .get(`/wallet/partner/transaction/${mallTxn.id}?by=id`)
      .set({
        'Content-Type': 'application/json',
        'X-Mcom-Client-ID': 'mcom-loyalty',
        'X-Mcom-Signature': hmacBody('', 'mcom_loyalty_dev_secret_change_in_prod'),
      })
      .expect(403);
  });
});