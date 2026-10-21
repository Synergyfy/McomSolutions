import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

const customerProfileSelect = {
  id: true,
  userId: true,
  phone: true,
  loyaltyPoints: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Customer-only profile surface.
 *
 * Identity fields (name, email, job title, email preferences, 2FA flag,
 * referral code, member-since) stay on `GET /auth/me`; this service only adds
 * the `CustomerProfile` fields that endpoint does not expose today.
 *
 * Deliberately excluded for now: membership tiers, phone verification,
 * country/region/currency/avatar. Those need a product decision and/or schema
 * columns that do not exist yet.
 */
@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.requireCustomerUser(userId);
    const customerProfile = await this.ensureCustomerProfile(userId);

    return {
      success: true,
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle,
      role: user.role,
      emailNotifications: user.emailNotifications,
      twoFactorEnabled: user.twoFactorEnabled,
      referralCode: user.referralCode,
      memberSince: user.createdAt,
      phone: customerProfile.phone,
      loyaltyPoints: customerProfile.loyaltyPoints,
      status: customerProfile.status,
      customerProfile,
    };
  }

  async updateProfile(userId: string, dto: UpdateCustomerProfileDto) {
    await this.requireCustomerUser(userId);

    const data: { phone?: string | null } = {};
    if (dto.phone !== undefined) {
      data.phone = dto.phone.trim() === '' ? null : dto.phone.trim();
    }

    const customerProfile = await this.prisma.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        phone: data.phone ?? null,
      },
      update: data,
      select: customerProfileSelect,
    });

    return {
      success: true,
      phone: customerProfile.phone,
      loyaltyPoints: customerProfile.loyaltyPoints,
      status: customerProfile.status,
      customerProfile,
    };
  }

  private async requireCustomerUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        emailNotifications: true,
        twoFactorEnabled: true,
        referralCode: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    return user;
  }

  private async ensureCustomerProfile(userId: string) {
    const existing = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: customerProfileSelect,
    });
    if (existing) return existing;

    return this.prisma.customerProfile.create({
      data: { userId },
      select: customerProfileSelect,
    });
  }
}
