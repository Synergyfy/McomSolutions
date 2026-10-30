import { HttpException } from '@nestjs/common';
import { PartnerGrantKind, PartnerGrantStatus, PlanTier } from '@prisma/client';
import { PartnerGrantService } from './partner-grant.service';

describe('PartnerGrantService', () => {
  let service: PartnerGrantService;
  let prisma: any;
  let recipients: any;
  let pricing: any;
  let access: any;
  let events: any;
  let audit: any;

  const caller: any = {
    callerAppId: 'mcom-rewards',
    scopes: ['central:issue'],
    isDelegated: false,
    claims: {},
  };

  const business = {
    id: 'biz_1',
    businessName: 'Acme Ltd',
    membershipLevel: 'Bronze',
    membershipTier: 'Normal',
    membershipStatus: 'inactive',
    membershipExpiresAt: null,
    membershipPlanName: null,
    membershipRecurringId: null,
  };

  const proPlan = {
    id: 'plan_gold',
    name: 'Gold',
    price: 400,
    tiers: [
      {
        id: 'tier_pro',
        tier: PlanTier.Pro,
        durationDays: 180,
        fullPrice: 1000,
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      partnerGrant: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'grant_1',
          ...data,
          createdAt: new Date('2026-10-29T00:00:00.000Z'),
          updatedAt: new Date('2026-10-29T00:00:00.000Z'),
        })),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      membershipPlan: { findFirst: jest.fn().mockResolvedValue(proPlan) },
      businessProfile: { findFirst: jest.fn().mockResolvedValue(business), update: jest.fn() },
      billingTransaction: { findUnique: jest.fn() },
      membershipInstallmentSubscription: { findFirst: jest.fn().mockResolvedValue(null) },
      accessPassCode: { count: jest.fn(), findMany: jest.fn() },
      partnerAuditLog: { create: jest.fn() },
    };
    recipients = {
      resolveBusiness: jest.fn().mockResolvedValue({
        user: { id: 'user_1', email: 'jane@example.com' },
        business,
      }),
    };
    pricing = {
      subscribeMembership: jest.fn().mockResolvedValue({
        startsAt: new Date('2026-10-29T00:00:00.000Z'),
        expiresAt: new Date('2027-10-29T00:00:00.000Z'),
      }),
    };
    access = { issuePartnerAccessCode: jest.fn(), revokePartnerAccessCode: jest.fn() };
    events = {
      emitMembershipGranted: jest.fn(),
      emitAccessCodeCreated: jest.fn(),
      emitGrantRevoked: jest.fn(),
    };
    audit = { record: jest.fn() };

    service = new PartnerGrantService(prisma, recipients, pricing, access, events, audit);
  });

  const baseDto = {
    issuanceId: 'iss_1',
    recipientMcomUserId: 'user_1',
    planId: 'plan_gold',
    tier: 'Pro',
    durationDays: 365,
    extendExisting: true,
  };

  it('rejects a consumer recipient with 422 RECIPIENT_NOT_A_BUSINESS', async () => {
    recipients.resolveBusiness.mockRejectedValue(
      new HttpException(
        { code: 'RECIPIENT_NOT_A_BUSINESS', message: 'no business' },
        422,
      ),
    );
    await expect(service.grantMembership(baseDto, caller)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECIPIENT_NOT_A_BUSINESS' }),
    });
  });

  it('rejects a missing/archived plan with 422 PLAN_NOT_AVAILABLE', async () => {
    prisma.membershipPlan.findFirst.mockResolvedValue(null);
    await expect(service.grantMembership(baseDto, caller)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLAN_NOT_AVAILABLE' }),
    });
  });

  it('rejects an unavailable tier with 422 TIER_NOT_AVAILABLE', async () => {
    await expect(
      service.grantMembership({ ...baseDto, tier: 'Pro+' }, caller),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TIER_NOT_AVAILABLE' }),
    });
  });

  it('rejects a non-positive duration with 422 INVALID_DURATION', async () => {
    await expect(
      service.grantMembership({ ...baseDto, durationDays: 0 }, caller),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_DURATION' }),
    });
  });

  it('grants and writes a zero-amount, rewards-provider ledger row', async () => {
    const result = await service.grantMembership(baseDto, caller);

    expect(result).toMatchObject({
      success: true,
      grantId: 'grant_1',
      businessId: 'biz_1',
      planId: 'plan_gold',
      tier: 'Pro',
      replayed: false,
    });
    expect(pricing.subscribeMembership).toHaveBeenCalledWith(
      'biz_1',
      'plan_gold',
      'Pro',
      'monthly',
      expect.objectContaining({
        provider: 'mcom-rewards',
        providerPaymentId: 'rewards:iss_1',
        chargedAmount: 0,
        allowZeroAmount: true,
        durationDays: 365,
      }),
    );
    expect(prisma.partnerGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issuanceId: 'iss_1',
          sourceApp: 'mcom-rewards',
          kind: PartnerGrantKind.MEMBERSHIP,
          status: PartnerGrantStatus.GRANTED,
          providerPaymentId: 'rewards:iss_1',
        }),
      }),
    );
    expect(events.emitMembershipGranted).toHaveBeenCalledWith(
      expect.objectContaining({ issuanceId: 'iss_1' }),
    );
  });

  it('replays an existing grant without re-activating', async () => {
    prisma.partnerGrant.findUnique.mockResolvedValue({
      id: 'grant_1',
      issuanceId: 'iss_1',
      businessId: 'biz_1',
      planId: 'plan_gold',
      tier: 'Pro',
      status: PartnerGrantStatus.GRANTED,
      expiresAt: new Date('2027-10-29T00:00:00.000Z'),
      createdAt: new Date('2026-10-29T00:00:00.000Z'),
      metadata: { planName: 'Gold', startsAt: '2026-10-29T00:00:00.000Z' },
    });

    const result = await service.grantMembership(baseDto, caller);
    expect(result.replayed).toBe(true);
    expect(pricing.subscribeMembership).not.toHaveBeenCalled();
    expect(prisma.partnerGrant.create).not.toHaveBeenCalled();
  });

  it('defaults duration to the tier duration', async () => {
    await service.grantMembership({ ...baseDto, durationDays: undefined }, caller);
    expect(pricing.subscribeMembership).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'Pro',
      'monthly',
      expect.objectContaining({ durationDays: 180 }),
    );
  });

  it('stacks from the current expiry for the same plan/tier when extendExisting=true', async () => {
    const currentExpiry = new Date('2027-01-01T00:00:00.000Z');
    recipients.resolveBusiness.mockResolvedValue({
      user: { id: 'user_1', email: 'jane@example.com' },
      business: {
        ...business,
        membershipStatus: 'active',
        membershipPlanName: 'Gold',
        membershipTier: 'Pro',
        membershipExpiresAt: currentExpiry,
      },
    });

    await service.grantMembership(baseDto, caller);
    expect(pricing.subscribeMembership).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'Pro',
      'monthly',
      expect.objectContaining({ baseDate: currentExpiry }),
    );
  });

  it('returns 409 MEMBERSHIP_CONFLICT for a different active plan without replaceExisting', async () => {
    recipients.resolveBusiness.mockResolvedValue({
      user: { id: 'user_1', email: 'jane@example.com' },
      business: {
        ...business,
        membershipStatus: 'active',
        membershipPlanName: 'Silver',
        membershipTier: 'Pro',
        membershipExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    });

    await expect(service.grantMembership(baseDto, caller)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MEMBERSHIP_CONFLICT' }),
      status: 409,
    });
    expect(pricing.subscribeMembership).not.toHaveBeenCalled();
  });

  it('replaces a different plan when replaceExisting=true', async () => {
    recipients.resolveBusiness.mockResolvedValue({
      user: { id: 'user_1', email: 'jane@example.com' },
      business: {
        ...business,
        membershipStatus: 'active',
        membershipPlanName: 'Silver',
        membershipTier: 'Pro',
        membershipExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
      },
    });

    await service.grantMembership({ ...baseDto, replaceExisting: true }, caller);
    expect(pricing.subscribeMembership).toHaveBeenCalled();
  });

  it('replays access-code issuance and persists one PartnerGrant', async () => {
    access.issuePartnerAccessCode.mockResolvedValue({
      success: true,
      code: 'MCOM-ACCESS-AB12CD',
      accessPlanId: 'access_1',
      planName: 'Gold Access Pass',
      durationDays: 365,
      status: 'UNUSED',
      recipientEmail: 'jane@example.com',
      expiresAt: null,
      mode: 'GIFT',
      codeId: 'code_1',
      replayed: true,
    });

    const result = await service.issueAccessPassCode(
      {
        issuanceId: 'iss_2',
        accessPlanId: 'access_1',
        recipientEmail: 'jane@example.com',
        mode: 'GIFT',
        sendEmail: false,
      },
      caller,
    );

    expect(result).toMatchObject({
      success: true,
      code: 'MCOM-ACCESS-AB12CD',
      status: 'UNUSED',
      replayed: true,
    });
    expect(prisma.partnerGrant.create).toHaveBeenCalledTimes(1);
    expect(events.emitAccessCodeCreated).not.toHaveBeenCalled();
  });
});
