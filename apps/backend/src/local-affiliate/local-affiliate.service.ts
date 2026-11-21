import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AffiliateRewardUnit,
  Prisma,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { LocationAssignmentService } from '../geography/location-assignment.service';
import { generateUniqueReferralCode } from '../common/referral/referral.util';
import {
  AFFILIATE_ELIGIBLE_ROLES,
  LOCAL_AFFILIATE_TERMS_VERSION,
} from './local-affiliate.constants';
import { nextAffiliateCode } from './local-affiliate.util';
import { AffiliateRewardService } from './affiliate-reward.service';
import {
  ActivateAffiliateDto,
  AffiliatePageQueryDto,
  RegisterLocalAffiliateDto,
  UpdateLocalAffiliateDto,
} from './dto/local-affiliate.dto';

const PROFILE_SELECT = {
  id: true,
  userId: true,
  affiliateCode: true,
  status: true,
  displayName: true,
  termsVersion: true,
  termsAcceptedAt: true,
  activatedFrom: true,
  firstClickAt: true,
  firstRewardAt: true,
  createdAt: true,
  cards: {
    select: {
      provider: true,
      status: true,
      externalCardId: true,
      linkedAt: true,
    },
  },
} satisfies Prisma.LocalAffiliateProfileSelect;

@Injectable()
export class LocalAffiliateService {
  private readonly logger = new Logger(LocalAffiliateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly locationAssignment: LocationAssignmentService,
    private readonly rewards: AffiliateRewardService,
  ) {}

  // ── Links ──────────────────────────────────────────────────────────────

