import { Injectable, NotFoundException } from '@nestjs/common';
import { MembershipTier, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { partnerError, PARTNER_ERRORS, PARTNER_HTTP } from './partner-error.util';

export interface ResolvedRecipient {
  mcomUserId: string;
  email: string;
  name: string;
  role: string;
  businessId: string | null;
  businessName: string | null;
  businessStatus: string | null;
  membershipLevel: string | null;
  membershipTier: string | null;
  membershipStatus: string | null;
  membershipExpiresAt: string | null;
}

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  businessProfile: {
    select: {
      id: true,
      businessName: true,
      membershipLevel: true,
      membershipTier: true,
      membershipStatus: true,
      membershipExpiresAt: true,
    },
  },
} as const;

function displayTier(tier: MembershipTier): string {
  if (tier === MembershipTier.Pro) return 'Pro';
  if (tier === MembershipTier.ProPlus) return 'Pro+';
  return 'Standard';
}

/**
 * Minimal, privacy-safe recipient resolution for partner apps. Reuses the
 * same soft-delete-aware Prisma delegate used everywhere else; never exposes
 * passwords, tokens, payment ids, or full profile data.
 */
@Injectable()
export class PartnerRecipientService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: { email?: string; mcomUserId?: string }): Promise<ResolvedRecipient> {
    const hasEmail = Boolean(input.email?.trim());
    const hasId = Boolean(input.mcomUserId?.trim());
    if (hasEmail === hasId) {
      throw partnerError(
        PARTNER_HTTP.BAD_REQUEST,
        PARTNER_ERRORS.INVALID_RECIPIENT_LOOKUP,
        'Provide exactly one of email or mcomUserId.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: hasEmail
        ? { email: { equals: input.email!.trim(), mode: 'insensitive' }, deletedAt: null }
        : { id: input.mcomUserId!.trim(), deletedAt: null },
      select: RECIPIENT_SELECT,
    });

    if (!user) {
      throw new NotFoundException({
        code: PARTNER_ERRORS.RECIPIENT_NOT_FOUND,
        message: 'Recipient not found',
      });
    }

    const business = user.businessProfile;
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    return {
      mcomUserId: user.id,
      email: user.email,
      name,
      role: user.role as Role,
      businessId: business?.id ?? null,
      businessName: business?.businessName ?? null,
      businessStatus: business ? 'active' : null,
      membershipLevel: business?.membershipLevel ?? null,
      membershipTier: business ? displayTier(business.membershipTier) : null,
      membershipStatus: business?.membershipStatus ?? null,
      membershipExpiresAt: business?.membershipExpiresAt?.toISOString() ?? null,
    };
  }

  /** Resolves the recipient's business profile or fails with the partner code. */
  async resolveBusiness(recipientMcomUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: recipientMcomUserId, deletedAt: null },
      select: {
        id: true,
        email: true,
        businessProfile: {
          select: {
            id: true,
            businessName: true,
            membershipLevel: true,
            membershipTier: true,
            membershipStatus: true,
            membershipExpiresAt: true,
            membershipPlanName: true,
            membershipRecurringId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: PARTNER_ERRORS.RECIPIENT_NOT_FOUND,
        message: 'Recipient not found',
      });
    }
    if (!user.businessProfile) {
      throw partnerError(
        PARTNER_HTTP.UNPROCESSABLE,
        PARTNER_ERRORS.RECIPIENT_NOT_A_BUSINESS,
        'Central memberships and access passes are business-scoped. This recipient has no business profile.',
      );
    }
    return { user, business: user.businessProfile };
  }
}
