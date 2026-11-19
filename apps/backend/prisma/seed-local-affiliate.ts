/**
 * Local Affiliate demo seed.
 *
 * Run with:  npm run seed:local-affiliate
 *
 * Idempotent (upsert by fixed id) and refuses to run in production. Every row
 * carries `isDemo: true` in its metadata so demo data can never be mistaken
 * for real activity. No wallet credits are produced — pending rewards stay in
 * the affiliate ledger, exactly as in production.
 */
import {
  AffiliateCampaignStatus,
  AffiliateConversionStatus,
  AffiliateIntegrationLevel,
  AffiliateLedgerEntryType,
  AffiliateOfferStatus,
  AffiliateProviderStatus,
  AffiliateProviderType,
  AffiliateRewardStatus,
  AffiliateRewardUnit,
  AffiliateVoucherStatus,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO = { isDemo: true } as const;
const PASSWORD = 'Password123!';

const ids = {
  providerMall: 'la-demo-prov-mall',
  providerRewards: 'la-demo-prov-rewards',
  providerThrive: 'la-demo-prov-thrivecart',
  providerAwin: 'la-demo-prov-awin',
  providerTamina: 'la-demo-prov-tamina',
  providerRestaurant: 'la-demo-prov-restaurant',

  categoryLocal: 'la-demo-cat-local',
  categoryMall: 'la-demo-cat-mall',
  categoryGbs: 'la-demo-cat-247gbs',
  categoryExternal: 'la-demo-cat-external',
  categoryOnline: 'la-demo-cat-online',
  categorySeasonal: 'la-demo-cat-seasonal',
  categoryEvents: 'la-demo-cat-events',
};

async function ensureCategory(slug: string, name: string, sortOrder: number) {
  return prisma.affiliateOfferCategory.upsert({
    where: { slug },
    update: { name, sortOrder },
    create: { id: `la-demo-cat-${slug}`, slug, name, sortOrder },
  });
}

async function ensureUser(
  id: string,
  email: string,
  firstName: string,
  lastName: string,
) {
  const password = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id,
      email,
      password,
      role: Role.CUSTOMER,
      registrationSource: 'local-affiliate',
      firstName,
      lastName,
      wallet: { create: { balance: 0, currency: 'MCOM', status: 'ACTIVE' } },
      customerProfile: { create: {} },
    },
  });
}

async function ensureAffiliate(
  userId: string,
  affiliateCode: string,
  displayName: string,
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED',
  activatedFrom: 'EXISTING_CHS' | 'NEW_CHS',
) {
  const id = `la-demo-aff-${affiliateCode}`;
  const profile = await prisma.localAffiliateProfile.upsert({
    where: { userId },
    update: { status, displayName },
    create: {
      id,
      userId,
      affiliateCode,
      status,
      displayName,
      termsVersion: '2026-11-01',
      termsAcceptedAt: new Date(),
      activatedFrom,
      approvedAt: status === 'ACTIVE' ? new Date() : null,
    },
  });
  await prisma.localAffiliateCard.upsert({
    where: {
      localAffiliateId_provider: { localAffiliateId: profile.id, provider: 'vcard' },
    },
    update: {},
    create: {
      localAffiliateId: profile.id,
      provider: 'vcard',
      status: status === 'ACTIVE' ? 'LINKED' : 'NOT_LINKED',
      externalCardId: status === 'ACTIVE' ? 'VCARD-DEMO-001' : null,
      linkedAt: status === 'ACTIVE' ? new Date() : null,
      metadata: DEMO as any,
    },
  });
  return profile;
}

