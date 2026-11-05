import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AffiliateBusinessAcquisitionStatus, BusinessRelationshipType, Prisma, Role } from '@prisma/client';
import * as crypto from 'crypto';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const AFFILIATE_ROLES: Role[] = [Role.AGENT, Role.ACCOUNT_MANAGER, Role.CONSULTANT];

export interface CreateInvitationInput {
  affiliateUserId?: string;
  affiliateExternalId?: string;
  affiliateEmail?: string;
  affiliateName?: string;
  affiliateRole?: string;
  prospectExternalId?: string;
  businessName: string;
  contactName?: string;
  businessPhone?: string;
  businessEmail?: string;
  postcode?: string;
  address?: string;
  category?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateClaimInput {
  businessId?: string;
  businessEmail?: string;
  businessName?: string;
  affiliateUserId?: string;
  affiliateExternalId?: string;
  affiliateEmail?: string;
  affiliateName?: string;
  affiliateRole?: string;
  prospectExternalId?: string;
  evidence?: string;
  metadata?: Record<string, unknown>;
}

export interface RegistrationAttributionInput {
  businessId: string;
  userId: string;
  email: string;
}

@Injectable()
export class BusinessAcquisitionService {
  private readonly logger = new Logger(BusinessAcquisitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Affiliate identity resolution ─────────────────────────────────────

  private async resolveAffiliate(input: {
    affiliateUserId?: string;
    affiliateEmail?: string;
    affiliateName?: string;
    affiliateRole?: string;
  }) {
    let user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: Role;
    } | null = null;

    if (input.affiliateUserId) {
      user = await this.prisma.user.findFirst({
        where: { id: input.affiliateUserId, deletedAt: null },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });
    }
    if (!user && input.affiliateEmail) {
      user = await this.prisma.user.findFirst({
        where: { email: input.affiliateEmail.toLowerCase().trim(), deletedAt: null },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });
    }

    if (user && !AFFILIATE_ROLES.includes(user.role)) {
      throw new BadRequestException('Only agents, account managers and consultants can acquire businesses.');
    }

    return {
      userId: user?.id ?? input.affiliateUserId ?? null,
      email: (user?.email ?? input.affiliateEmail ?? '').toLowerCase().trim(),
      name:
        [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
        input.affiliateName ||
        user?.email ||
        input.affiliateEmail ||
        'Affiliate',
      role: (user?.role ?? input.affiliateRole ?? 'AGENT').toString().toLowerCase(),
    };
  }

  private invitationUrl(token: string): string {
    const base = (
      this.config.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
    return `${base}/getstarted/business?entry=signup&affiliateInvite=${encodeURIComponent(token)}`;
  }

  // ── Invitations ───────────────────────────────────────────────────────

  async createInvitation(input: CreateInvitationInput) {
    if (!input?.businessName?.trim()) {
      throw new BadRequestException('A business name is required to create an invitation.');
    }
    const affiliate = await this.resolveAffiliate(input);
    if (!affiliate.userId) {
      throw new BadRequestException(
        'The affiliate has no linked Central Hub account. Sign in through MCOM Central before inviting a business.',
      );
    }

    // Idempotent per prospect: re-opening the invitation returns the same link.
    if (input.prospectExternalId) {
      const existing = await this.prisma.affiliateBusinessInvitation.findFirst({
        where: {
          prospectExternalId: input.prospectExternalId,
          status: { in: [AffiliateBusinessAcquisitionStatus.INVITED, AffiliateBusinessAcquisitionStatus.REGISTERED] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        return this.serializeInvitation(existing);
      }
    }

    const invitation = await this.prisma.affiliateBusinessInvitation.create({
      data: {
        token: crypto.randomBytes(24).toString('hex'),
        affiliateUserId: affiliate.userId,
        affiliateExternalId: input.affiliateExternalId ?? null,
        affiliateName: affiliate.name,
        affiliateEmail: affiliate.email,
        affiliateRole: affiliate.role,
        prospectExternalId: input.prospectExternalId ?? null,
        businessName: input.businessName.trim(),
        contactName: input.contactName?.trim() || null,
        businessPhone: input.businessPhone?.trim() || null,
        businessEmail: input.businessEmail?.trim().toLowerCase() || null,
        postcode: input.postcode?.trim().toUpperCase() || null,
        address: input.address?.trim() || null,
        category: input.category?.trim() || null,
        notes: input.notes?.trim() || null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return this.serializeInvitation(invitation);
  }

  private serializeInvitation(invitation: {
    id: string;
    token: string;
    businessName: string;
    status: AffiliateBusinessAcquisitionStatus;
    affiliateName: string;
    affiliateEmail: string;
    affiliateRole: string;
    businessId: string | null;
    createdAt: Date;
    registeredAt: Date | null;
    onboardingCompletedAt: Date | null;
    verifiedAt: Date | null;
  }) {
    return {
      id: invitation.id,
      token: invitation.token,
      invitationUrl: this.invitationUrl(invitation.token),
      businessName: invitation.businessName,
      status: invitation.status,
      affiliateName: invitation.affiliateName,
      affiliateEmail: invitation.affiliateEmail,
      affiliateRole: invitation.affiliateRole,
      businessId: invitation.businessId,
      createdAt: invitation.createdAt,
      registeredAt: invitation.registeredAt,
      onboardingCompletedAt: invitation.onboardingCompletedAt,
      verifiedAt: invitation.verifiedAt,
    };
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.prisma.affiliateBusinessInvitation.findUnique({
      where: { token },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.cancelledAt) {
      throw new BadRequestException('This invitation has been cancelled.');
    }
    if (invitation.status === AffiliateBusinessAcquisitionStatus.INVITED) {
      void this.notifyAffiliate({
        type: 'invitation_opened',
        invitationToken: invitation.token,
        prospectExternalId: invitation.prospectExternalId,
        businessId: invitation.businessId,
        businessName: invitation.businessName,
        status: AffiliateBusinessAcquisitionStatus.INVITED,
        occurredAt: new Date().toISOString(),
      });
    }
    return {
      success: true,
      data: {
        token: invitation.token,
        businessName: invitation.businessName,
        contactName: invitation.contactName,
        businessEmail: invitation.businessEmail,
        businessPhone: invitation.businessPhone,
        postcode: invitation.postcode,
        address: invitation.address,
        category: invitation.category,
        status: invitation.status,
        affiliate: {
          name: invitation.affiliateName,
          role: invitation.affiliateRole,
          email: invitation.affiliateEmail,
        },
        isUsable: invitation.status === AffiliateBusinessAcquisitionStatus.INVITED,
      },
    };
  }

  async listInvitations(affiliateUserId?: string) {
    const data = await this.prisma.affiliateBusinessInvitation.findMany({
      where: affiliateUserId ? { affiliateUserId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { business: { select: { id: true, businessName: true } } },
    });
    return data.map((row) => this.serializeInvitation(row));
  }

  async cancelInvitation(id: string, actorUserId: string) {
    const invitation = await this.prisma.affiliateBusinessInvitation.findUnique({ where: { id } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === AffiliateBusinessAcquisitionStatus.VERIFIED) {
      throw new ConflictException('A verified acquisition cannot be cancelled.');
    }
    const updated = await this.prisma.affiliateBusinessInvitation.update({
      where: { id },
      data: {
        status: AffiliateBusinessAcquisitionStatus.CANCELLED,
        cancelledAt: new Date(),
        metadata: {
          ...((invitation.metadata as Record<string, unknown>) ?? {}),
          cancelledBy: actorUserId,
        } as Prisma.InputJsonValue,
      },
    });
    return this.serializeInvitation(updated);
  }

  // ── Registration attribution ─────────────────────────────────────────

  /**
   * Resolve a token before registration. Returns null when no token is
   * supplied so a normal direct signup continues unchanged.
   */
  async resolveInvitationForRegistration(token?: string | null) {
    if (!token?.trim()) return null;
    const invitation = await this.prisma.affiliateBusinessInvitation.findUnique({
      where: { token: token.trim() },
    });
    if (!invitation) throw new BadRequestException('Invalid affiliate invitation link.');
    if (invitation.cancelledAt || invitation.status === AffiliateBusinessAcquisitionStatus.CANCELLED) {
      throw new BadRequestException('This affiliate invitation has been cancelled.');
    }
    if (
      invitation.status === AffiliateBusinessAcquisitionStatus.REGISTERED ||
      invitation.status === AffiliateBusinessAcquisitionStatus.ONBOARDING_COMPLETED ||
      invitation.status === AffiliateBusinessAcquisitionStatus.VERIFIED
    ) {
      throw new ConflictException('This affiliate invitation has already been used.');
    }
    return invitation;
  }

  /**
   * Persist the permanent acquisition link. Called after the business account
   * has been created (inside or immediately after registration).
   */
  async applyInvitationToBusiness(invitationId: string, input: RegistrationAttributionInput) {
    const invitation = await this.prisma.affiliateBusinessInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    const now = new Date();
    const emailMatched =
      !invitation.businessEmail ||
      invitation.businessEmail.toLowerCase() === input.email.toLowerCase();

    await this.prisma.$transaction([
      this.prisma.businessProfile.update({
        where: { id: input.businessId },
        data: {
          acquiredByAffiliateId: invitation.affiliateUserId,
          acquiredByAffiliateExternalId: invitation.affiliateExternalId,
          acquiredByAffiliateName: invitation.affiliateName,
          acquiredByAffiliateRole: invitation.affiliateRole,
          onboardedByAffiliateId: invitation.affiliateUserId,
          acquisitionSource: 'affiliate_invitation',
          acquisitionInvitationId: invitation.id,
          acquisitionStatus: AffiliateBusinessAcquisitionStatus.REGISTERED,
          acquisitionAttributedAt: now,
        },
      }),
      this.prisma.affiliateBusinessInvitation.update({
        where: { id: invitation.id },
        data: {
          status: AffiliateBusinessAcquisitionStatus.REGISTERED,
          businessId: input.businessId,
          registeredUserId: input.userId,
          registeredAt: now,
          metadata: {
            ...((invitation.metadata as Record<string, unknown>) ?? {}),
            registeredEmail: input.email,
            emailMatched,
          } as Prisma.InputJsonValue,
        },
      }),
      this.prisma.businessRelationshipHistory.create({
        data: {
          businessId: input.businessId,
          relationshipType: BusinessRelationshipType.ACQUISITION,
          affiliateUserId: invitation.affiliateUserId,
          affiliateExternalId: invitation.affiliateExternalId,
          actorUserId: input.userId,
          newValue: 'REGISTERED',
          metadata: {
            invitationId: invitation.id,
            source: 'affiliate_invitation',
            emailMatched,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);

    // The existing referral engine keys off referredById. Keeping it in sync
    // means the acquisition also shows in Central's referral reporting.
    if (invitation.affiliateUserId) {
      // Never overwrite an earlier referrer captured by the generic ?ref=
      // journey. The earliest valid introduction remains the evidence.
      await this.prisma.user.updateMany({
        where: { id: input.userId, referredById: null },
        data: { referredById: invitation.affiliateUserId },
      });
    }

    void this.notifyAffiliate({
      type: 'registration',
      invitationToken: invitation.token,
      prospectExternalId: invitation.prospectExternalId,
      businessId: input.businessId,
      businessName: invitation.businessName,
      userId: input.userId,
      status: AffiliateBusinessAcquisitionStatus.REGISTERED,
      occurredAt: now.toISOString(),
    });

    return { emailMatched };
  }

  /**
   * Promote a registered acquisition to "onboarding completed" once the
   * required business profile information exists. Verification remains a
   * separate administrative step.
   */
  async markOnboardingCompleted(businessId: string) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        id: true,
        businessName: true,
        phone: true,
        email: true,
        address: true,
        postcode: true,
        acquisitionStatus: true,
        acquisitionInvitationId: true,
        acquiredByAffiliateId: true,
        acquiredByAffiliateExternalId: true,
      },
    });
    if (!business) return null;
    if (!business.acquiredByAffiliateId && !business.acquiredByAffiliateExternalId) return null;
    if (business.acquisitionStatus === AffiliateBusinessAcquisitionStatus.VERIFIED) return business;

    const complete = Boolean(
      business.businessName?.trim() &&
        business.phone?.trim() &&
        business.email?.trim() &&
        (business.address?.trim() || business.postcode?.trim()),
    );
    if (!complete) return business;

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.businessProfile.update({
        where: { id: business.id },
        data: { acquisitionStatus: AffiliateBusinessAcquisitionStatus.ONBOARDING_COMPLETED },
      }),
      ...(business.acquisitionInvitationId
        ? [
            this.prisma.affiliateBusinessInvitation.update({
              where: { id: business.acquisitionInvitationId },
              data: {
                status: AffiliateBusinessAcquisitionStatus.ONBOARDING_COMPLETED,
                onboardingCompletedAt: now,
              },
            }),
          ]
        : []),
      this.prisma.businessRelationshipHistory.create({
        data: {
          businessId: business.id,
          relationshipType: BusinessRelationshipType.ONBOARDING_ASSISTANCE,
          affiliateUserId: business.acquiredByAffiliateId,
          affiliateExternalId: business.acquiredByAffiliateExternalId,
          newValue: 'ONBOARDING_COMPLETED',
          metadata: { source: 'profile_completion' } as Prisma.InputJsonValue,
        },
      }),
    ]);

    const sourceInvitation = business.acquisitionInvitationId
      ? await this.prisma.affiliateBusinessInvitation.findUnique({
          where: { id: business.acquisitionInvitationId },
          select: { token: true, prospectExternalId: true },
        })
      : null;
    void this.notifyAffiliate({
      type: 'onboarding_completed',
      invitationToken: sourceInvitation?.token ?? null,
      prospectExternalId: sourceInvitation?.prospectExternalId ?? null,
      businessId: business.id,
      businessName: business.businessName,
      status: AffiliateBusinessAcquisitionStatus.ONBOARDING_COMPLETED,
      occurredAt: now.toISOString(),
    });
    return { ...business, acquisitionStatus: AffiliateBusinessAcquisitionStatus.ONBOARDING_COMPLETED };
  }

  /**
   * Identity lookup used by the affiliate portal before it records a new
   * prospect. Prevents two affiliates claiming the same CHS business.
   */
  async lookupBusinessByIdentity(params: {
    name?: string;
    email?: string;
    phone?: string;
    postcode?: string;
  }) {
    const email = params.email?.trim().toLowerCase();
    const postcode = params.postcode?.toUpperCase().replace(/\s+/g, '');
    const phone = params.phone?.replace(/[^0-9]/g, '');
    const name = params.name?.trim();

    if (!email && !phone && !(name && postcode)) return null;

    const candidates = await this.prisma.businessProfile.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...(phone ? [{ phone: { contains: phone.slice(-9) } }] : []),
          ...(name && postcode
            ? [{ businessName: { equals: name, mode: 'insensitive' as const }, postcode: { startsWith: postcode.slice(0, 4), mode: 'insensitive' as const } }]
            : []),
        ],
      },
      take: 5,
      select: {
        id: true,
        businessName: true,
        email: true,
        phone: true,
        postcode: true,
        acquiredByAffiliateId: true,
        acquiredByAffiliateExternalId: true,
        acquiredByAffiliateName: true,
        acquisitionStatus: true,
      },
    });

    return candidates[0] ?? null;
  }

  // ── Read models used by the affiliate dashboard ───────────────────────

  async listAcquiredBusinesses(params: {
    affiliateUserId?: string;
    affiliateExternalId?: string;
  }) {
    if (!params.affiliateUserId && !params.affiliateExternalId) {
      throw new BadRequestException('affiliateUserId or affiliateExternalId is required');
    }
    const businesses = await this.prisma.businessProfile.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(params.affiliateUserId ? [{ acquiredByAffiliateId: params.affiliateUserId }] : []),
          ...(params.affiliateExternalId
            ? [{ acquiredByAffiliateExternalId: params.affiliateExternalId }]
            : []),
        ],
      },
      orderBy: { acquisitionAttributedAt: 'desc' },
      select: {
        id: true,
        businessName: true,
        email: true,
        phone: true,
        postcode: true,
        address: true,
        category: true,
        logoUrl: true,
        membershipStatus: true,
        membershipPlanName: true,
        createdAt: true,
        acquisitionStatus: true,
        acquisitionSource: true,
        acquisitionAttributedAt: true,
        acquisitionVerifiedAt: true,
        acquiredByAffiliateId: true,
        acquiredByAffiliateExternalId: true,
        acquiredByAffiliateName: true,
        acquiredByAffiliateRole: true,
        accountManagerId: true,
        accountManagerAssignedAt: true,
        accountManager: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        affiliateInvitations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, token: true, status: true },
        },
      },
    });

    return {
      total: businesses.length,
      businesses: businesses.map((b) => ({
        ...b,
        accountManagerName: b.accountManager
          ? [b.accountManager.firstName, b.accountManager.lastName].filter(Boolean).join(' ') ||
            b.accountManager.email
          : null,
      })),
    };
  }

