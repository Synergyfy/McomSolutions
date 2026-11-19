import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AffiliateOfferStatus,
  AffiliateProviderType,
  AffiliateRewardRule,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocalAffiliateService } from './local-affiliate.service';
import { OfferQueryDto, CreateOfferLinkDto } from './dto/affiliate-offer.dto';
import {
  appendQueryParam,
  generateTrackingCode,
} from './local-affiliate.util';

interface EligibilityShape {
  cityIds?: string[];
  boroughIds?: string[];
  highStreetIds?: string[];
  localMallIds?: string[];
  tiers?: string[];
  statuses?: string[];
}

@Injectable()
export class AffiliateCatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly affiliates: LocalAffiliateService,
  ) {}

  // ── Marketplace ────────────────────────────────────────────────────────

  async listOffers(query: OfferQueryDto, userId?: string) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const activeOn = query.activeOn ? new Date(query.activeOn) : new Date();

    const context = userId ? await this.loadContext(userId) : null;

    const where: Prisma.AffiliateOfferWhereInput = {
      status: AffiliateOfferStatus.ACTIVE,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: activeOn } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: activeOn } }] },
      ],
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.provider ? { provider: { code: query.provider } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { subtitle: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows] = await Promise.all([
      this.prisma.affiliateOffer.findMany({
        where,
        orderBy:
          query.sort === 'title'
            ? { title: query.order === 'asc' ? 'asc' : 'desc' }
            : { createdAt: query.order === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          provider: { select: { code: true, name: true, type: true, integrationLevel: true } },
          category: { select: { slug: true, name: true } },
          externalBusiness: { select: { id: true, name: true } },
        },
      }),
      this.prisma.affiliateOffer.count({ where }),
    ]);

    // Eligibility is applied after the query because it depends on JSON scope
    // data that Postgres cannot filter cheaply. The catalogue is small enough
    // in Phase 1 for this to be correct and simple; revisit at scale.
    const filtered = rows.filter((offer) =>
      this.isEligible(offer, context, false),
    );

    const rewardRules = await this.loadRules(filtered.map((o) => o.rewardRuleId));

    return {
      success: true,
      data: filtered.map((offer) =>
        this.serializeOffer(offer, rewardRules.get(offer.rewardRuleId ?? ''), {
          canPromote: context ? this.canPromote(offer, context) : false,
        }),
      ),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    };
  }

  async getOffer(slug: string, userId?: string) {
    const offer = await this.prisma.affiliateOffer.findUnique({
      where: { slug },
      include: {
        provider: {
          select: { code: true, name: true, type: true, integrationLevel: true },
        },
        category: { select: { slug: true, name: true } },
        externalBusiness: { select: { id: true, name: true } },
      },
    });
    if (!offer || offer.status !== AffiliateOfferStatus.ACTIVE) {
      throw new NotFoundException('Offer not found');
    }

    const context = userId ? await this.loadContext(userId) : null;
    const ruleMap = await this.loadRules([offer.rewardRuleId]);

    return {
      success: true,
      data: this.serializeOffer(offer, ruleMap.get(offer.rewardRuleId ?? ''), {
        canPromote: context ? this.canPromote(offer, context) : false,
        blockedReason:
          context && !this.canPromote(offer, context)
            ? this.blockedReason(offer, context)
            : undefined,
      }),
    };
  }

  async listCampaigns(userId?: string) {
    const now = new Date();
    const campaigns = await this.prisma.affiliateCampaign.findMany({
      where: {
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { offers: true } } },
    });

    void userId;
    return { success: true, data: campaigns };
  }

  async getCampaign(code: string) {
    const campaign = await this.prisma.affiliateCampaign.findUnique({
      where: { code },
      include: {
        offers: {
          include: {
            offer: {
              include: {
                provider: { select: { code: true, name: true } },
                category: { select: { slug: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return { success: true, data: campaign };
  }

  // ── Link creation ──────────────────────────────────────────────────────

  async createLink(userId: string, offerId: string, dto: CreateOfferLinkDto) {
    const profile = await this.affiliates.requireActiveProfile(userId);

    const offer = await this.prisma.affiliateOffer.findUnique({
      where: { id: offerId },
      include: { provider: true },
    });
    if (!offer || offer.status !== AffiliateOfferStatus.ACTIVE) {
      throw new NotFoundException('Offer not found or not active');
    }

    const context = await this.loadContext(userId);
    if (!this.canPromote(offer, context)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'OFFER_NOT_ELIGIBLE',
        errors: [this.blockedReason(offer, context)],
      });
    }

    if (dto.campaignId) {
      const link = await this.prisma.affiliateCampaignOffer.findUnique({
        where: {
          campaignId_offerId: { campaignId: dto.campaignId, offerId: offer.id },
        },
      });
      if (!link) {
        throw new BadRequestException(
          'This offer is not part of the requested campaign',
        );
      }
    }

    const campaignKey = dto.campaignId ?? '';
    const existing = await this.prisma.affiliateTrackingLink.findUnique({
      where: {
        localAffiliateId_offerId_campaignKey: {
          localAffiliateId: profile.id,
          offerId: offer.id,
          campaignKey,
        },
      },
    });

    const link =
      existing ??
      (await this.prisma.affiliateTrackingLink.create({
        data: {
          code: await this.allocateTrackingCode(),
          localAffiliateId: profile.id,
          offerId: offer.id,
          campaignId: dto.campaignId ?? null,
          campaignKey,
          providerId: offer.providerId,
          destinationUrl: offer.destinationUrl,
        },
      }));

    const providerUrl = this.buildProviderUrl(link.code, offer);

    if (providerUrl !== link.providerLinkUrl) {
      await this.prisma.affiliateTrackingLink.update({
        where: { id: link.id },
        data: { providerLinkUrl: providerUrl },
      });
    }

    return {
      success: true,
      data: {
        trackingCode: link.code,
        trackingUrl: this.affiliates.buildTrackingUrl(link.code),
        destinationUrl: providerUrl,
        qrPayload: this.affiliates.buildTrackingUrl(link.code),
        offerId: offer.id,
        campaignId: dto.campaignId ?? null,
      },
    };
  }

  /**
   * Builds the provider-specific destination for a tracking code.
   *
   * Exactly one opaque value (`code`) is appended — never the affiliate code,
   * offer id or campaign id. Providers resolve it back to us.
   */
  buildProviderUrl(
    trackingCode: string,
    offer: {
      destinationUrl: string;
      provider: { code: string; type: AffiliateProviderType };
    },
  ): string {
    const providerCode = offer.provider.code.toLowerCase();

    if (providerCode === 'thrivecart') {
      // ThriveCart passthrough variables are echoed back in order webhooks.
      return appendQueryParam(
        offer.destinationUrl,
        'passthrough[la_tracking_id]',
        trackingCode,
      );
    }

    if (providerCode === 'awin') {
      // Awin attribution rides on clickRef — the only field a publisher is
      // always allowed to read back.
      return appendQueryParam(offer.destinationUrl, 'clickref', trackingCode);
    }

    // Internal platforms (Mall) and external businesses accept a generic
    // `laf` parameter; a Level 1 sit that ignores it still records our click.
    return appendQueryParam(offer.destinationUrl, 'laf', trackingCode);
  }

  private async allocateTrackingCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = generateTrackingCode();
      const clash = await this.prisma.affiliateTrackingLink.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    throw new Error('Could not allocate a unique tracking code');
  }

  // ── Eligibility ────────────────────────────────────────────────────────

  private async loadContext(userId: string) {
    const [profile, customer] = await Promise.all([
      this.prisma.localAffiliateProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          status: true,
          userId: true,
          user: { select: { role: true } },
        },
      }),
      this.prisma.customerProfile.findUnique({
        where: { userId },
        select: {
          cityId: true,
          boroughId: true,
          highStreetId: true,
          localMallId: true,
        },
      }),
    ]);
    const business = await this.prisma.businessProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return {
      profile,
      location: customer,
      businessId: business?.id ?? null,
    };
  }

  private isEligible(
    offer: { eligibilityScope: string; eligibility: Prisma.JsonValue },
    context: Awaited<ReturnType<AffiliateCatalogueService['loadContext']>> | null,
    requireAffiliate: boolean,
  ): boolean {
    void requireAffiliate;
    if (offer.eligibilityScope === 'GLOBAL' || !offer.eligibility) return true;
    if (!context) return false;

    const scope = (offer.eligibility ?? {}) as EligibilityShape;
    const loc = context.location;

    switch (offer.eligibilityScope) {
      case 'CITY':
        return !!loc?.cityId && (scope.cityIds ?? []).includes(loc.cityId);
      case 'BOROUGH':
        return (
          !!loc?.boroughId && (scope.boroughIds ?? []).includes(loc.boroughId)
        );
      case 'HIGH_STREET':
        return (
          !!loc?.highStreetId &&
          (scope.highStreetIds ?? []).includes(loc.highStreetId)
        );
      case 'LOCAL_MALL':
        return (
          !!loc?.localMallId &&
          (scope.localMallIds ?? []).includes(loc.localMallId)
        );
      case 'MEMBERSHIP_TIER':
        // Tier gating is evaluated by the membership surface in a later phase.
        return true;
      case 'AFFILIATE_STATUS':
        return (
          !!context.profile && (scope.statuses ?? ['ACTIVE']).includes(context.profile.status)
        );
      default:
        return true;
    }
  }

  private canPromote(
    offer: { businessId?: string | null; allowOwnerPromotion: boolean },
    context: Awaited<ReturnType<AffiliateCatalogueService['loadContext']>>,
  ): boolean {
    if (!context.profile || context.profile.status !== 'ACTIVE') return false;
    if (
      offer.businessId &&
      context.businessId &&
      offer.businessId === context.businessId &&
      !offer.allowOwnerPromotion
    ) {
      return false;
    }
    return true;
  }

  private blockedReason(
    offer: any,
    context: Awaited<ReturnType<AffiliateCatalogueService['loadContext']>>,
  ): string {
    if (!context.profile) return 'Activate your affiliate profile to share offers.';
    if (context.profile.status !== 'ACTIVE') {
      return 'Verify your email address to start sharing offers.';
    }
    if (offer.businessId && offer.businessId === context.businessId) {
      return 'You cannot promote your own business’s offers.';
    }
    return 'This offer is not available in your area yet.';
  }

  // ── Serialisation ──────────────────────────────────────────────────────

  private async loadRules(ids: Array<string | null | undefined>) {
    const clean = [...new Set(ids.filter(Boolean))] as string[];
    if (clean.length === 0) return new Map<string, AffiliateRewardRule>();
    const rules = await this.prisma.affiliateRewardRule.findMany({
      where: { id: { in: clean } },
    });
    return new Map(rules.map((r) => [r.id, r]));
  }

  private serializeOffer(
    offer: any,
    rule: AffiliateRewardRule | undefined,
    extra: { canPromote: boolean; blockedReason?: string },
  ) {
    return {
      id: offer.id,
      slug: offer.slug,
      title: offer.title,
      subtitle: offer.subtitle,
      description: offer.description,
      imageUrl: offer.imageUrl,
      media: offer.media,
      source: {
        providerCode: offer.provider?.code ?? null,
        providerName: offer.provider?.name ?? null,
        providerType: offer.provider?.type ?? null,
        businessName: offer.externalBusiness?.name ?? null,
      },
      category: offer.category ?? null,
      customerBenefit: offer.customerBenefit,
      redemptionMethod: offer.redemptionMethod,
      integrationLevel: offer.integrationLevel,
      reward: rule
        ? {
            id: rule.id,
            version: rule.version,
            qualifyingEvent: rule.qualifyingEvent,
            rewardType: rule.rewardType,
            unit: rule.unit,
            calculation: rule.calculation,
            fixedUnits: rule.fixedUnits,
            percentage: rule.percentage,
            approvalMode: rule.approvalMode,
          }
        : null,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
      canPromote: extra.canPromote,
      blockedReason: extra.blockedReason,
    };
  }
}
