import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { sign } from 'jsonwebtoken';
import { CouponDiscountType, PlanTier } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServiceKeyService } from '../src/service-identity/keys/service-key.service';

// Keep e2e deterministic: events are covered by a unit spec, and we do not
// want Bull/webhook delivery in the HTTP contract test.
process.env.CENTRAL_PARTNER_EVENTS_ENABLED = 'false';

describe('Partner API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let keys: ServiceKeyService;

  const unique = Date.now();
  const recipientEmail = `partner-recipient-${unique}@test.com`;
  const consumerEmail = `partner-consumer-${unique}@test.com`;
  let userId: string;
  let businessId: string;
  let planId: string;
  let accessPlanId: string;

  function token(overrides: Record<string, unknown> = {}, options: { audience?: string } = {}) {
    return sign(
      {
        iss: keys.getIssuer(),
        aud: options.audience ?? 'mcom-central',
        sub: 'mcom-rewards',
        scope: 'central:read central:issue',
        typ: 'service',
        ...overrides,
      },
      keys.getPrivateKey(),
      { algorithm: 'RS256', keyid: keys.getKid(), expiresIn: 300 },
    );
  }

  function authed(method: 'get' | 'post', path: string, bearer = token()) {
    return (request(app.getHttpServer()) as any)[method](path).set(
      'Authorization',
      `Bearer ${bearer}`,
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    keys = app.get(ServiceKeyService);

    // Registry: caller + callee rows (migration also seeds mcom-central).
    await prisma.ssoClient.upsert({
      where: { clientId: 'mcom-rewards' },
      create: {
        clientId: 'mcom-rewards',
        clientSecret: 'not-a-real-secret',
        name: 'MCOM Rewards',
        redirectUris: [],
        scopes: [],
        isActive: true,
        serviceEnabled: true,
        serviceScopes: ['central:read', 'central:issue', 'rewards:read', 'rewards:issue'],
        allowedAudiences: ['mcom-central'],
        allowedCallers: [],
      },
      update: {
        isActive: true,
        serviceEnabled: true,
        serviceScopes: ['central:read', 'central:issue', 'rewards:read', 'rewards:issue'],
        allowedAudiences: ['mcom-central'],
      },
    });
    await prisma.ssoClient.upsert({
      where: { clientId: 'mcom-central' },
      create: {
        clientId: 'mcom-central',
        clientSecret: 'not-a-real-secret',
        name: 'MCOM Central',
        redirectUris: [],
        scopes: [],
        isActive: true,
        platformSlug: 'mcom-central',
        isSystemApp: true,
        serviceEnabled: true,
        serviceBaseUrl: 'https://auth.mcomsolutions.com',
        serviceScopes: ['central:read', 'central:issue'],
        allowedAudiences: [],
        allowedCallers: ['mcom-rewards'],
      },
      update: {
        isActive: true,
        serviceEnabled: true,
        serviceScopes: ['central:read', 'central:issue'],
        allowedCallers: ['mcom-rewards'],
      },
    });

    const user = await prisma.user.create({
      data: {
        email: recipientEmail,
        password: 'not-used-in-this-test',
        role: 'BUSINESS',
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });
    userId = user.id;
    const business = await prisma.businessProfile.create({
      data: {
        userId,
        businessName: `Acme Partner ${unique}`,
        businessType: 'Retail',
        country: 'GB',
        phone: '+447000000000',
        email: recipientEmail,
      },
    });
    businessId = business.id;

    await prisma.user.create({
      data: {
        email: consumerEmail,
        password: 'not-used-in-this-test',
        role: 'CUSTOMER',
        firstName: 'Consumer',
        lastName: 'Only',
      },
    });

    const plan = await prisma.membershipPlan.create({
      data: {
        name: `Partner Gold ${unique}`,
        description: 'Partner test plan',
        price: 400,
        billingCycle: 'monthly',
        platformAccess: [],
        usageLimits: {},
        permissions: [],
        features: ['Partner feature'],
      },
    });
    planId = plan.id;
    await prisma.membershipPlanTier.create({
      data: {
        planId,
        tier: PlanTier.Pro,
        durationDays: 180,
        fullPrice: 1000,
      },
    });

    const accessPlan = await prisma.accessPlan.create({
      data: {
        name: `Partner Access ${unique}`,
        description: 'Partner access plan',
        price: 50,
        durationDays: 365,
        platformAccess: [],
        features: ['Access feature'],
      },
    });
    accessPlanId = accessPlan.id;
  }, 40000);

  afterAll(async () => {
    if (prisma) {
      await prisma.partnerAuditLog.deleteMany({ where: { callerClientId: 'mcom-rewards' } });
      await prisma.partnerGrant.deleteMany({ where: { sourceApp: 'mcom-rewards' } });
      await prisma.coupon.deleteMany({ where: { sourceApp: 'mcom-rewards' } });
      await prisma.accessPassCode.deleteMany({ where: { sourceApp: 'mcom-rewards' } });
      await prisma.billingTransaction.deleteMany({ where: { provider: 'mcom-rewards' } });
      await prisma.ecosystemSubscription.deleteMany({ where: { businessId } });
      await prisma.platformPackage.deleteMany({ where: { businessId } });
      await prisma.membershipPlanTier.deleteMany({ where: { planId } });
      await prisma.membershipPlan.deleteMany({ where: { id: planId } });
      await prisma.accessPlan.deleteMany({ where: { id: accessPlanId } });
      await prisma.businessProfile.deleteMany({ where: { id: businessId } });
      await prisma.user.deleteMany({ where: { email: { in: [recipientEmail, consumerEmail] } } });
    }
    await app.close();
  });

  describe('inbound auth', () => {
    it('rejects a missing token (401)', async () => {
      await request(app.getHttpServer()).get('/partner/catalog/memberships').expect(401);
    });

    it('rejects the wrong audience (401)', async () => {
      await authed('get', '/partner/catalog/memberships', token({}, { audience: 'mcom-mall' })).expect(401);
    });

    it('accepts a valid token (200)', async () => {
      const res = await authed('get', '/partner/catalog/memberships').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('registry', () => {
    it('exposes mcom-central as a callable peer', async () => {
      const res = await request(app.getHttpServer())
        .get('/ecosystem/services/mcom-central')
        .expect(200);
      expect(res.body.clientId).toBe('mcom-central');
      expect(res.body.scopes).toEqual(expect.arrayContaining(['central:read', 'central:issue']));
      expect(res.body.allowedCallers).toContain('mcom-rewards');
    });
  });

  describe('catalogue + recipient resolution', () => {
    it('returns the active membership plan', async () => {
      const res = await authed('get', '/partner/catalog/memberships').expect(200);
      const plan = res.body.find((p: any) => p.id === planId);
      expect(plan).toBeDefined();
      expect(plan.tiers[0]).toMatchObject({ tier: 'Pro', durationDays: 180 });
    });

    it('returns the active access plan', async () => {
      const res = await authed('get', '/partner/catalog/access-plans').expect(200);
      expect(res.body.find((p: any) => p.id === accessPlanId)).toBeDefined();
    });

    it('resolves by email', async () => {
      const res = await authed('get', `/partner/users/resolve?email=${encodeURIComponent(recipientEmail)}`).expect(200);
      expect(res.body).toMatchObject({
        mcomUserId: userId,
        email: recipientEmail,
        businessId,
        businessName: expect.stringContaining('Acme Partner'),
      });
      expect(res.body).not.toHaveProperty('password');
    });

    it('resolves by mcomUserId', async () => {
      const res = await authed('get', `/partner/users/resolve?mcomUserId=${userId}`).expect(200);
      expect(res.body.mcomUserId).toBe(userId);
    });

    it('rejects a missing identifier (400) and unknown recipient (404)', async () => {
      await authed('get', '/partner/users/resolve').expect(400);
      await authed('get', '/partner/users/resolve?email=nobody@example.com').expect(404);
    });
  });

  describe('membership grants', () => {
    const issuanceId = `e2e-iss-${unique}`;

    it('grants a membership, then replays idempotently', async () => {
      const payload = {
        issuanceId,
        recipientMcomUserId: userId,
        planId,
        tier: 'Pro',
        durationDays: 365,
        extendExisting: true,
      };

      const first = await authed('post', '/partner/grants/membership').send(payload).expect(200);
      expect(first.body).toMatchObject({
        success: true,
        businessId,
        planId,
        tier: 'Pro',
        replayed: false,
      });

      const second = await authed('post', '/partner/grants/membership').send(payload).expect(200);
      expect(second.body.replayed).toBe(true);
      expect(second.body.grantId).toBe(first.body.grantId);

      const billing = await prisma.billingTransaction.findMany({
        where: { providerPaymentId: `rewards:${issuanceId}` },
      });
      expect(billing).toHaveLength(1);
      expect(billing[0]).toMatchObject({ provider: 'mcom-rewards', amount: 0 });

      const grants = await prisma.partnerGrant.findMany({ where: { issuanceId } });
      expect(grants).toHaveLength(1);

      const profile = await prisma.businessProfile.findUnique({ where: { id: businessId } });
      expect(profile?.membershipStatus).toBe('active');
    });

    it('rejects a consumer recipient (422 RECIPIENT_NOT_A_BUSINESS)', async () => {
      const consumer = await prisma.user.findUnique({ where: { email: consumerEmail } });
      const res = await authed('post', '/partner/grants/membership')
        .send({
          issuanceId: `e2e-consumer-${unique}`,
          recipientMcomUserId: consumer!.id,
          planId,
          tier: 'Pro',
        })
        .expect(422);
      expect(res.body.code).toBe('RECIPIENT_NOT_A_BUSINESS');
    });

    it('rejects an unavailable plan (422 PLAN_NOT_AVAILABLE)', async () => {
      const res = await authed('post', '/partner/grants/membership')
        .send({
          issuanceId: `e2e-bad-plan-${unique}`,
          recipientMcomUserId: userId,
          planId: 'missing-plan',
          tier: 'Pro',
        })
        .expect(422);
      expect(res.body.code).toBe('PLAN_NOT_AVAILABLE');
    });

    it('serialises two concurrent grants for the same issuance into one grant', async () => {
      const concurrentIssuance = `e2e-concurrent-${unique}`;
      const payload = {
        issuanceId: concurrentIssuance,
        recipientMcomUserId: userId,
        planId,
        tier: 'Pro',
        durationDays: 30,
        extendExisting: true,
      };

      const [a, b] = await Promise.all([
        authed('post', '/partner/grants/membership').send(payload),
        authed('post', '/partner/grants/membership').send(payload),
      ]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.grantId).toBe(b.body.grantId);

      const billing = await prisma.billingTransaction.findMany({
        where: { providerPaymentId: `rewards:${concurrentIssuance}` },
      });
      expect(billing).toHaveLength(1);
      const grants = await prisma.partnerGrant.findMany({
        where: { issuanceId: concurrentIssuance },
      });
      expect(grants).toHaveLength(1);
    });
  });

  describe('access-pass codes', () => {
    const issuanceId = `e2e-code-${unique}`;

    it('issues a code, then replays idempotently', async () => {
      const payload = {
        issuanceId,
        accessPlanId,
        recipientEmail,
        mode: 'GIFT',
        sendEmail: false,
      };
      const first = await authed('post', '/partner/access-pass-codes').send(payload).expect(200);
      expect(first.body).toMatchObject({ success: true, status: 'UNUSED', replayed: false });

      const second = await authed('post', '/partner/access-pass-codes').send(payload).expect(200);
      expect(second.body.code).toBe(first.body.code);
      expect(second.body.replayed).toBe(true);

      const codes = await prisma.accessPassCode.findMany({ where: { externalRef: issuanceId } });
      expect(codes).toHaveLength(1);
      expect(codes[0]).toMatchObject({ sourceApp: 'mcom-rewards', purchaserBusinessId: null });
      expect(codes[0].emailSentAt).toBeNull();
    });
  });

  describe('partner coupons', () => {
    const issuanceId = `e2e-coupon-${unique}`;
    const code = `MCOM-REWARD-${unique}`.slice(0, 40);

    it('creates, replays, inspects and revokes', async () => {
      const payload = {
        issuanceId,
        code,
        description: 'Rewards reward coupon',
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 20,
        appliesToAllMemberships: true,
        appliesToAllAccess: true,
        maxUses: 1,
        maxUsesPerUser: 1,
        validFrom: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        lockedToUserId: userId,
        isActive: true,
      };

      const first = await authed('post', '/partner/coupons').send(payload).expect(200);
      expect(first.body).toMatchObject({ success: true, replayed: false, code });

      const second = await authed('post', '/partner/coupons').send(payload).expect(200);
      expect(second.body.replayed).toBe(true);
      expect(second.body.id).toBe(first.body.id);

      const inspected = await authed('get', `/partner/coupons/${code}`).expect(200);
      expect(inspected.body).toMatchObject({
        code,
        lockedToUserId: userId,
        remainingUses: 1,
        externalRef: issuanceId,
      });

      const revoked = await authed('post', `/partner/coupons/${code}/revoke`).expect(200);
      expect(revoked.body).toMatchObject({ success: true, status: 'revoked' });

      const stored = await prisma.coupon.findUnique({ where: { code } });
      expect(stored?.isActive).toBe(false);
      expect(stored?.sourceApp).toBe('mcom-rewards');
    });
  });
});