  async getRelationships(businessId: string) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        id: true,
        businessName: true,
        acquiredByAffiliateId: true,
        acquiredByAffiliateExternalId: true,
        acquiredByAffiliateName: true,
        acquiredByAffiliateRole: true,
        onboardedByAffiliateId: true,
        acquisitionStatus: true,
        accountManagerId: true,
        accountManagerAssignedAt: true,
        accountManager: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    const history = await this.prisma.businessRelationshipHistory.findMany({
      where: { businessId },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
    return { business, history };
  }

  // ── Post-registration claims ─────────────────────────────────────────

  async createClaim(input: CreateClaimInput) {
    const affiliate = await this.resolveAffiliate(input);
    if (!affiliate.userId) {
      throw new BadRequestException('The affiliate has no linked Central Hub account.');
    }

    let businessId = input.businessId ?? null;
    if (!businessId && input.businessEmail) {
      const business = await this.prisma.businessProfile.findFirst({
        where: { email: input.businessEmail.toLowerCase().trim(), deletedAt: null },
        select: { id: true },
      });
      businessId = business?.id ?? null;
    }

    if (businessId) {
      const existing = await this.prisma.businessProfile.findFirst({
        where: { id: businessId, deletedAt: null },
        select: { acquiredByAffiliateId: true, acquiredByAffiliateExternalId: true },
      });
      if (existing?.acquiredByAffiliateId || existing?.acquiredByAffiliateExternalId) {
        throw new ConflictException(
          'This business already has a recorded acquisition source. Use the attribution review process instead.',
        );
      }
    }

    const claim = await this.prisma.affiliateBusinessClaim.create({
      data: {
        businessId,
        businessEmail: input.businessEmail?.toLowerCase().trim() || null,
        businessName: input.businessName?.trim() || null,
        affiliateUserId: affiliate.userId,
        affiliateExternalId: input.affiliateExternalId ?? null,
        affiliateName: affiliate.name,
        affiliateEmail: affiliate.email,
        affiliateRole: affiliate.role,
        prospectExternalId: input.prospectExternalId ?? null,
        evidence: input.evidence?.trim() || null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return claim;
  }

  async listClaims(status?: string) {
    return this.prisma.affiliateBusinessClaim.findMany({
      where: status ? { status: status.toUpperCase() } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reviewClaim(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewerUserId: string,
    notes?: string,
  ) {
    const claim = await this.prisma.affiliateBusinessClaim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== 'PENDING') throw new ConflictException('This claim has already been reviewed.');

    if (decision === 'REJECTED') {
      return this.prisma.affiliateBusinessClaim.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          reviewNotes: notes?.trim() || null,
        },
      });
    }

    const business = await this.prisma.businessProfile.findFirst({
      where: claim.businessId
        ? { id: claim.businessId, deletedAt: null }
        : { email: claim.businessEmail ?? '__none__', deletedAt: null },
      select: { id: true, userId: true },
    });
    const businessId = business?.id ?? null;
    if (!businessId || !business) {
      throw new BadRequestException(
        'The business could not be found. Ask the affiliate to confirm the registered business email.',
      );
    }

    const existing = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { acquiredByAffiliateId: true, acquiredByAffiliateExternalId: true },
    });
    if (existing?.acquiredByAffiliateId || existing?.acquiredByAffiliateExternalId) {
      throw new ConflictException('This business already has a recorded acquisition source.');
    }

    const now = new Date();
    const claimResults = await this.prisma.$transaction([
      this.prisma.businessProfile.update({
        where: { id: businessId },
        data: {
          acquiredByAffiliateId: claim.affiliateUserId,
          acquiredByAffiliateExternalId: claim.affiliateExternalId,
          acquiredByAffiliateName: claim.affiliateName,
          acquiredByAffiliateRole: claim.affiliateRole,
          onboardedByAffiliateId: claim.affiliateUserId,
          acquisitionSource: 'verified_claim',
          acquisitionStatus: AffiliateBusinessAcquisitionStatus.VERIFIED,
          acquisitionAttributedAt: now,
          acquisitionVerifiedAt: now,
          acquisitionVerifiedByUserId: reviewerUserId,
        },
      }),
      this.prisma.businessRelationshipHistory.create({
        data: {
          businessId,
          relationshipType: BusinessRelationshipType.ATTRIBUTION_CHANGE,
          affiliateUserId: claim.affiliateUserId,
          affiliateExternalId: claim.affiliateExternalId,
          actorUserId: reviewerUserId,
          newValue: 'VERIFIED_CLAIM',
          metadata: { claimId: claim.id, notes: notes ?? null } as Prisma.InputJsonValue,
        },
      }),
      ...(claim.affiliateUserId
        ? [
            this.prisma.user.update({
              where: { id: business.userId },
              data: { referredById: claim.affiliateUserId },
            }),
          ]
        : []),
      this.prisma.affiliateBusinessClaim.update({
        where: { id },
        data: {
          businessId,
          status: 'APPROVED',
          reviewedByUserId: reviewerUserId,
          reviewedAt: now,
          reviewNotes: notes?.trim() || null,
        },
      }),
    ]);

    const updatedClaim = claimResults[claimResults.length - 1];

    void this.notifyAffiliate({
      type: 'verified',
      invitationToken: null,
      prospectExternalId: claim.prospectExternalId,
      claimId: claim.id,
      businessId,
      businessName: claim.businessName,
      status: AffiliateBusinessAcquisitionStatus.VERIFIED,
      occurredAt: now.toISOString(),
    });

    return updatedClaim;
  }

  // ── Administrative verification ──────────────────────────────────────

  async verifyAcquisition(
    businessId: string,
    decision: 'VERIFIED' | 'REJECTED',
    reviewerUserId: string,
    notes?: string,
  ) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: {
        id: true,
        businessName: true,
        acquiredByAffiliateId: true,
        acquiredByAffiliateExternalId: true,
        acquisitionInvitationId: true,
        acquisitionStatus: true,
      },
    });
    if (!business) throw new NotFoundException('Business not found');
    if (!business.acquiredByAffiliateId && !business.acquiredByAffiliateExternalId) {
      throw new BadRequestException('This business has no acquisition attribution to verify.');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.businessProfile.update({
        where: { id: businessId },
        data: {
          acquisitionStatus:
            decision === 'VERIFIED'
              ? AffiliateBusinessAcquisitionStatus.VERIFIED
              : AffiliateBusinessAcquisitionStatus.REJECTED,
          ...(decision === 'VERIFIED'
            ? { acquisitionVerifiedAt: now, acquisitionVerifiedByUserId: reviewerUserId }
            : {}),
        },
      }),
      ...(business.acquisitionInvitationId
        ? [
            this.prisma.affiliateBusinessInvitation.update({
              where: { id: business.acquisitionInvitationId },
              data: {
                status:
                  decision === 'VERIFIED'
                    ? AffiliateBusinessAcquisitionStatus.VERIFIED
                    : AffiliateBusinessAcquisitionStatus.REJECTED,
                ...(decision === 'VERIFIED'
                  ? { verifiedAt: now, verifiedByUserId: reviewerUserId }
                  : {}),
              },
            }),
          ]
        : []),
      this.prisma.businessRelationshipHistory.create({
        data: {
          businessId,
          relationshipType: BusinessRelationshipType.ACQUISITION,
          affiliateUserId: business.acquiredByAffiliateId,
          affiliateExternalId: business.acquiredByAffiliateExternalId,
          actorUserId: reviewerUserId,
          previousValue: business.acquisitionStatus,
          newValue: decision,
          metadata: { notes: notes ?? null } as Prisma.InputJsonValue,
          endedAt: decision === 'REJECTED' ? now : null,
        },
      }),
    ]);

    const sourceInvitation = business.acquisitionInvitationId
      ? await this.prisma.affiliateBusinessInvitation.findUnique({
          where: { id: business.acquisitionInvitationId },
          select: { token: true, prospectExternalId: true },
        })
      : null;
    void this.notifyAffiliate({
      type: decision === 'VERIFIED' ? 'verified' : 'rejected',
      invitationToken: sourceInvitation?.token ?? null,
      prospectExternalId: sourceInvitation?.prospectExternalId ?? null,
      businessId,
      businessName: business.businessName,
      status:
        decision === 'VERIFIED'
          ? AffiliateBusinessAcquisitionStatus.VERIFIED
          : AffiliateBusinessAcquisitionStatus.REJECTED,
      occurredAt: now.toISOString(),
    });

    return { success: true, businessId, decision };
  }

  // ── Relationship history helpers ─────────────────────────────────────

  async recordAccountManagerChange(input: {
    businessId: string;
    previousManagerUserId?: string | null;
    managerUserId: string;
    actorUserId?: string | null;
  }) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.businessRelationshipHistory.updateMany({
        where: {
          businessId: input.businessId,
          relationshipType: BusinessRelationshipType.ACCOUNT_MANAGEMENT,
          endedAt: null,
        },
        data: { endedAt: now },
      }),
      this.prisma.businessRelationshipHistory.create({
        data: {
          businessId: input.businessId,
          relationshipType: BusinessRelationshipType.ACCOUNT_MANAGEMENT,
          affiliateUserId: input.managerUserId,
          actorUserId: input.actorUserId ?? null,
          previousValue: input.previousManagerUserId ?? null,
          newValue: input.managerUserId,
          metadata: { source: 'account_manager_assignment' } as Prisma.InputJsonValue,
          startedAt: now,
        },
      }),
    ]);
  }

  async recordAssignment(input: {
    businessId: string;
    relationshipType: BusinessRelationshipType;
    affiliateUserId?: string | null;
    affiliateExternalId?: string | null;
    actorUserId?: string | null;
    newValue?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.businessRelationshipHistory.create({
      data: {
        businessId: input.businessId,
        relationshipType: input.relationshipType,
        affiliateUserId: input.affiliateUserId ?? null,
        affiliateExternalId: input.affiliateExternalId ?? null,
        actorUserId: input.actorUserId ?? null,
        newValue: input.newValue ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  // ── Dashboard counters ───────────────────────────────────────────────

  async getAcquisitionSummary(params: {
    affiliateUserId?: string;
    affiliateExternalId?: string;
  }) {
    const state = await this.listAcquiredBusinesses(params);
    const counts = state.businesses.reduce<Record<string, number>>((acc, business) => {
      const key = (business.acquisitionStatus ?? 'DIRECT').toLowerCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total: state.total,
      registered: state.businesses.filter((b) => b.acquisitionStatus !== null).length,
      onboardingCompleted: counts.onboarding_completed ?? 0,
      verified: counts.verified ?? 0,
      rejected: counts.rejected ?? 0,
    };
  }

  // ── 247GBS notification ──────────────────────────────────────────────

  private async notifyAffiliate(event: Record<string, unknown>) {
    const base = (
      this.config.get<string>('AFFILIATE_SERVICE_BASE_URL') ||
      'http://localhost:7088/api/v1'
    ).replace(/\/+$/, '');
    const apiKey =
      this.config.get<string>('AFFILIATE_INTERNAL_API_KEY') ||
      process.env.AFFILIATE_INTERNAL_API_KEY ||
      '';
    if (!apiKey) return;
    try {
      await axios.post(`${base}/internal/business-acquisition/events`, event, {
        headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
        timeout: 8000,
      });
    } catch (error: any) {
      this.logger.warn(
        `Could not notify 247GBS about business acquisition event: ${
          error?.response?.data?.message || error?.message
        }`,
      );
    }
  }
}
