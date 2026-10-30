import { ConflictException } from '@nestjs/common';
import { CouponDiscountType, CouponSource } from '@prisma/client';
import { CouponService } from './coupon.service';

describe('CouponService — partner coupons', () => {
  let service: CouponService;
  let prisma: any;

  const partner = { sourceApp: 'mcom-rewards', externalRef: 'iss_1' };
  const dto: any = {
    code: 'MCOM-REWARD-AB12',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 20,
    appliesToAllMemberships: true,
    appliesToAllAccess: false,
    maxUses: 1,
    maxUsesPerUser: 1,
  };

  const couponRow = {
    id: 'coupon_1',
    code: 'MCOM-REWARD-AB12',
    description: null,
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 20,
    appliesToAllMemberships: true,
    appliesToAllAccess: false,
    maxUses: 1,
    maxUsesPerUser: 1,
    timesRedeemed: 0,
    validFrom: new Date('2026-10-29T00:00:00.000Z'),
    expiresAt: null,
    isActive: true,
    source: CouponSource.ADMIN,
    sourceApp: 'mcom-rewards',
    externalRef: 'iss_1',
    lockedToUserId: null,
    lockedToUser: null,
    membershipPlans: [],
    accessPlans: [],
  };

  beforeEach(() => {
    prisma = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      couponRedemption: { count: jest.fn().mockResolvedValue(0) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user_1' }) },
      auditLog: { create: jest.fn() },
    };
    service = new CouponService(prisma, { send: jest.fn() } as any);
  });

  it('replays when the same code belongs to the same issuance', async () => {
    prisma.coupon.findUnique.mockResolvedValue(couponRow);
    const createSpy = jest.spyOn(service, 'createCoupon');

    const result = await service.createPartnerCoupon(dto, partner);

    expect(result.replayed).toBe(true);
    expect(result.code).toBe('MCOM-REWARD-AB12');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('returns 409 CODE_ALREADY_EXISTS when the code belongs to another source', async () => {
    prisma.coupon.findUnique.mockResolvedValue({
      ...couponRow,
      sourceApp: 'something-else',
      externalRef: 'other',
    });

    await expect(service.createPartnerCoupon(dto, partner)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('replays by (sourceApp, externalRef) when the code changed', async () => {
    prisma.coupon.findFirst.mockResolvedValue(couponRow);
    const result = await service.createPartnerCoupon(dto, partner);
    expect(result.replayed).toBe(true);
  });

  it('rejects an unknown locked user with 422 LOCKED_USER_NOT_FOUND', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.createPartnerCoupon({ ...dto, lockedToUserId: 'missing-user' }, partner),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LOCKED_USER_NOT_FOUND' }),
      status: 422,
    });
  });

  it('delegates to the admin validation path and records provenance', async () => {
    const createSpy = jest
      .spyOn(service, 'createCoupon')
      .mockResolvedValue({ success: true, data: { ...couponRow } } as any);

    const result = await service.createPartnerCoupon(dto, partner);

    expect(createSpy).toHaveBeenCalledWith(dto, 'MCOM Rewards', partner);
    expect(result).toMatchObject({ success: true, replayed: false });
  });

  it('refuses to revoke a coupon with completed redemptions', async () => {
    prisma.coupon.findUnique.mockResolvedValue(couponRow);
    prisma.couponRedemption.count.mockResolvedValue(1);

    await expect(
      service.revokePartnerCoupon('MCOM-REWARD-AB12', 'mcom-rewards'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_ALREADY_REDEEMED' }),
      status: 409,
    });
  });

  it('revokes an unused partner coupon', async () => {
    prisma.coupon.findUnique.mockResolvedValue(couponRow);
    prisma.coupon.update.mockResolvedValue({ ...couponRow, isActive: false });

    const result = await service.revokePartnerCoupon('MCOM-REWARD-AB12', 'mcom-rewards');
    expect(result).toMatchObject({ success: true, status: 'revoked' });
    expect(prisma.coupon.update).toHaveBeenCalledWith({
      where: { id: 'coupon_1' },
      data: { isActive: false },
    });
  });

  it('returns status, remaining uses and lock for inspection', async () => {
    prisma.coupon.findUnique.mockResolvedValue({
      ...couponRow,
      timesRedeemed: 1,
      maxUses: 2,
      lockedToUserId: 'user_1',
    });
    prisma.couponRedemption.count.mockResolvedValue(1);

    const result = await service.getPartnerCoupon('MCOM-REWARD-AB12', 'mcom-rewards');
    expect(result).toMatchObject({
      code: 'MCOM-REWARD-AB12',
      remainingUses: 1,
      redemptionCount: 1,
      lockedToUserId: 'user_1',
    });
  });
});