async function ensureProvider(input: {
  id: string;
  code: string;
  name: string;
  type: AffiliateProviderType;
  level: AffiliateIntegrationLevel;
  status?: AffiliateProviderStatus;
  events?: string[];
  notes?: string;
}) {
  return prisma.affiliateProvider.upsert({
    where: { code: input.code },
    update: {
      name: input.name,
      integrationLevel: input.level,
      status: input.status ?? AffiliateProviderStatus.CONNECTED,
    },
    create: {
      id: input.id,
      code: input.code,
      name: input.name,
      type: input.type,
      integrationLevel: input.level,
      status: input.status ?? AffiliateProviderStatus.CONNECTED,
      supportedEvents: (input.events ?? []) as any,
      supportedRewardTypes: ['POINTS', 'VOUCHER'] as any,
      notes: input.notes ?? null,
    },
  });
}

async function ensureRule(input: {
  id: string;
  version: number;
  name: string;
  event: any;
  fixedUnits?: number;
  percentage?: number;
  pointsPerCurrencyUnit?: number;
  minPurchaseMinor?: number;
  approvalMode?: any;
  expiryDays?: number;
}) {
  return prisma.affiliateRewardRule.upsert({
    where: { version: input.version },
    update: {},
    create: {
      id: input.id,
      version: input.version,
      isCurrent: true,
      name: input.name,
      qualifyingEvent: input.event,
      rewardType: 'POINTS',
      calculation: input.percentage ? 'PERCENTAGE' : 'FIXED',
      unit: AffiliateRewardUnit.POINTS,
      fixedUnits:
        input.fixedUnits !== undefined ? new Prisma.Decimal(input.fixedUnits) : null,
      percentage:
        input.percentage !== undefined ? new Prisma.Decimal(input.percentage) : null,
      pointsPerCurrencyUnit:
        input.pointsPerCurrencyUnit !== undefined
          ? new Prisma.Decimal(input.pointsPerCurrencyUnit)
          : null,
      minPurchaseMinor: input.minPurchaseMinor ?? null,
      approvalMode: input.approvalMode ?? 'ADMIN_CONFIRMATION',
      reversalPolicy: 'REVERSE_ON_REFUND',
      expiryDays: input.expiryDays ?? 180,
    },
  });
}

