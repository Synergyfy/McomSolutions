import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AffiliateCampaignStatus,
  AffiliateIntegrationLevel,
  AffiliateOfferStatus,
  AffiliateProviderStatus,
  AffiliateRewardUnit,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateRewardService } from './affiliate-reward.service';
import { encrypt } from '../console/crypto.util';
import {
  isHttpUrl,
  nextAffiliateCode,
  uniqueSlug,
} from './local-affiliate.util';
import type { ConfigService } from '@nestjs/config';
import { ConfigService as ConfigServiceToken } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import {
  AdminPageQueryDto,
  ConversionQueryDto,
  CreateCampaignDto,
  CreateExternalBusinessDto,
  CreateOfferDto,
  CreateProviderAccountDto,
  CreateProviderDto,
  CreateRewardRuleDto,
  ReconciliationQueryDto,
  UpdateOfferDto,
  UpdateProviderDto,
} from './dto/affiliate-admin.dto';

@Injectable()
export class AffiliateAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewards: AffiliateRewardService,
    @Inject(ConfigServiceToken) private readonly config: ConfigService,
  ) {}

  // ── Providers ──────────────────────────────────────────────────────────

  async listProviders() {
    const providers = await this.prisma.affiliateProvider.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        accounts: {
          select: {
            id: true,
            label: true,
            externalAccountId: true,
            status: true,
            lastSyncedAt: true,
            lastSyncError: true,
            // credentialsEncrypted is deliberately never selected
          },
        },
        _count: { select: { offers: true, products: true } },
      },
    });
    return { success: true, data: providers };
  }

  async createProvider(dto: CreateProviderDto) {
    const existing = await this.prisma.affiliateProvider.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Provider code '${dto.code}' already exists`);
    }

    const created = await this.prisma.affiliateProvider.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        integrationLevel: dto.integrationLevel,
        supportedEvents: dto.supportedEvents ?? [],
        supportedRewardTypes: dto.supportedRewardTypes ?? [],
        requiresManualApproval: dto.requiresManualApproval ?? false,
        featureFlag: dto.featureFlag ?? null,
        notes: dto.notes ?? null,
        status: AffiliateProviderStatus.DRAFT,
      },
    });
    return { success: true, data: created };
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    await this.requireProvider(id);
    const updated = await this.prisma.affiliateProvider.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.integrationLevel !== undefined
          ? { integrationLevel: dto.integrationLevel }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status as AffiliateProviderStatus }
          : {}),
        ...(dto.supportedEvents !== undefined
          ? { supportedEvents: dto.supportedEvents }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    return { success: true, data: updated };
  }

  /**
   * Structural connectivity check. Phase 1 has no live provider adapters, so
   * this reports what is configured rather than pretending to call out.
   */
  async testProvider(id: string) {
    const provider = await this.prisma.affiliateProvider.findUnique({
      where: { id },
      include: { accounts: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const checks = [
      {
        name: 'Provider record',
        passed: true,
        detail: `${provider.name} (${provider.code})`,
      },
      {
        name: 'Account configured',
        passed: provider.accounts.length > 0,
        detail:
          provider.accounts.length > 0
            ? `${provider.accounts.length} account(s)`
            : 'No provider account has been added yet',
      },
      {
        name: 'Credentials stored',
        passed: provider.accounts.some((a) => !!a.credentialsEncrypted),
        detail: provider.accounts.some((a) => !!a.credentialsEncrypted)
          ? 'Encrypted credentials present'
          : 'No credentials stored',
      },
      {
        name: 'Verifiable events declared',
        passed: provider.supportedEvents.length > 0,
        detail: `${provider.supportedEvents.length} event(s)`,
      },
    ];

    const passed = checks.every((c) => c.passed);
    await this.prisma.affiliateProvider.update({
      where: { id },
      data: {
        status: passed
          ? AffiliateProviderStatus.CONNECTED
          : provider.status === AffiliateProviderStatus.DRAFT
            ? AffiliateProviderStatus.DRAFT
            : provider.status,
      },
    });

    return { success: true, data: { passed, checks } };
  }

  async createProviderAccount(providerId: string, dto: CreateProviderAccountDto) {
    await this.requireProvider(providerId);
    const keyHex = this.config.get<string>('CONSOLE_ENCRYPTION_KEY');
    if (dto.credentials && !keyHex) {
      throw new BadRequestException(
        'CONSOLE_ENCRYPTION_KEY is not configured; refusing to store credentials in plain text.',
      );
    }

    const account = await this.prisma.affiliateProviderAccount.create({
      data: {
        providerId,
        label: dto.label,
        externalAccountId: dto.externalAccountId,
        credentialsEncrypted: dto.credentials
          ? encrypt(dto.credentials, keyHex!)
          : null,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      data: {
        id: account.id,
        label: account.label,
        externalAccountId: account.externalAccountId,
        hasCredentials: !!account.credentialsEncrypted,
      },
    };
  }

  async syncProvider() {
    // Phase 1 ships the Mall (push) and manual/redemption providers only.
    // Pull-based adapters (Awin) arrive in Phase 4 and are feature-flagged.
    return {
      success: true,
      data: {
        started: false,
        reason:
          'No pull-based provider adapter is enabled in this release. Conversions arrive by webhook/push or manual confirmation.',
      },
    };
  }

  // ── External businesses ────────────────────────────────────────────────

  async listExternalBusinesses(query: AdminPageQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.ExternalBusinessWhereInput = {
      ...(query.status ? { verificationStatus: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.externalBusiness.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.externalBusiness.count({ where }),
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

  async createExternalBusiness(dto: CreateExternalBusinessDto, adminUserId: string) {
    void adminUserId;
    const created = await this.prisma.externalBusiness.create({
      data: {
        ...dto,
        verificationStatus: 'PENDING',
      },
    });
    return { success: true, data: created };
  }

  async verifyExternalBusiness(id: string, adminUserId: string) {
    await this.requireExternalBusiness(id);
    const updated = await this.prisma.externalBusiness.update({
      where: { id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedByUserId: adminUserId,
      },
    });
    return { success: true, data: updated };
  }

  // ── Reward rules ───────────────────────────────────────────────────────

  async listRewardRules() {
    const rules = await this.prisma.affiliateRewardRule.findMany({
      orderBy: { version: 'desc' },
    });
    return { success: true, data: rules };
  }

  /**
   * Publishes a new immutable rule version. Existing conversions keep pointing
   * at the version that was current when they happened.
   */
  async createRewardRule(dto: CreateRewardRuleDto, adminUserId: string) {
    if (dto.calculation === 'PERCENTAGE') {
      if (dto.percentage === undefined) {
        throw new BadRequestException('percentage is required for PERCENTAGE rules');
      }
      if (dto.unit === AffiliateRewardUnit.POINTS && dto.pointsPerCurrencyUnit === undefined) {
        throw new BadRequestException(
          'pointsPerCurrencyUnit is required when unit=POINTS and calculation=PERCENTAGE',
        );
      }
    }
    if (dto.calculation === 'FIXED' && dto.fixedUnits === undefined) {
      throw new BadRequestException('fixedUnits is required for FIXED rules');
    }
    if (dto.rewardType === 'CREDIT' && process.env.AFFILIATE_CASHBACK_ENABLED !== 'true') {
      throw new BadRequestException(
        'Cashback rewards are not enabled in this release. Use POINTS or VOUCHER.',
      );
    }

    const latest = await this.prisma.affiliateRewardRule.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.affiliateRewardRule.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.affiliateRewardRule.create({
        data: {
          version,
          isCurrent: true,
          name: dto.name,
          qualifyingEvent: dto.qualifyingEvent,
          rewardType: dto.rewardType,
          calculation: dto.calculation ?? 'FIXED',
          unit: dto.unit ?? 'POINTS',
          fixedUnits:
            dto.fixedUnits !== undefined ? new Prisma.Decimal(dto.fixedUnits) : null,
          percentage:
            dto.percentage !== undefined ? new Prisma.Decimal(dto.percentage) : null,
          pointsPerCurrencyUnit:
            dto.pointsPerCurrencyUnit !== undefined
              ? new Prisma.Decimal(dto.pointsPerCurrencyUnit)
              : null,
          tiers: (dto.tiers ?? null) as Prisma.InputJsonValue | null,
          maxRewardUnits:
            dto.maxRewardUnits !== undefined
              ? new Prisma.Decimal(dto.maxRewardUnits)
              : null,
          minPurchaseMinor: dto.minPurchaseMinor ?? null,
          approvalMode: dto.approvalMode ?? 'ADMIN_CONFIRMATION',
          reversalPolicy: dto.reversalPolicy ?? 'REVERSE_ON_REFUND',
          expiryDays: dto.expiryDays ?? null,
          capPerAffiliateUnits:
            dto.capPerAffiliateUnits !== undefined
              ? new Prisma.Decimal(dto.capPerAffiliateUnits)
              : null,
          capPerCampaignUnits:
            dto.capPerCampaignUnits !== undefined
              ? new Prisma.Decimal(dto.capPerCampaignUnits)
              : null,
          createdByUserId: adminUserId,
        },
      });
    });

    return { success: true, data: created };
  }

  /** Preview a rule against a basket amount — used by the admin editor. */
  async previewRule(ruleId: string, amountMinor: number) {
    const rule = await this.prisma.affiliateRewardRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule) throw new NotFoundException('Reward rule not found');
    const result = this.rewards.calculate(rule, amountMinor);
    return {
      success: true,
      data: {
        units: Number(result.units),
        unit: rule.unit,
        meta: result.meta,
      },
    };
  }

  // ── Offers ─────────────────────────────────────────────────────────────

  async listOffersAdmin(query: AdminPageQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.AffiliateOfferWhereInput = {
      ...(query.status ? { status: query.status as AffiliateOfferStatus } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.affiliateOffer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          provider: { select: { code: true, name: true, integrationLevel: true } },
          category: { select: { slug: true, name: true } },
          externalBusiness: { select: { id: true, name: true } },
        },
      }),
      this.prisma.affiliateOffer.count({ where }),
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

  async createOffer(dto: CreateOfferDto, adminUserId: string) {
    const provider = await this.requireProvider(dto.providerId);

    if (!isHttpUrl(dto.destinationUrl)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'INVALID_DESTINATION_URL',
        errors: ['destinationUrl must be an absolute http(s) URL'],
      });
    }

    if (dto.rewardRuleId) {
      const rule = await this.prisma.affiliateRewardRule.findUnique({
        where: { id: dto.rewardRuleId },
      });
      if (!rule) throw new NotFoundException('Reward rule not found');
      // Hard gate: an offer can never promise an event the provider cannot
      // verify. This is the §16 rule, enforced in code.
      this.rewards.assertVerifiable(provider.integrationLevel, rule.qualifyingEvent);
    }

    const created = await this.prisma.affiliateOffer.create({
      data: {
        slug: uniqueSlug(dto.title),
        providerId: dto.providerId,
        productId: dto.productId ?? null,
        businessId: dto.businessId ?? null,
        externalBusinessId: dto.externalBusinessId ?? null,
        categoryId: dto.categoryId ?? null,
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        destinationUrl: dto.destinationUrl,
        integrationLevel: provider.integrationLevel,
        trackingMethod: dto.trackingMethod ?? 'INTERNAL_REDIRECT',
        eligibilityScope: dto.eligibilityScope ?? 'GLOBAL',
        eligibility: (dto.eligibility ?? null) as Prisma.InputJsonValue | null,
        customerBenefit: (dto.customerBenefit ?? null) as Prisma.InputJsonValue | null,
        rewardRuleId: dto.rewardRuleId ?? null,
        redemptionMethod: dto.redemptionMethod ?? 'NONE',
        holdDays: dto.holdDays ?? 0,
        status: AffiliateOfferStatus.DRAFT,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        allowOwnerPromotion: dto.allowOwnerPromotion ?? false,
        identityUnverifiable:
          provider.integrationLevel === AffiliateIntegrationLevel.LINK_ONLY ||
          provider.integrationLevel === AffiliateIntegrationLevel.REDEMPTION_CODE,
        createdByUserId: adminUserId,
      },
    });

    return { success: true, data: created };
  }

  async updateOffer(id: string, dto: UpdateOfferDto) {
    const offer = await this.requireOffer(id);
    const provider = await this.prisma.affiliateProvider.findUnique({
      where: { id: dto.providerId ?? offer.providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    if (dto.destinationUrl && !isHttpUrl(dto.destinationUrl)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'INVALID_DESTINATION_URL',
        errors: ['destinationUrl must be an absolute http(s) URL'],
      });
    }

    const ruleId = dto.rewardRuleId ?? offer.rewardRuleId;
    if (ruleId) {
      const rule = await this.prisma.affiliateRewardRule.findUnique({
        where: { id: ruleId },
      });
      if (!rule) throw new NotFoundException('Reward rule not found');
      this.rewards.assertVerifiable(provider.integrationLevel, rule.qualifyingEvent);
    }

    const updated = await this.prisma.affiliateOffer.update({
      where: { id },
      data: {
        ...(dto.providerId !== undefined ? { providerId: dto.providerId } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.destinationUrl !== undefined
          ? { destinationUrl: dto.destinationUrl }
          : {}),
        ...(dto.eligibilityScope !== undefined
          ? { eligibilityScope: dto.eligibilityScope }
          : {}),
        ...(dto.eligibility !== undefined
          ? { eligibility: dto.eligibility as Prisma.InputJsonValue }
          : {}),
        ...(dto.customerBenefit !== undefined
          ? { customerBenefit: dto.customerBenefit as Prisma.InputJsonValue }
          : {}),
        ...(dto.rewardRuleId !== undefined ? { rewardRuleId: dto.rewardRuleId } : {}),
        ...(dto.redemptionMethod !== undefined
          ? { redemptionMethod: dto.redemptionMethod }
          : {}),
        ...(dto.holdDays !== undefined ? { holdDays: dto.holdDays } : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.endsAt !== undefined
          ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }
          : {}),
        ...(dto.allowOwnerPromotion !== undefined
          ? { allowOwnerPromotion: dto.allowOwnerPromotion }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status as AffiliateOfferStatus }
          : {}),
      },
    });

    return { success: true, data: updated };
  }

  async approveOffer(id: string, adminUserId: string) {
    const offer = await this.requireOffer(id);
    if (!isHttpUrl(offer.destinationUrl)) {
      throw new BadRequestException('Offer destination URL is not valid');
    }
    if (offer.rewardRuleId) {
      const [rule, provider] = await Promise.all([
        this.prisma.affiliateRewardRule.findUnique({
          where: { id: offer.rewardRuleId },
        }),
        this.prisma.affiliateProvider.findUnique({
          where: { id: offer.providerId },
        }),
      ]);
      if (rule && provider) {
        this.rewards.assertVerifiable(provider.integrationLevel, rule.qualifyingEvent);
      }
    }

    const updated = await this.prisma.affiliateOffer.update({
      where: { id },
      data: {
        status: AffiliateOfferStatus.ACTIVE,
        approvedByUserId: adminUserId,
        approvedAt: new Date(),
      },
    });
    return { success: true, data: updated };
  }

  async setOfferStatus(id: string, status: AffiliateOfferStatus) {
    await this.requireOffer(id);
    const updated = await this.prisma.affiliateOffer.update({
      where: { id },
      data: { status },
    });
    return { success: true, data: updated };
  }

  // ── Campaigns ──────────────────────────────────────────────────────────

  async listCampaigns() {
    const campaigns = await this.prisma.affiliateCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { offers: true } } },
    });
    return { success: true, data: campaigns };
  }

  async createCampaign(dto: CreateCampaignDto, adminUserId: string) {
    const code = await this.allocateCampaignCode();

    const campaign = await this.prisma.affiliateCampaign.create({
      data: {
        code,
        name: dto.name,
        description: dto.description ?? null,
        status: dto.status ?? AffiliateCampaignStatus.DRAFT,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        eligibilityScope: dto.eligibilityScope ?? 'GLOBAL',
        eligibility: (dto.eligibility ?? null) as Prisma.InputJsonValue | null,
        rewardCapUnits:
          dto.rewardCapUnits !== undefined
            ? new Prisma.Decimal(dto.rewardCapUnits)
            : null,
        rewardCapUnit: dto.rewardCapUnit ?? AffiliateRewardUnit.POINTS,
        defaultRewardRuleId: dto.defaultRewardRuleId ?? null,
        defaultAttributionWindowDays: dto.defaultAttributionWindowDays ?? null,
        createdByUserId: adminUserId,
      },
    });

    if (dto.offerIds?.length) {
      await this.prisma.affiliateCampaignOffer.createMany({
        data: dto.offerIds.map((offerId) => ({
          campaignId: campaign.id,
          offerId,
        })),
        skipDuplicates: true,
      });
    }

    return { success: true, data: campaign };
  }

  async updateCampaignStatus(id: string, status: AffiliateCampaignStatus) {
    const campaign = await this.prisma.affiliateCampaign.findUnique({
      where: { id },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const updated = await this.prisma.affiliateCampaign.update({
      where: { id },
      data: { status },
    });
    return { success: true, data: updated };
  }

  private async allocateCampaignCode(): Promise<string> {
    const last = await this.prisma.affiliateCampaign.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    let next = 1;
    const match = last?.code?.match(/^CAM-(\d+)$/);
    if (match) next = Number(match[1]) + 1;
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = `CAM-${String(next + attempt).padStart(5, '0')}`;
      const clash = await this.prisma.affiliateCampaign.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    throw new Error('Could not allocate a campaign code');
  }

  // ── Conversions ────────────────────────────────────────────────────────

  async listConversions(query: ConversionQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.AffiliateConversionWhereInput = {
      ...(query.conversionStatus
        ? { status: query.conversionStatus as any }
        : {}),
      ...(query.offerId ? { offerId: query.offerId } : {}),
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
          attribution: true,
          ledger: true,
        },
      }),
      this.prisma.affiliateConversion.count({ where }),
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

  // ── Reconciliation ─────────────────────────────────────────────────────

  async reconciliation(query: ReconciliationQueryDto) {
    const queues = [
      'unmatched_conversions',
      'duplicate_transactions',
      'failed_syncs',
      'negative_balances',
      'over_budget_campaigns',
      'stale_providers',
      'identity_unverifiable',
    ] as const;

    if (query.queue && !queues.includes(query.queue as any)) {
      throw new BadRequestException(`Unknown reconciliation queue: ${query.queue}`);
    }

    const wanted = query.queue ? [query.queue] : [...queues];
    const result: Record<string, unknown> = {};

    for (const queue of wanted) {
      switch (queue) {
        case 'unmatched_conversions': {
          const items = await this.prisma.affiliateConversion.findMany({
            where: { status: 'UNMATCHED' },
            orderBy: { occurredAt: 'desc' },
            take: 50,
          });
          result[queue] = { count: items.length, items };
          break;
        }
        case 'duplicate_transactions': {
          const items = await this.prisma.affiliateConversion.findMany({
            where: { status: 'DUPLICATE' },
            take: 50,
          });
          result[queue] = { count: items.length, items };
          break;
        }
        case 'failed_syncs': {
          const items = await this.prisma.affiliateSyncLog.findMany({
            where: { status: 'FAILED' },
            orderBy: { startedAt: 'desc' },
            take: 50,
          });
          result[queue] = { count: items.length, items };
          break;
        }
        case 'negative_balances': {
          const reversalRows = await this.prisma.affiliateRewardLedger.groupBy({
            by: ['localAffiliateId'],
            where: { entryType: 'REVERSAL' },
          });
          const items: Array<{ localAffiliateId: string; available: number }> = [];
          for (const row of reversalRows) {
            const balances = await this.rewards.getBalances(row.localAffiliateId);
            if (balances.available < 0) {
              items.push({
                localAffiliateId: row.localAffiliateId,
                available: balances.available,
              });
            }
          }
          result[queue] = { count: items.length, items };
          break;
        }
        case 'over_budget_campaigns': {
          const campaigns = await this.prisma.affiliateCampaign.findMany({
            where: { rewardCapUnits: { not: null } },
            select: {
              id: true,
              code: true,
              name: true,
              rewardCapUnits: true,
              budgetUnitsIssued: true,
              status: true,
            },
          });
          const items = campaigns.filter(
            (c) =>
              c.rewardCapUnits &&
              new Prisma.Decimal(c.budgetUnitsIssued).greaterThanOrEqualTo(
                c.rewardCapUnits,
              ),
          );
          result[queue] = { count: items.length, items };
          break;
        }
        case 'stale_providers': {
          const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const items = await this.prisma.affiliateProvider.findMany({
            where: {
              status: AffiliateProviderStatus.CONNECTED,
              OR: [
                { lastSuccessfulSyncAt: null },
                { lastSuccessfulSyncAt: { lt: cutoff } },
              ],
            },
            select: { id: true, code: true, name: true, lastSuccessfulSyncAt: true },
          });
          result[queue] = { count: items.length, items };
          break;
        }
        case 'identity_unverifiable': {
          const items = await this.prisma.affiliateOffer.findMany({
            where: { identityUnverifiable: true, status: 'ACTIVE' },
            select: { id: true, slug: true, title: true, providerId: true },
            take: 50,
          });
          result[queue] = { count: items.length, items };
          break;
        }
      }
    }

    return { success: true, data: result };
  }

  // ── Reports ────────────────────────────────────────────────────────────

  async reportOverview() {
    const [
      affiliates,
      activeOffers,
      activeCampaigns,
      conversions,
      byProvider,
      byStatus,
      ledgers,
    ] = await Promise.all([
      this.prisma.localAffiliateProfile.count(),
      this.prisma.affiliateOffer.count({ where: { status: 'ACTIVE' } }),
      this.prisma.affiliateCampaign.count({
        where: { status: { in: ['ACTIVE', 'SCHEDULED'] } },
      }),
      this.prisma.affiliateConversion.count(),
      this.prisma.affiliateConversion.groupBy({
        by: ['providerId'],
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
      this.prisma.affiliateConversion.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.affiliateRewardLedger.groupBy({
        by: ['status'],
        _sum: { units: true },
      }),
    ]);

    const providers = await this.prisma.affiliateProvider.findMany({
      select: { id: true, code: true, name: true },
    });
    const providerMap = new Map(providers.map((p) => [p.id, p]));

    return {
      success: true,
      data: {
        totals: { affiliates, activeOffers, activeCampaigns, conversions },
        byProvider: byProvider.map((row) => ({
          provider: providerMap.get(row.providerId) ?? { id: row.providerId },
          count: row._count._all,
          amountMinor: row._sum.amountMinor ?? 0,
        })),
        conversionsByStatus: Object.fromEntries(
          byStatus.map((row) => [row.status, row._count._all]),
        ),
        rewardsByStatus: Object.fromEntries(
          ledgers.map((row) => [row.status, Number(row._sum.units ?? 0)]),
        ),
      },
    };
  }

  // ── Guards ─────────────────────────────────────────────────────────────

  private async requireProvider(id: string) {
    const provider = await this.prisma.affiliateProvider.findUnique({
      where: { id },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  private async requireOffer(id: string) {
    const offer = await this.prisma.affiliateOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  private async requireExternalBusiness(id: string) {
    const business = await this.prisma.externalBusiness.findUnique({
      where: { id },
    });
    if (!business) throw new NotFoundException('External business not found');
    return business;
  }

  /** Exposed for the seed script and tests. */
  async seedDefaults() {
    return nextAffiliateCode(this.prisma as any);
  }
}