  private baseUrl(): string {
    const url =
      this.config.get<string>('FRONTEND_URL') ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  buildAffiliateLink(affiliateCode: string): string {
    return `${this.baseUrl()}/a/${affiliateCode}`;
  }

  buildTrackingUrl(trackingCode: string): string {
    return `${this.baseUrl()}/r/${trackingCode}`;
  }

  // ── Lookups ────────────────────────────────────────────────────────────

  async findProfile(userId: string) {
    return this.prisma.localAffiliateProfile.findUnique({
      where: { userId },
      select: PROFILE_SELECT,
    });
  }

  async requireProfile(userId: string) {
    const profile = await this.findProfile(userId);
    if (!profile) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'AFFILIATE_PROFILE_NOT_FOUND',
        errors: ['You do not have a Local Affiliate profile yet.'],
      });
    }
    return profile;
  }

  /**
   * Internal helper for other services: the caller must have an ACTIVE profile
   * to create links or redeem rewards.
   */
  async requireActiveProfile(userId: string) {
    const profile = await this.requireProfile(userId);
    if (profile.status === 'SUSPENDED') {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'AFFILIATE_SUSPENDED',
        errors: ['This affiliate profile is suspended.'],
      });
    }
    if (profile.status !== 'ACTIVE') {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'AFFILIATE_NOT_ACTIVE',
        errors: [
          'Verify your email address to finish activating your affiliate profile.',
        ],
      });
    }
    return profile;
  }

  private assertEligible(user: { role: Role }) {
    if (!AFFILIATE_ELIGIBLE_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'AFFILIATE_NOT_ELIGIBLE',
        errors: [
          user.role === Role.ADMIN
            ? 'Admin accounts cannot hold a Local Affiliate profile.'
            : 'This account type cannot hold a Local Affiliate profile.',
        ],
      });
    }
  }

  private assertTerms(dto: { termsVersion: string; acceptTerms: boolean }) {
    if (!dto.acceptTerms) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'TERMS_NOT_ACCEPTED',
        errors: ['You must accept the affiliate terms to continue.'],
      });
    }
    if (dto.termsVersion !== LOCAL_AFFILIATE_TERMS_VERSION) {
      throw new ConflictException({
        statusCode: 409,
        message: 'TERMS_VERSION_OUTDATED',
        errors: [
          `The current terms version is ${LOCAL_AFFILIATE_TERMS_VERSION}.`,
        ],
      });
    }
  }

  // ── Scenario A — activate on an existing identity ──────────────────────

  async activate(userId: string, dto: ActivateAffiliateDto) {
    this.assertTerms(dto);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        customerProfile: { select: { id: true, status: true } },
      },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    this.assertEligible(user);

    const existing = await this.findProfile(userId);
    if (existing) {
      // The source model requires routing to the existing dashboard rather
      // than creating a second affiliate identity.
      return {
        success: true,
        message: 'Local Affiliate profile already active',
        data: this.serializeProfile(existing, { alreadyActive: true }),
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const affiliateCode = await nextAffiliateCode(tx);
      const profile = await tx.localAffiliateProfile.create({
        data: {
          userId,
          affiliateCode,
          status: 'ACTIVE',
          termsVersion: dto.termsVersion,
          termsAcceptedAt: new Date(),
          activatedFrom: 'EXISTING_CHS',
          acquisitionSource: dto.inviteCode ? 'invite' : null,
          acquisitionRef: dto.inviteCode ?? null,
          displayName: null,
        },
        select: PROFILE_SELECT,
      });
      await tx.localAffiliateCard.create({
        data: { localAffiliateId: profile.id, provider: 'vcard', status: 'NOT_LINKED' },
      });
      return profile;
    });

    return {
      success: true,
      message: 'Local Affiliate profile activated',
      data: this.serializeProfile(created, { alreadyActive: false }),
    };
  }

  // ── Scenario B — new identity + profile in one journey ─────────────────

  async register(dto: RegisterLocalAffiliateDto, meta?: { ip?: string }) {
    this.assertTerms(dto);

    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'EMAIL_ALREADY_REGISTERED',
        errors: [
          'An account with this email already exists. Sign in and activate your affiliate profile instead.',
        ],
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    let createdUserId: string;
    let profile;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const referralCode = await generateUniqueReferralCode(tx as any);
        const user = await tx.user.create({
          data: {
            email,
            password: passwordHash,
            role: Role.CUSTOMER,
            registrationSource: 'local-affiliate',
            referralCode,
            firstName: dto.firstName ?? '',
            lastName: dto.lastName ?? '',
            wallet: { create: { balance: 0, currency: 'GBP', status: 'ACTIVE' } },
            customerProfile: { create: {} },
          },
          include: { customerProfile: true },
        });

        const affiliateCode = await nextAffiliateCode(tx);
        const profile = await tx.localAffiliateProfile.create({
          data: {
            userId: user.id,
            affiliateCode,
            // A newly created identity still has to verify. Until then the
            // profile exists but cannot create links (FR-1.2.5).
            status: 'PENDING',
            termsVersion: dto.termsVersion,
            termsAcceptedAt: new Date(),
            activatedFrom: 'NEW_CHS',
            acquisitionSource: dto.inviteCode ? 'invite' : null,
            acquisitionRef: dto.inviteCode ?? null,
            displayName: [dto.firstName, dto.lastName]
              .filter(Boolean)
              .join(' ') || null,
          },
          select: PROFILE_SELECT,
        });

        await tx.localAffiliateCard.create({
          data: {
            localAffiliateId: profile.id,
            provider: 'vcard',
            status: 'NOT_LINKED',
          },
        });

        if (dto.phone || dto.postcode) {
          await tx.customerProfile.update({
            where: { userId: user.id },
            data: {
              ...(dto.phone ? { phone: dto.phone } : {}),
              ...(dto.postcode ? { postcode: dto.postcode.toUpperCase() } : {}),
            },
          });
        }

        return { user, profile };
      });
      createdUserId = result.user.id;
      profile = result.profile;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          statusCode: 409,
          message: 'EMAIL_ALREADY_REGISTERED',
          errors: [
            'An account with this email already exists. Sign in and activate your affiliate profile instead.',
          ],
        });
      }
      throw error;
    }

    // Location assignment is best-effort: registration already committed.
    if (dto.postcode) {
      try {
        const resolved = await this.locationAssignment.resolvePostcode(
          dto.postcode,
        );
        const customer = await this.prisma.customerProfile.findUnique({
          where: { userId: createdUserId },
          select: { id: true },
        });
        if (customer && resolved) {
          await this.locationAssignment.assignCustomer(
            customer.id,
            resolved.postcode,
            resolved,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Affiliate registration: location assignment failed for ${createdUserId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const fullUser = await this.prisma.user.findUnique({
      where: { id: createdUserId },
    });
    const tokens = await this.auth.login(fullUser, { ip: meta?.ip });

    return {
      ...tokens,
      success: true,
      data: {
        ...this.serializeProfile(profile!, { alreadyActive: false }),
        emailVerified: false,
      },
    };
  }

  /**
   * Completes email verification for a PENDING affiliate profile.
   *
   * The OTP itself is owned by AuthService (the platform already has a
   * verification mechanism); this only flips the affiliate profile once the
   * code is proven. Without this, Scenario B would strand a new user in
   * PENDING with no way to start sharing.
   */
  async verifyEmail(userId: string, code: string) {
    const profile = await this.findProfile(userId);
    if (!profile) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'AFFILIATE_PROFILE_NOT_FOUND',
        errors: ['You do not have a Local Affiliate profile yet.'],
      });
    }
    if (profile.status === 'ACTIVE') {
      return { success: true, data: { status: 'ACTIVE', alreadyVerified: true } };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const valid = await this.auth.verifyOtp(user.email, code);
    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'INVALID_VERIFICATION_CODE',
        errors: ['That code is not valid or has expired.'],
      });
    }

    await this.prisma.localAffiliateProfile.update({
      where: { id: profile.id },
      data: { status: 'ACTIVE', approvedAt: new Date() },
    });

    return { success: true, data: { status: 'ACTIVE', alreadyVerified: false } };
  }

  /** Sends (or resends) the verification code to the affiliate's email. */
  async sendVerificationCode(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.auth.sendOtp(user.email);
    return { success: true, message: 'Verification code sent' };
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async me(userId: string) {
    const profile = await this.findProfile(userId);
    if (!profile) {
      return { success: true, data: null };
    }
    const balances = await this.rewards.getBalances(
      profile.id,
      AffiliateRewardUnit.POINTS,
    );
    return {
      success: true,
      data: {
        ...this.serializeProfile(profile, { alreadyActive: true }),
        balances,
      },
    };
  }

  async update(userId: string, dto: UpdateLocalAffiliateDto) {
    const profile = await this.requireProfile(userId);
    const updated = await this.prisma.localAffiliateProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      },
      select: PROFILE_SELECT,
    });
    return {
      success: true,
      data: this.serializeProfile(updated, { alreadyActive: true }),
    };
  }

  async link(userId: string) {
    const profile = await this.requireProfile(userId);
    return {
      success: true,
      data: {
        affiliateCode: profile.affiliateCode,
        personalPageUrl: this.buildAffiliateLink(profile.affiliateCode),
        qrPayload: this.buildAffiliateLink(profile.affiliateCode),
        status: profile.status,
      },
    };
  }

  async activitySummary(userId: string) {
    const profile = await this.requireProfile(userId);

    const [clicks, conversions, byType, byStatus] = await Promise.all([
      this.prisma.affiliateClick.count({
        where: { trackingLink: { localAffiliateId: profile.id } },
      }),
      this.prisma.affiliateConversion.count({
        where: { localAffiliateId: profile.id },
      }),
      this.prisma.affiliateConversion.groupBy({
        by: ['eventType'],
        where: { localAffiliateId: profile.id },
        _count: { _all: true },
      }),
      this.prisma.affiliateConversion.groupBy({
        by: ['status'],
        where: { localAffiliateId: profile.id },
        _count: { _all: true },
      }),
    ]);

    const balances = await this.rewards.getBalances(
      profile.id,
      AffiliateRewardUnit.POINTS,
    );

    return {
      success: true,
      data: {
        clicks,
        conversions,
        byEventType: Object.fromEntries(
          byType.map((row) => [row.eventType, row._count._all]),
        ),
        byStatus: Object.fromEntries(
          byStatus.map((row) => [row.status, row._count._all]),
        ),
        rewards: balances,
      },
    };
  }

  async activity(userId: string, query: AffiliatePageQueryDto) {
    const profile = await this.requireProfile(userId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Prisma.AffiliateConversionWhereInput = {
      localAffiliateId: profile.id,
      ...(query.type ? { eventType: query.type as any } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.affiliateConversion.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ledger: {
            select: {
              units: true,
              unit: true,
              status: true,
              explanationCode: true,
              explanationText: true,
            },
          },
        },
      }),
      this.prisma.affiliateConversion.count({ where }),
    ]);

    const offerIds = [...new Set(items.map((i) => i.offerId).filter(Boolean))] as string[];
    const offers = offerIds.length
      ? await this.prisma.affiliateOffer.findMany({
          where: { id: { in: offerIds } },
          select: { id: true, title: true, slug: true, imageUrl: true },
        })
      : [];
    const offerMap = new Map(offers.map((o) => [o.id, o]));

    return {
      success: true,
      data: items.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        status: item.status,
        amountMinor: item.amountMinor,
        currency: item.currency,
        occurredAt: item.occurredAt,
        offer: item.offerId ? offerMap.get(item.offerId) ?? null : null,
        reward: item.ledger?.[0] ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async clicks(userId: string, query: AffiliatePageQueryDto) {
    const profile = await this.requireProfile(userId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Prisma.AffiliateClickWhereInput = {
      trackingLink: { localAffiliateId: profile.id },
    };

    const [items, total] = await Promise.all([
      this.prisma.affiliateClick.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          occurredAt: true,
          source: true,
          convertedAt: true,
          trackingLink: {
            select: {
              code: true,
              offer: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.affiliateClick.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ── Admin helpers ──────────────────────────────────────────────────────

  async adminList(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Prisma.LocalAffiliateProfileWhereInput = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { affiliateCode: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.localAffiliateProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              customerProfile: {
                select: {
                  cityId: true,
                  boroughId: true,
                  localMallId: true,
                  postcode: true,
                },
              },
            },
          },
          _count: { select: { trackingLinks: true, rewardLedger: true } },
        },
      }),
      this.prisma.localAffiliateProfile.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async adminDetail(id: string) {
    const profile = await this.prisma.localAffiliateProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
          },
        },
        cards: true,
        _count: { select: { trackingLinks: true } },
      },
    });
    if (!profile) throw new NotFoundException('Affiliate not found');

    const [balances, ledger, conversions] = await Promise.all([
      this.rewards.getBalances(profile.id, AffiliateRewardUnit.POINTS),
      this.prisma.affiliateRewardLedger.findMany({
        where: { localAffiliateId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.affiliateConversion.findMany({
        where: { localAffiliateId: profile.id },
        orderBy: { occurredAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      success: true,
      data: { profile, balances, ledger, conversions },
    };
  }

  async setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED', reason?: string) {
    const profile = await this.prisma.localAffiliateProfile.findUnique({
      where: { id },
    });
    if (!profile) throw new NotFoundException('Affiliate not found');

    await this.prisma.localAffiliateProfile.update({
      where: { id },
      data: {
        status,
        suspendedReason: status === 'SUSPENDED' ? reason ?? 'Suspended by admin' : null,
      },
    });

    return {
      success: true,
      message: `Affiliate ${status.toLowerCase()}`,
      data: { id, status },
    };
  }

  /**
   * Marks a pending profile as active once the email is verified.
   * Called from the affiliate read path so verification is honoured without a
   * new auth hook.
   */
  async syncPendingToActive(userId: string): Promise<boolean> {
    const profile = await this.prisma.localAffiliateProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!profile || profile.status !== 'PENDING') return false;

    await this.prisma.localAffiliateProfile.update({
      where: { id: profile.id },
      data: { status: 'ACTIVE', approvedAt: new Date() },
    });
    return true;
  }

  // ── Serialisation ──────────────────────────────────────────────────────

  private serializeProfile(
    profile: {
      id: string;
      affiliateCode: string;
      status: string;
      displayName: string | null;
      createdAt: Date;
      cards?: Array<{ provider: string; status: string }>;
    },
    opts: { alreadyActive: boolean },
  ) {
    const card = profile.cards?.find((c) => c.provider === 'vcard');
    return {
      id: profile.id,
      affiliateCode: profile.affiliateCode,
      status: profile.status,
      displayName: profile.displayName,
      affiliateLink: this.buildAffiliateLink(profile.affiliateCode),
      cardStatus: card?.status ?? 'NOT_LINKED',
      createdAt: profile.createdAt,
      alreadyActive: opts.alreadyActive,
    };
  }
}