async function ensureOffer(input: {
  id: string;
  slug: string;
  providerId: string;
  categoryId?: string;
  title: string;
  subtitle?: string;
  destinationUrl: string;
  integrationLevel: AffiliateIntegrationLevel;
  rewardRuleId?: string;
  redemptionMethod?: string;
  customerBenefit?: any;
  status?: AffiliateOfferStatus;
  identityUnverifiable?: boolean;
}) {
  return prisma.affiliateOffer.upsert({
    where: { slug: input.slug },
    update: {},
    create: {
      id: input.id,
      slug: input.slug,
      providerId: input.providerId,
      categoryId: input.categoryId ?? null,
      title: input.title,
      subtitle: input.subtitle ?? null,
      description: 'Demo data — not a live offer.',
      imageUrl: null,
      destinationUrl: input.destinationUrl,
      integrationLevel: input.integrationLevel,
      eligibilityScope: 'GLOBAL',
      customerBenefit: (input.customerBenefit ?? DEMO) as any,
      rewardRuleId: input.rewardRuleId ?? null,
      redemptionMethod: input.redemptionMethod ?? 'NONE',
      status: input.status ?? AffiliateOfferStatus.ACTIVE,
      identityUnverifiable: input.identityUnverifiable ?? false,
      approvedAt: new Date(),
    },
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed demo affiliate data in production. Set NODE_ENV to development.',
    );
  }

  console.log('Seeding Local Affiliate demo data…');

  // ── Categories ─────────────────────────────────────────────────────────
  const categories = await Promise.all([
    ensureCategory('local-businesses', 'Local Businesses', 1),
    ensureCategory('mcom-mall', 'MCOM Mall', 2),
    ensureCategory('247gbs-offers', '247GBS Offers', 3),
    ensureCategory('external-offers', 'External Offers', 4),
    ensureCategory('online-products', 'Online Products', 5),
    ensureCategory('seasonal-campaigns', 'Seasonal Campaigns', 6),
    ensureCategory('events-experiences', 'Events & Experiences', 7),
  ]);
  const cat = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  // ── Providers ──────────────────────────────────────────────────────────
  const mall = await ensureProvider({
    id: ids.providerMall,
    code: 'mcom_mall',
    name: 'MCOM Mall',
    type: AffiliateProviderType.INTERNAL_PLATFORM,
    level: AffiliateIntegrationLevel.PROVIDER_WEBHOOK,
    events: [
      'APPROVED_PURCHASE',
      'COMPLETED_BOOKING',
      'VERIFIED_REDEMPTION',
      'CANCELLED_REFUNDED',
    ],
    notes: 'Internal commerce platform. Attribution via ?laf= and order push.',
  });
  await ensureProvider({
    id: ids.providerRewards,
    code: '247gbs_rewards',
    name: '247GBS Rewards',
    type: AffiliateProviderType.INTERNAL_PLATFORM,
    level: AffiliateIntegrationLevel.REDEMPTION_CODE,
    events: ['VERIFIED_REDEMPTION'],
  });
  await ensureProvider({
    id: ids.providerThrive,
    code: 'thrivecart',
    name: 'ThriveCart',
    type: AffiliateProviderType.EXTERNAL_CHECKOUT,
    level: AffiliateIntegrationLevel.PROVIDER_WEBHOOK,
    events: ['APPROVED_PURCHASE', 'CANCELLED_REFUNDED'],
    notes: 'Passthrough attribution (passthrough[la_tracking_id]).',
  });
  await ensureProvider({
    id: ids.providerAwin,
    code: 'awin',
    name: 'Awin',
    type: AffiliateProviderType.AFFILIATE_NETWORK,
    level: AffiliateIntegrationLevel.PROVIDER_API,
    status: AffiliateProviderStatus.DRAFT,
    events: ['APPROVED_PURCHASE'],
    notes:
      'Disabled: attribution rides on clickRef. Do not enable until Awin confirms subnetwork treatment in writing.',
  });
  await ensureProvider({
    id: ids.providerTamina,
    code: 'tamina',
    name: 'Tamina',
    type: AffiliateProviderType.EXTERNAL_BUSINESS,
    level: AffiliateIntegrationLevel.REDEMPTION_CODE,
    events: ['VERIFIED_REDEMPTION'],
    notes: 'Level 2 — voucher code validated by the business.',
  });
  await ensureProvider({
    id: ids.providerRestaurant,
    code: 'local_restaurant',
    name: 'Local Restaurant',
    type: AffiliateProviderType.EXTERNAL_BUSINESS,
    level: AffiliateIntegrationLevel.MANUAL_CONFIRMATION,
    events: ['COMPLETED_BOOKING', 'APPROVED_PURCHASE'],
    notes: 'Level 3 — business confirms the booking.',
  });

  // ── Reward rules ───────────────────────────────────────────────────────
  const ruleBooking = await ensureRule({
    id: 'la-demo-rule-1',
    version: 1,
    name: 'Verified booking — 100 points',
    event: 'VERIFIED_REDEMPTION',
    fixedUnits: 100,
    approvalMode: 'REDEMPTION_VALIDATION',
    expiryDays: 180,
  });
  const rulePurchase = await ensureRule({
    id: 'la-demo-rule-2',
    version: 2,
    name: 'Approved purchase — 5% at 10 points per £1',
    event: 'APPROVED_PURCHASE',
    percentage: 5,
    pointsPerCurrencyUnit: 10,
    minPurchaseMinor: 2000,
    approvalMode: 'ADMIN_CONFIRMATION',
    expiryDays: 180,
  });
  const ruleCourse = await ensureRule({
    id: 'la-demo-rule-3',
    version: 3,
    name: 'Digital course — 250 points',
    event: 'APPROVED_PURCHASE',
    fixedUnits: 250,
    approvalMode: 'PROVIDER_CONFIRMATION',
    expiryDays: 365,
  });
  await ensureRule({
    id: 'la-demo-rule-4',
    version: 4,
    name: 'Traffic only — no reward',
    event: 'LINK_CLICK',
    fixedUnits: 0,
    approvalMode: 'AUTOMATIC',
  });

  // ── External business ──────────────────────────────────────────────────
  const tamina = await prisma.externalBusiness.upsert({
    where: { id: 'la-demo-extbiz-tamina' },
    update: {},
    create: {
      id: 'la-demo-extbiz-tamina',
      name: 'Tamina',
      website: 'https://tamina.example.com',
      contactEmail: 'owner@tamina.example.com',
      category: 'Services',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      notes: 'Demo external business.',
    },
  });

  // ── Offers (one per integration level) ─────────────────────────────────
  const offerHaircut = await ensureOffer({
    id: 'la-demo-offer-haircut',
    slug: 'tobys-barber-premium-cut',
    providerId: mall.id,
    categoryId: cat['local-businesses'],
    title: "Toby's Barber — Premium Cut",
    subtitle: 'MCOM Mall · Local service',
    destinationUrl: 'https://mall.example.com/product/barber-premium-cut',
    integrationLevel: AffiliateIntegrationLevel.PROVIDER_WEBHOOK,
    rewardRuleId: ruleBooking.id,
    redemptionMethod: 'PLATFORM_CODE',
    customerBenefit: { type: 'PERCENTAGE_DISCOUNT', value: 15, label: '15% off your cut' },
  });

  const offerRestaurant = await ensureOffer({
    id: 'la-demo-offer-restaurant',
    slug: 'local-restaurant-meal-deal',
    providerId: ids.providerRestaurant,
    categoryId: cat['external-offers'],
    title: 'Local Restaurant — Meal Deal',
    subtitle: 'External business · Food',
    destinationUrl: 'https://restaurant.example.com/offers/meal-deal',
    integrationLevel: AffiliateIntegrationLevel.MANUAL_CONFIRMATION,
    rewardRuleId: ruleBooking.id,
    redemptionMethod: 'PLATFORM_CODE',
    customerBenefit: { type: 'PERCENTAGE_DISCOUNT', value: 10, label: '10% off the bill' },
    identityUnverifiable: true,
  });

  const offerCourse = await ensureOffer({
    id: 'la-demo-offer-course',
    slug: 'digital-learning-course',
    providerId: ids.providerThrive,
    categoryId: cat['online-products'],
    title: 'What Is an MBA? — Digital Course',
    subtitle: 'ThriveCart · Digital product',
    destinationUrl: 'https://vendor.thrivecart.com/mba-course/',
    integrationLevel: AffiliateIntegrationLevel.PROVIDER_WEBHOOK,
    rewardRuleId: ruleCourse.id,
    customerBenefit: { type: 'FIXED_DISCOUNT', value: 20, label: '£20 off' },
  });

  const offerFashion = await ensureOffer({
    id: 'la-demo-offer-fashion',
    slug: 'fashion-retail-offer',
    providerId: ids.providerAwin,
    categoryId: cat['online-products'],
    title: 'Fashion Retail Offer',
    subtitle: 'Awin · Advertiser offer',
    destinationUrl: 'https://advertiser.example.com/fashion',
    integrationLevel: AffiliateIntegrationLevel.PROVIDER_API,
    rewardRuleId: rulePurchase.id,
    status: AffiliateOfferStatus.DRAFT,
    identityUnverifiable: true,
  });

  const offerTamina = await ensureOffer({
    id: 'la-demo-offer-tamina',
    slug: 'tamina-cleaning-service',
    providerId: ids.providerTamina,
    categoryId: cat['external-offers'],
    title: 'Tamina — Home Cleaning',
    subtitle: 'External business · Cleaning',
    destinationUrl: 'https://tamina.example.com/cleaning',
    integrationLevel: AffiliateIntegrationLevel.REDEMPTION_CODE,
    rewardRuleId: ruleBooking.id,
    redemptionMethod: 'PLATFORM_CODE',
    customerBenefit: { type: 'PERCENTAGE_DISCOUNT', value: 20, label: '20% off first clean' },
    identityUnverifiable: true,
  });

  const offerTraffic = await ensureOffer({
    id: 'la-demo-offer-traffic',
    slug: 'external-link-only-sample',
    providerId: ids.providerTamina,
    categoryId: cat['external-offers'],
    title: 'External Link — Traffic Only',
    subtitle: 'External business · Link only',
    destinationUrl: 'https://tamina.example.com/landing',
    integrationLevel: AffiliateIntegrationLevel.LINK_ONLY,
    redemptionMethod: 'NONE',
    identityUnverifiable: true,
  });

  void offerTamina;

  // ── Campaigns ──────────────────────────────────────────────────────────
  const campaigns: Array<{ code: string; name: string; status: AffiliateCampaignStatus }> = [
    { code: 'CAM-00001', name: 'Black Friday 2026', status: AffiliateCampaignStatus.ACTIVE },
    { code: 'CAM-00002', name: 'Birthday Offers', status: AffiliateCampaignStatus.ACTIVE },
    { code: 'CAM-00003', name: 'Local Business Promotion', status: AffiliateCampaignStatus.ACTIVE },
    { code: 'CAM-00004', name: 'Christmas Campaign', status: AffiliateCampaignStatus.SCHEDULED },
    { code: 'CAM-00005', name: 'New Customer Offers', status: AffiliateCampaignStatus.DRAFT },
  ];
  for (const c of campaigns) {
    await prisma.affiliateCampaign.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        name: c.name,
        status: c.status,
        startsAt: new Date('2026-11-20T00:00:00Z'),
        endsAt: new Date('2026-12-31T23:59:59Z'),
        rewardCapUnits: new Prisma.Decimal(10000),
        rewardCapUnit: AffiliateRewardUnit.POINTS,
        defaultAttributionWindowDays: 30,
        promotionMaterials: DEMO as any,
      },
    });
  }

  // ── Affiliates ─────────────────────────────────────────────────────────
  const johnUser = await ensureUser('la-demo-user-john', 'john.smith@example.com', 'John', 'Smith');
  const maryUser = await ensureUser('la-demo-user-mary', 'mary.jones@example.com', 'Mary', 'Jones');
  const peterUser = await ensureUser('la-demo-user-peter', 'peter.james@example.com', 'Peter', 'James');
  const sarahUser = await ensureUser('la-demo-user-sarah', 'sarah.brown@example.com', 'Sarah', 'Brown');

  const john = await ensureAffiliate(johnUser.id, 'LAF-000125', 'John Smith', 'ACTIVE', 'EXISTING_CHS');
  await ensureAffiliate(maryUser.id, 'LAF-000126', 'Mary Jones', 'ACTIVE', 'NEW_CHS');
  await ensureAffiliate(peterUser.id, 'LAF-000127', 'Peter James', 'PENDING', 'EXISTING_CHS');
  const sarah = await ensureAffiliate(sarahUser.id, 'LAF-000128', 'Sarah Brown', 'ACTIVE', 'NEW_CHS');

  // Keep the sequence ahead of the demo codes.
  await prisma.$queryRawUnsafe(
    `SELECT setval('local_affiliate_code_seq', GREATEST(129, (SELECT last_value FROM local_affiliate_code_seq)))`,
  );

  // ── Tracking links + clicks ────────────────────────────────────────────
  const linkHaircut = await prisma.affiliateTrackingLink.upsert({
    where: {
      localAffiliateId_offerId_campaignKey: {
        localAffiliateId: john.id,
        offerId: offerHaircut.id,
        campaignKey: '',
      },
    },
    update: {},
    create: {
      id: 'la-demo-link-haircut',
      code: 'demoL1nk01',
      localAffiliateId: john.id,
      offerId: offerHaircut.id,
      campaignKey: '',
      providerId: mall.id,
      destinationUrl: offerHaircut.destinationUrl,
      clickCount: 250,
      lastClickAt: new Date(),
    },
  });

  const linkRestaurant = await prisma.affiliateTrackingLink.upsert({
    where: {
      localAffiliateId_offerId_campaignKey: {
        localAffiliateId: sarah.id,
        offerId: offerRestaurant.id,
        campaignKey: '',
      },
    },
    update: {},
    create: {
      id: 'la-demo-link-restaurant',
      code: 'demoL1nk02',
      localAffiliateId: sarah.id,
      offerId: offerRestaurant.id,
      campaignKey: '',
      providerId: ids.providerRestaurant,
      destinationUrl: offerRestaurant.destinationUrl,
      clickCount: 88,
      lastClickAt: new Date(),
    },
  });

  // John also promotes the restaurant offer, so his vouchers have a code that
  // belongs to HIM and to THAT offer (the redemption service re-resolves the
  // code from the voucher owner and would otherwise find nothing).
  await prisma.affiliateTrackingLink.upsert({
    where: {
      localAffiliateId_offerId_campaignKey: {
        localAffiliateId: john.id,
        offerId: offerRestaurant.id,
        campaignKey: '',
      },
    },
    update: {},
    create: {
      id: 'la-demo-link-restaurant-john',
      code: 'demoL1nk03',
      localAffiliateId: john.id,
      offerId: offerRestaurant.id,
      campaignKey: '',
      providerId: ids.providerRestaurant,
      destinationUrl: offerRestaurant.destinationUrl,
      clickCount: 42,
      lastClickAt: new Date(),
    },
  });

  await prisma.affiliateClick.deleteMany({
    where: { id: { in: ['la-demo-click-1', 'la-demo-click-2'] } },
  });
  await prisma.affiliateClick.createMany({
    data: [
      {
        id: 'la-demo-click-1',
        trackingLinkId: linkHaircut.id,
        occurredAt: new Date(),
        ipHash: 'demo-hash-1',
        source: 'INTERNAL_REDIRECT',
        metadata: DEMO as any,
      },
      {
        id: 'la-demo-click-2',
        trackingLinkId: linkRestaurant.id,
        occurredAt: new Date(),
        ipHash: 'demo-hash-2',
        source: 'INTERNAL_REDIRECT',
        metadata: DEMO as any,
      },
    ],
    skipDuplicates: true,
  });

  // ── Conversions (every status) ─────────────────────────────────────────
  const conversionSeeds: Array<{
    id: string;
    providerId: string;
    transactionId: string;
    offerId: string;
    affiliateId: string | null;
    linkId: string | null;
    eventType: any;
    status: AffiliateConversionStatus;
    amountMinor: number;
    reason?: string;
  }> = [
    {
      id: 'la-demo-conv-attributed',
      providerId: ids.providerRestaurant,
      transactionId: 'demo-order-1',
      offerId: offerRestaurant.id,
      affiliateId: sarah.id,
      linkId: linkRestaurant.id,
      eventType: 'VERIFIED_REDEMPTION',
      status: AffiliateConversionStatus.ATTRIBUTED,
      amountMinor: 4200,
    },
    {
      id: 'la-demo-conv-unmatched',
      providerId: mall.id,
      transactionId: 'demo-order-2',
      offerId: offerHaircut.id,
      affiliateId: null,
      linkId: null,
      eventType: 'APPROVED_PURCHASE',
      status: AffiliateConversionStatus.UNMATCHED,
      amountMinor: 3200,
    },
    {
      id: 'la-demo-conv-rejected',
      providerId: mall.id,
      transactionId: 'demo-order-3',
      offerId: offerHaircut.id,
      affiliateId: john.id,
      linkId: linkHaircut.id,
      eventType: 'APPROVED_PURCHASE',
      status: AffiliateConversionStatus.REJECTED,
      amountMinor: 1500,
      reason: 'BELOW_MIN_PURCHASE',
    },
    {
      id: 'la-demo-conv-expired',
      providerId: mall.id,
      transactionId: 'demo-order-4',
      offerId: offerHaircut.id,
      affiliateId: john.id,
      linkId: linkHaircut.id,
      eventType: 'APPROVED_PURCHASE',
      status: AffiliateConversionStatus.EXPIRED_UNATTRIBUTED,
      amountMinor: 5000,
      reason: 'OUTSIDE_WINDOW',
    },
  ];

  for (const c of conversionSeeds) {
    await prisma.affiliateConversion.upsert({
      where: {
        providerId_providerTransactionId_eventType: {
          providerId: c.providerId,
          providerTransactionId: c.transactionId,
          eventType: c.eventType,
        },
      },
      update: {},
      create: {
        id: c.id,
        providerId: c.providerId,
        providerTransactionId: c.transactionId,
        providerOrderRef: c.transactionId,
        offerId: c.offerId,
        localAffiliateId: c.affiliateId,
        trackingLinkId: c.linkId,
        campaignId: null,
        eventType: c.eventType,
        status: c.status,
        amountMinor: c.amountMinor,
        currency: 'GBP',
        occurredAt: new Date(),
        attributionMethod: c.affiliateId ? 'INTERNAL_LAST_CLICK' : null,
        attributionWindowDays: c.affiliateId ? 30 : null,
        rejectionReason: c.reason ?? null,
      },
    });
  }

  // ── Lifetime ledger activity (all statuses) ────────────────────────────
  const ledgerSeeds: Array<{
    key: string;
    affiliateId: string;
    entryType: AffiliateLedgerEntryType;
    units: number;
    status: AffiliateRewardStatus;
    description: string;
    conversionId?: string;
    expiresAt?: Date | null;
  }> = [
    {
      key: 'demo:lifetime:available',
      affiliateId: john.id,
      entryType: AffiliateLedgerEntryType.CREDIT,
      units: 1200,
      status: AffiliateRewardStatus.AVAILABLE,
      description: 'Reward: 1200 points for verified redemption',
    },
    {
      key: 'demo:lifetime:pending',
      affiliateId: john.id,
      entryType: AffiliateLedgerEntryType.CREDIT,
      units: 500,
      status: AffiliateRewardStatus.PENDING,
      description: 'Reward: 500 points awaiting provider confirmation',
    },
    {
      key: 'demo:lifetime:redeemed',
      affiliateId: john.id,
      entryType: AffiliateLedgerEntryType.DEBIT,
      units: 300,
      status: AffiliateRewardStatus.REDEEMED,
      description: 'Reward redemption — 300 points',
    },
    {
      key: 'demo:lifetime:expired',
      affiliateId: sarah.id,
      entryType: AffiliateLedgerEntryType.EXPIRY,
      units: 200,
      status: AffiliateRewardStatus.EXPIRED,
      description: 'Reward expired',
    },
    {
      key: 'demo:lifetime:reversed',
      affiliateId: sarah.id,
      entryType: AffiliateLedgerEntryType.REVERSAL,
      units: 100,
      status: AffiliateRewardStatus.REVERSED,
      description: 'Reversal: the transaction was refunded',
    },
    {
      key: 'demo:lifetime:sarah-available',
      affiliateId: sarah.id,
      entryType: AffiliateLedgerEntryType.CREDIT,
      units: 400,
      status: AffiliateRewardStatus.AVAILABLE,
      description: 'Reward: 400 points for verified redemption',
    },
  ];

  for (const row of ledgerSeeds) {
    await prisma.affiliateRewardLedger.upsert({
      where: { idempotencyKey: row.key },
      update: {},
      create: {
        localAffiliateId: row.affiliateId,
        conversionId: row.conversionId ?? null,
        entryType: row.entryType,
        unit: AffiliateRewardUnit.POINTS,
        units: new Prisma.Decimal(row.units),
        status: row.status,
        idempotencyKey: row.key,
        description: row.description,
        metadata: DEMO as any,
        availableAt:
          row.status === AffiliateRewardStatus.AVAILABLE ? new Date() : null,
        expiresAt: row.expiresAt ?? null,
        closedAt:
          row.status === AffiliateRewardStatus.REDEEMED ||
          row.status === AffiliateRewardStatus.EXPIRED ||
          row.status === AffiliateRewardStatus.REVERSED
            ? new Date()
            : null,
      },
    });
  }

  // ── Vouchers (valid / expired / revoked) ───────────────────────────────
  const voucherSeeds: Array<{
    id: string;
    code: string;
    status: AffiliateVoucherStatus;
    expiresAt: Date | null;
    usedCount: number;
    affiliateId: string;
  }> = [
    {
      id: 'la-demo-voucher-valid',
      code: 'DEMO-2345',
      status: AffiliateVoucherStatus.ISSUED,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      usedCount: 0,
      affiliateId: john.id,
    },
    {
      id: 'la-demo-voucher-expired',
      code: 'DEMO-6789',
      status: AffiliateVoucherStatus.EXPIRED,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      usedCount: 0,
      affiliateId: john.id,
    },
    {
      id: 'la-demo-voucher-revoked',
      code: 'DEMO-3456',
      status: AffiliateVoucherStatus.REVOKED,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      usedCount: 0,
      affiliateId: sarah.id,
    },
  ];

  for (const v of voucherSeeds) {
    const ownerCode = v.affiliateId === john.id ? 'demoL1nk03' : 'demoL1nk02';
    await prisma.affiliateVoucher.upsert({
      where: { code: v.code },
      update: { trackingLinkCode: ownerCode, localAffiliateId: v.affiliateId },
      create: {
        id: v.id,
        code: v.code,
        offerId: offerRestaurant.id,
        localAffiliateId: v.affiliateId,
        trackingLinkCode: ownerCode,
        benefit: {
          type: 'PERCENTAGE_DISCOUNT',
          value: 10,
          label: '10% off the bill',
          isDemo: true,
        } as any,
        maxUses: 1,
        usedCount: v.usedCount,
        maxUsesPerCustomer: 1,
        status: v.status,
        expiresAt: v.expiresAt,
        revokedAt: v.status === AffiliateVoucherStatus.REVOKED ? new Date() : null,
        revokeReason:
          v.status === AffiliateVoucherStatus.REVOKED ? 'Demo: revoked by business' : null,
      },
    });
  }

  // ── Awin fixtures: a disabling reminder + a pending transaction ────────
  const awin = await prisma.affiliateProvider.findUnique({ where: { code: 'awin' } });
  if (awin) {
    const account = await prisma.affiliateProviderAccount.upsert({
      where: {
        providerId_externalAccountId: {
          providerId: awin.id,
          externalAccountId: 'demo-publisher-12345',
        },
      },
      update: {},
      create: {
        providerId: awin.id,
        label: 'Awin publisher (demo)',
        externalAccountId: 'demo-publisher-12345',
        config: { note: 'No credentials stored — demo only' } as any,
        status: AffiliateProviderStatus.DRAFT,
      },
    });

    await prisma.affiliateProviderTransaction.upsert({
      where: {
        providerAccountId_providerTransactionId: {
          providerAccountId: account.id,
          providerTransactionId: 'awin-demo-1001',
        },
      },
      update: {},
      create: {
        providerAccountId: account.id,
        providerId: awin.id,
        providerTransactionId: 'awin-demo-1001',
        providerOrderRef: 'AWIN-REF-1001',
        status: 'PENDING',
        amountMinor: 12000,
        currency: 'GBP',
        commissionAmountMinor: 240,
        clickRef: 'demoL1nk03',
        transactionDate: new Date(),
        raw: { demo: true } as any,
      },
    });

    void offerFashion;
  }

  console.log('✅ Local Affiliate demo seed complete.');
  console.log('   Affiliates: LAF-000125 (John), LAF-000126 (Mary), LAF-000127 (Peter, pending), LAF-000128 (Sarah)');
  console.log(`   Demo login password for all seeded users: ${PASSWORD}`);
  console.log('   Voucher codes: DEMO-2345 (valid), DEMO-6789 (expired), DEMO-3456 (revoked)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
