import { Test, TestingModule } from '@nestjs/testing';
import { CouponDiscountType, CouponRedemptionStatus, CouponSource, TaskAssignmentStatus } from '@prisma/client';
import { CouponService } from './coupon.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';

describe('CouponService', () => {
  let service: CouponService;

  const mockMail = { send: jest.fn().mockResolvedValue(undefined) };

  const baseCoupon = {
    id: 'coupon-1',
    code: 'MCOM-20OFF',
    description: '20% off',
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: 20,
    appliesToAllMemberships: true,
    membershipPlans: [],
    maxUses: 10,
    maxUsesPerUser: 1,
    timesRedeemed: 0,
    validFrom: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 86_400_000),
    isActive: true,
    source: CouponSource.ADMIN,
    lockedToUserId: null,
    lockedToUser: null,
    taskDefinitionId: null,
    taskAssignmentId: null,
    createdByName: 'Admin',
    emailSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrisma = {
    coupon: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    couponRedemption: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    userTaskAssignment: {
      findUnique: jest.fn(),
    },
    membershipPlan: {
      count: jest.fn(),
    },
    notification: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'coupon-1' }]),
    $transaction: jest.fn((callback: any) =>
      typeof callback === 'function' ? callback(mockPrisma) : Promise.all(callback),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: any) =>
      typeof callback === 'function' ? callback(mockPrisma) : Promise.all(callback),
    );
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'coupon-1' }]);
    mockPrisma.couponRedemption.count.mockResolvedValue(0);
    mockPrisma.couponRedemption.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.notification.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockMail.send.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMail },
      ],
    }).compile();

    service = module.get(CouponService);
  });

  describe('discount maths', () => {
    it('rounds a percentage discount to 2 decimals', () => {
      expect(service.computeDiscount(99.99, CouponDiscountType.PERCENTAGE, 20)).toEqual({
        originalAmount: 99.99,
        discountAmount: 20,
        finalAmount: 79.99,
      });
    });

    it('caps a fixed discount at the payable amount', () => {
      expect(service.computeDiscount(10, CouponDiscountType.FIXED, 25)).toEqual({
        originalAmount: 10,
        discountAmount: 10,
        finalAmount: 0,
      });
    });
  });

  describe('validateForCharge', () => {
    it('returns a discounted quote for a valid coupon', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(baseCoupon);

      const quote = await service.validateForCharge({
        code: 'mcom-20off',
        userId: 'user-1',
        planId: 'plan-1',
        amount: 100,
      });

      expect(quote.finalAmount).toBe(80);
      expect(quote.discountAmount).toBe(20);
      expect(quote.coupon.code).toBe('MCOM-20OFF');
      expect(quote.coupon.membershipPlanIds).toEqual([]);
    });

    it('rejects a coupon locked to another user', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...baseCoupon,
        lockedToUserId: 'someone-else',
      });

      await expect(
        service.validateForCharge({
          code: baseCoupon.code,
          userId: 'user-1',
          planId: 'plan-1',
          amount: 100,
        }),
      ).rejects.toThrow('not valid for your account');
    });

    it('rejects a coupon when the total usage limit is reached', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...baseCoupon,
        maxUses: 2,
        timesRedeemed: 2,
      });

      await expect(
        service.validateForCharge({
          code: baseCoupon.code,
          userId: 'user-1',
          planId: 'plan-1',
          amount: 100,
        }),
      ).rejects.toThrow('usage limit');
    });

    it('rejects a coupon outside its membership scope', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...baseCoupon,
        appliesToAllMemberships: false,
        membershipPlans: [
          { planId: 'plan-2', plan: { id: 'plan-2', name: 'Gold', archived: false } },
        ],
      });

      await expect(
        service.validateForCharge({
          code: baseCoupon.code,
          userId: 'user-1',
          planId: 'plan-1',
          amount: 100,
        }),
      ).rejects.toThrow('selected membership');
    });

    it('rejects a coupon that leaves less than the minimum charge', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...baseCoupon,
        discountType: CouponDiscountType.FIXED,
        discountValue: 10,
      });

      await expect(
        service.validateForCharge({
          code: baseCoupon.code,
          userId: 'user-1',
          planId: 'plan-1',
          amount: 10,
        }),
      ).rejects.toThrow('less than');
    });
  });

  describe('reserveForCharge', () => {
    it('expires this user’s old hold and creates a pending reservation', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(baseCoupon);
      mockPrisma.couponRedemption.create.mockResolvedValue({
        id: 'reservation-1',
        reservedUntil: new Date(Date.now() + 1_800_000),
      });

      const reserved = await service.reserveForCharge({
        code: baseCoupon.code,
        userId: 'user-1',
        planId: 'plan-1',
        planName: 'Bronze',
        amount: 100,
        businessId: 'business-1',
        provider: 'stripe',
        providerPaymentId: 'pi_1',
      });

      expect(reserved.redemptionId).toBe('reservation-1');
      expect(mockPrisma.couponRedemption.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', status: 'PENDING' }),
          data: expect.objectContaining({ status: 'EXPIRED' }),
        }),
      );
      expect(mockPrisma.couponRedemption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CouponRedemptionStatus.PENDING,
            provider: 'stripe',
            providerPaymentId: 'pi_1',
            finalAmount: 80,
          }),
        }),
      );
    });
  });

  describe('listMyCoupons', () => {
    it('marks an unused personal coupon as available', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([
        {
          ...baseCoupon,
          lockedToUserId: 'user-1',
          redemptions: [],
        },
      ]);

      const result = await service.listMyCoupons('user-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          code: 'MCOM-20OFF',
          isPersonal: true,
          canUse: true,
          used: false,
          usageStatus: 'available',
        }),
      );
      expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ lockedToUserId: 'user-1' }]),
          }),
          include: expect.objectContaining({
            membershipPlans: expect.any(Object),
            redemptions: expect.any(Object),
          }),
        }),
      );
    });

    it('marks a personal coupon as used once its per-user limit is reached', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([
        {
          ...baseCoupon,
          lockedToUserId: 'user-1',
          maxUsesPerUser: 1,
          redemptions: [
            {
              id: 'redemption-1',
              redeemedAt: new Date(),
              discountAmount: 20,
              finalAmount: 80,
              planName: 'Gold',
            },
          ],
        },
      ]);

      const result = await service.listMyCoupons('user-1');

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          canUse: false,
          used: true,
          usedCount: 1,
          usageStatus: 'used',
          totalSaved: 20,
        }),
      );
    });
  });

  describe('issueTaskRewardCoupon', () => {
    const assignment = {
      id: 'assignment-1',
      userId: 'user-1',
      status: TaskAssignmentStatus.COMPLETED,
      user: {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Azeem',
        lastName: 'Test',
        businessProfile: { id: 'business-1' },
      },
      task: {
        id: 'task-1',
        title: 'Upload logo',
        rewardCouponEnabled: true,
        rewardCouponDiscountType: CouponDiscountType.PERCENTAGE,
        rewardCouponValue: 15,
        rewardCouponAppliesToAll: false,
        rewardCouponValidDays: 30,
        rewardCouponExpiresAt: null,
        rewardCouponPlans: [
          { planId: 'plan-1', plan: { id: 'plan-1', name: 'Gold' } },
        ],
      },
    };

    it('issues a personal one-use coupon and emails the user', async () => {
      mockPrisma.userTaskAssignment.findUnique.mockResolvedValue(assignment);
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      mockPrisma.coupon.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...baseCoupon,
          ...data,
          id: 'task-coupon-1',
          code: data.code,
          membershipPlans: [
            { planId: 'plan-1', plan: { id: 'plan-1', name: 'Gold', archived: false } },
          ],
          lockedToUser: assignment.user,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      mockPrisma.coupon.update.mockResolvedValue({});

      const result = await service.issueTaskRewardCoupon('assignment-1');

      expect(result?.code).toMatch(/^TASK-[A-Z2-9]{8}$/);
      expect(mockPrisma.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: CouponSource.TASK_REWARD,
            lockedToUserId: 'user-1',
            taskAssignmentId: 'assignment-1',
            maxUses: 1,
            maxUsesPerUser: 1,
          }),
        }),
      );
      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com' }),
      );
    });

    it('does nothing when the task does not reward a coupon', async () => {
      mockPrisma.userTaskAssignment.findUnique.mockResolvedValue({
        ...assignment,
        task: { ...assignment.task, rewardCouponEnabled: false },
      });

      await expect(service.issueTaskRewardCoupon('assignment-1')).resolves.toBeNull();
      expect(mockPrisma.coupon.create).not.toHaveBeenCalled();
    });
  });
});
