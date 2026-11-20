import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ensureUserReferralCode } from '../common/referral/referral.util';
import { LocationAssignmentService } from '../geography/location-assignment.service';
import { ProfileSyncService } from '../profile-sync/profile-sync.service';
import type { ResolvedPostcode } from '../geography/postcode.service';

const customerProfileSelect = {
  id: true,
  userId: true,
  phone: true,
  postcode: true,
  cityId: true,
  boroughId: true,
  highStreetId: true,
  localMallId: true,
  locationAssignedAt: true,
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
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locationAssignment: LocationAssignmentService,
    private readonly profileSync: ProfileSyncService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.requireCustomerUser(userId);
    const customerProfile = await this.ensureCustomerProfile(userId);
    // Lazily assign a referral code so older customer accounts always have one.
    const referralCode = await ensureUserReferralCode(this.prisma, user);

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
      referralCode,
      memberSince: user.createdAt,
      phone: customerProfile.phone,
      postcode: customerProfile.postcode,
      loyaltyPoints: customerProfile.loyaltyPoints,
      status: customerProfile.status,
      customerProfile,
    };
  }

  async updateProfile(userId: string, dto: UpdateCustomerProfileDto) {
    await this.requireCustomerUser(userId);

    // Validate + normalise the postcode before writing anything: an invalid
    // postcode must not be persisted.
    let resolvedPostcode: ResolvedPostcode | null = null;
    if (dto.postcode !== undefined) {
      if (dto.postcode.trim() === '') {
        // Postcode is compulsory for customers — it is how they are placed in
        // their local area — so it cannot be cleared once set.
        throw new BadRequestException(
          'A UK postcode is required for customer accounts.',
        );
      }
      resolvedPostcode = await this.locationAssignment.resolvePostcode(
        dto.postcode,
      );
    }

    const data: { phone?: string | null; postcode?: string | null } = {};
    if (dto.phone !== undefined) {
      data.phone = dto.phone.trim() === '' ? null : dto.phone.trim();
    }
    if (resolvedPostcode) {
      data.postcode = resolvedPostcode.postcode;
    }

    let customerProfile = await this.prisma.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        phone: data.phone ?? null,
        postcode: data.postcode ?? null,
      },
      update: data,
      select: customerProfileSelect,
    });

    // Same City → Borough → High Street → Local Mall hierarchy as signup.
    // Assignment is best-effort: the postcode is already saved, so a resolver
    // outage should not fail the profile update.
    if (resolvedPostcode) {
      try {
        await this.locationAssignment.assignCustomer(
          customerProfile.id,
          resolvedPostcode.postcode,
          resolvedPostcode,
        );
        customerProfile = await this.prisma.customerProfile.findUniqueOrThrow({
          where: { id: customerProfile.id },
          select: customerProfileSelect,
        });
      } catch (error) {
        this.logger.error(
          `Customer ${customerProfile.id} could not be located from postcode ${resolvedPostcode.postcode}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    // Fan out to apps that consume the CUSTOMER role. Fire-and-forget: the
    // profile and location assignment have already committed.
    void this.profileSync.emitProfileUpdated({
      userId,
      role: Role.CUSTOMER,
      profileId: customerProfile.id,
      changedFields: Object.keys(dto ?? {}),
    });

    return {
      success: true,
      phone: customerProfile.phone,
      postcode: customerProfile.postcode,
      cityId: customerProfile.cityId,
      boroughId: customerProfile.boroughId,
      highStreetId: customerProfile.highStreetId,
      localMallId: customerProfile.localMallId,
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
