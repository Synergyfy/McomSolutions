import { EcosystemEventsService } from './ecosystem-events.service';

describe('EcosystemEventsService', () => {
  let service: EcosystemEventsService;
  let prisma: any;
  let dispatcher: any;
  let config: any;

  beforeEach(() => {
    prisma = {
      couponRedemption: { findUnique: jest.fn(), findFirst: jest.fn() },
      coupon: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      partnerGrant: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    };
    dispatcher = { dispatchAsync: jest.fn() };
    config = { get: jest.fn().mockReturnValue('true') };
    service = new EcosystemEventsService(prisma, dispatcher, config);
  });

  it('signs/enqueues events with an (issuanceId,event) idempotency key', () => {
    service.emitMembershipGranted({
      issuanceId: 'iss_1',
      businessId: 'biz_1',
      planId: 'plan_1',
      tier: 'Pro',
      startsAt: '2026-10-29T00:00:00.000Z',
      expiresAt: '2027-10-29T00:00:00.000Z',
    });

    expect(dispatcher.dispatchAsync).toHaveBeenCalledWith(
      'mcom-rewards',
      'central.membership.granted',
      expect.objectContaining({
        issuanceId: 'iss_1',
        eventId: 'iss_1:central.membership.granted',
        businessId: 'biz_1',
      }),
    );
  });

  it('does not enqueue when the events flag is off', () => {
    config.get.mockReturnValue('false');
    service.emitGrantRevoked({
      issuanceId: 'iss_1',
      grantId: 'grant_1',
      kind: 'MEMBERSHIP',
      revokedAt: new Date().toISOString(),
    });
    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  it('emits coupon.redeemed only for partner-issued coupons', async () => {
    prisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red_1',
      userId: 'user_1',
      businessId: 'biz_1',
      discountAmount: 20,
      redeemedAt: new Date('2026-10-29T10:00:00.000Z'),
      coupon: { code: 'MCOM-REWARD-1', sourceApp: 'mcom-rewards', externalRef: 'iss_9' },
    });

    await service.emitCouponRedeemedForRedemption('red_1');

    expect(dispatcher.dispatchAsync).toHaveBeenCalledWith(
      'mcom-rewards',
      'central.coupon.redeemed',
      expect.objectContaining({
        issuanceId: 'iss_9',
        code: 'MCOM-REWARD-1',
        couponCode: 'MCOM-REWARD-1',
        redemptionId: 'red_1',
        discountAmount: 20,
      }),
    );
  });

  it('skips coupon.redeemed for admin coupons', async () => {
    prisma.couponRedemption.findUnique.mockResolvedValue({
      id: 'red_1',
      coupon: { code: 'ADMIN-1', sourceApp: null, externalRef: null },
    });
    await service.emitCouponRedeemedForRedemption('red_1');
    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  it('claims expiring coupons before emitting so sweeps are idempotent', async () => {
    prisma.coupon.findMany.mockResolvedValue([
      { id: 'coupon_1', code: 'MCOM-REWARD-1', externalRef: 'iss_1' },
    ]);
    prisma.coupon.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.sweepLifecycleEvents();

    expect(result.coupons).toBe(0);
    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
    expect(prisma.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon_1', expiryEventSentAt: null },
      data: { expiryEventSentAt: expect.any(Date) },
    });
  });
});
