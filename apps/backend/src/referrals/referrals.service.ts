import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralQueryDto } from './dto/referral-query.dto';
import {
  buildReferralLink,
  ensureUserReferralCode,
  isReferralEligibleRole,
} from '../common/referral/referral.util';
import { ReferralCommissionService } from './referral-commission.service';

const referredUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  createdAt: true,
};

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly commission: ReferralCommissionService,
  ) {}

  private buildLink(code: string): string {
    return buildReferralLink(this.config.get<string>('FRONTEND_URL'), code);
  }

  async getMyReferralInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, referralCode: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!isReferralEligibleRole(user.role)) {
      throw new ForbiddenException('Admin accounts do not participate in the referral programme');
    }

    // Lazily assign a code for older accounts so nobody is left without one.
    const referralCode = await ensureUserReferralCode(this.prisma, user);
    if (!referralCode) {
      throw new NotFoundException('Referral code not yet assigned');
    }

    return {
      success: true,
      referralCode,
      referralLink: this.buildLink(referralCode),
    };
  }

  async listMyReferrals(userId: string, query: ReferralQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { referredById: userId };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        select: referredUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMyReferralStats(userId: string) {
    const totalReferrals = await this.prisma.user.count({
      where: { referredById: userId },
    });
    return { success: true, totalReferrals };
  }

  /**
   * Referral-earnings view for the signed-in business/customer/affiliate.
   * The wallet balance remains the source of truth; this is the breakdown of
   * which referred users generated the referral credits.
   */
  async getMyEarnings(userId: string, historyLimit = 20) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!isReferralEligibleRole(user.role)) {
      throw new ForbiddenException('Admin accounts do not participate in the referral programme');
    }
    return this.getEarningsForUser(userId, historyLimit);
  }

  /** Internal/back-office variant that does not reject admins. */
  async getEarningsForUser(userId: string, historyLimit = 20) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      success: true,
      data: await this.commission.getEarningsForUser(userId, historyLimit),
    };
  }

  async getAdminReferrerDetail(userId: string) {
    const referrer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        referralCode: true,
        createdAt: true,
      },
    });
    if (!referrer) throw new NotFoundException('Referrer not found');
    const earnings = await this.commission.getReferrerAdminSummary(userId);
    return {
      success: true,
      data: {
        referrer,
        ...earnings,
      },
    };
  }
}
