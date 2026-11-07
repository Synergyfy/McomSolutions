import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralQueryDto } from './dto/referral-query.dto';
import {
  buildReferralLink,
  ensureUserReferralCode,
  isReferralEligibleRole,
} from '../common/referral/referral.util';

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
}
