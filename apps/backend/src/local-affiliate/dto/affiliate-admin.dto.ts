import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AffiliateApprovalMode,
  AffiliateCampaignStatus,
  AffiliateEligibilityScope,
  AffiliateIntegrationLevel,
  AffiliateProviderType,
  AffiliateQualifyingEvent,
  AffiliateReversalPolicy,
  AffiliateRewardCalculation,
  AffiliateRewardType,
  AffiliateRewardUnit,
  AffiliateTrackingMethod,
} from '@prisma/client';

export class AdminPageQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  status?: string;

  @ApiPropertyOptional({ example: 'john' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  to?: string;
}

// ── Providers ────────────────────────────────────────────────────────────

export class CreateProviderDto {
  @ApiProperty({ example: 'tamina' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code: string;

  @ApiProperty({ example: 'Tamina' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: AffiliateProviderType })
  @IsEnum(AffiliateProviderType)
  type: AffiliateProviderType;

  @ApiProperty({ enum: AffiliateIntegrationLevel })
  @IsEnum(AffiliateIntegrationLevel)
  integrationLevel: AffiliateIntegrationLevel;

  @ApiPropertyOptional({ example: ['APPROVED_PURCHASE', 'VERIFIED_REDEMPTION'] })
  @IsOptional()
  @IsArray()
  @IsEnum(AffiliateQualifyingEvent, { each: true })
  supportedEvents?: AffiliateQualifyingEvent[];

  @ApiPropertyOptional({ example: ['POINTS', 'VOUCHER'] })
  @IsOptional()
  @IsArray()
  @IsEnum(AffiliateRewardType, { each: true })
  supportedRewardTypes?: AffiliateRewardType[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requiresManualApproval?: boolean;

  @ApiPropertyOptional({ example: 'AFFILIATE_PROVIDER_TAMINA_ENABLED' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  featureFlag?: string;

  @ApiPropertyOptional({ example: 'Level 2 redemption-code provider.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateProviderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: AffiliateIntegrationLevel })
  @IsOptional()
  @IsEnum(AffiliateIntegrationLevel)
  integrationLevel?: AffiliateIntegrationLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ example: ['APPROVED_PURCHASE'] })
  @IsOptional()
  @IsArray()
  @IsEnum(AffiliateQualifyingEvent, { each: true })
  supportedEvents?: AffiliateQualifyingEvent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateProviderAccountDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiProperty({ example: 'publisher-12345', description: 'Awin publisher id, ThriveCart account, etc.' })
  @IsString()
  @MaxLength(160)
  externalAccountId: string;

  @ApiPropertyOptional({ example: { publisherId: '12345' }, description: 'Non-secret configuration' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Secret material. Encrypted at rest; never returned.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  credentials?: string;
}

// ── External businesses ──────────────────────────────────────────────────

export class CreateExternalBusinessDto {
  @ApiProperty({ example: 'Tamina' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({ example: 'https://tamina.example.com' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ example: 'Tamina Owner' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ example: 'owner@tamina.example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+447911123456' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @ApiPropertyOptional({ example: '12 High Street' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: 'B1 1AA' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  postcode?: string;

  @ApiPropertyOptional({ example: 'Hospitality' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ example: 'clxcity' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cityId?: string;

  @ApiPropertyOptional({ example: 'clxborough' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  boroughId?: string;

  @ApiPropertyOptional({ example: 'clxmall' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  localMallId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ── Offers ───────────────────────────────────────────────────────────────

export class CreateOfferDto {
  @ApiProperty({ example: 'clxprovider' })
  @IsString()
  @MaxLength(40)
  providerId: string;

  @ApiPropertyOptional({ example: 'clxproduct' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  productId?: string;

  @ApiPropertyOptional({ example: 'clxbusiness' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  businessId?: string;

  @ApiPropertyOptional({ example: 'clxexternalbusiness' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  externalBusinessId?: string;

  @ApiPropertyOptional({ example: 'clxcategory' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  categoryId?: string;

  @ApiProperty({ example: 'Restaurant Meal — 20% off' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Local Restaurant · Food' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/meal.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @ApiProperty({ example: 'https://tamina.example.com/offer/meal' })
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  destinationUrl: string;

  @ApiPropertyOptional({ enum: AffiliateTrackingMethod })
  @IsOptional()
  @IsEnum(AffiliateTrackingMethod)
  trackingMethod?: AffiliateTrackingMethod;

  @ApiPropertyOptional({ enum: AffiliateEligibilityScope })
  @IsOptional()
  @IsEnum(AffiliateEligibilityScope)
  eligibilityScope?: AffiliateEligibilityScope;

  @ApiPropertyOptional({ example: { cityIds: ['clxcity'] } })
  @IsOptional()
  @IsObject()
  eligibility?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: { type: 'PERCENTAGE_DISCOUNT', value: 20, label: '20% off the bill' },
    description: 'What the REFERRED CUSTOMER receives',
  })
  @IsOptional()
  @IsObject()
  customerBenefit?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'clxrule' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  rewardRuleId?: string;

  @ApiPropertyOptional({ example: 'PLATFORM_CODE', enum: ['NONE', 'PLATFORM_CODE', 'PROVIDER_CODE', 'MANUAL'] })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  redemptionMethod?: string;

  @ApiPropertyOptional({ example: 0, description: 'Days to hold before a reward becomes available' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  holdDays?: number;

  @ApiPropertyOptional({ example: '2026-11-20T00:00:00Z' })
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  endsAt?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowOwnerPromotion?: boolean;
}

export class UpdateOfferDto extends CreateOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  declare providerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  declare title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  declare destinationUrl: string;

  @ApiPropertyOptional({ example: 'PENDING_APPROVAL' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}

// ── Campaigns ────────────────────────────────────────────────────────────

export class CreateCampaignDto {
  @ApiProperty({ example: 'Black Friday 2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: AffiliateCampaignStatus })
  @IsOptional()
  @IsEnum(AffiliateCampaignStatus)
  status?: AffiliateCampaignStatus;

  @ApiPropertyOptional({ example: '2026-11-20T00:00:00Z' })
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-11-30T23:59:59Z' })
  @IsOptional()
  @IsString()
  endsAt?: string;

  @ApiPropertyOptional({ enum: AffiliateEligibilityScope })
  @IsOptional()
  @IsEnum(AffiliateEligibilityScope)
  eligibilityScope?: AffiliateEligibilityScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  eligibility?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rewardCapUnits?: number;

  @ApiPropertyOptional({ enum: AffiliateRewardUnit })
  @IsOptional()
  @IsEnum(AffiliateRewardUnit)
  rewardCapUnit?: AffiliateRewardUnit;

  @ApiPropertyOptional({ example: 'clxrule' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  defaultRewardRuleId?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultAttributionWindowDays?: number;

  @ApiPropertyOptional({ example: ['clxoffer1', 'clxoffer2'], description: 'Offers included in the campaign' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  offerIds?: string[];
}

// ── Reward rules ─────────────────────────────────────────────────────────

export class CreateRewardRuleDto {
  @ApiProperty({ example: 'Verified booking — 100 points' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: AffiliateQualifyingEvent })
  @IsEnum(AffiliateQualifyingEvent)
  qualifyingEvent: AffiliateQualifyingEvent;

  @ApiProperty({ enum: AffiliateRewardType })
  @IsEnum(AffiliateRewardType)
  rewardType: AffiliateRewardType;

  @ApiPropertyOptional({ enum: AffiliateRewardCalculation })
  @IsOptional()
  @IsEnum(AffiliateRewardCalculation)
  calculation?: AffiliateRewardCalculation;

  @ApiPropertyOptional({ enum: AffiliateRewardUnit })
  @IsOptional()
  @IsEnum(AffiliateRewardUnit)
  unit?: AffiliateRewardUnit;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedUnits?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percentage?: number;

  @ApiPropertyOptional({ example: 10, description: 'Required when unit=POINTS and calculation=PERCENTAGE' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pointsPerCurrencyUnit?: number;

  @ApiPropertyOptional({ example: [{ minMinor: 0, maxMinor: 2000, fixedUnits: 100 }] })
  @IsOptional()
  @IsArray()
  tiers?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxRewardUnits?: number;

  @ApiPropertyOptional({ example: 2000, description: 'Minimum purchase in minor units' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPurchaseMinor?: number;

  @ApiPropertyOptional({ enum: AffiliateApprovalMode })
  @IsOptional()
  @IsEnum(AffiliateApprovalMode)
  approvalMode?: AffiliateApprovalMode;

  @ApiPropertyOptional({ enum: AffiliateReversalPolicy })
  @IsOptional()
  @IsEnum(AffiliateReversalPolicy)
  reversalPolicy?: AffiliateReversalPolicy;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiryDays?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capPerAffiliateUnits?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capPerCampaignUnits?: number;
}

// ── Conversions ──────────────────────────────────────────────────────────

export class ConversionQueryDto extends AdminPageQueryDto {
  @ApiPropertyOptional({ example: 'UNMATCHED' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  conversionStatus?: string;

  @ApiPropertyOptional({ example: 'clxoffer' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  offerId?: string;
}

export class ConversionActionDto {
  @ApiPropertyOptional({ example: 'Confirmed by the business' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ example: 'BELOW_MIN_PURCHASE' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;
}

export class AttributeConversionDto {
  @ApiProperty({ example: 'k7Qm2xR9pA', description: 'Tracking link code to attribute the conversion to' })
  @IsString()
  @MaxLength(40)
  trackingCode: string;

  @ApiPropertyOptional({ example: 'Matched manually from the provider order reference' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class IssueVoucherDto {
  @ApiProperty({ example: 'clxoffer' })
  @IsString()
  @MaxLength(40)
  offerId: string;

  @ApiProperty({ example: { type: 'PERCENTAGE_DISCOUNT', value: 10, label: '10% off' } })
  @IsObject()
  benefit: Record<string, unknown>;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsesPerCustomer?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class ReconciliationQueryDto {
  @ApiPropertyOptional({
    example: 'unmatched_conversions',
    enum: [
      'unmatched_conversions',
      'duplicate_transactions',
      'failed_syncs',
      'negative_balances',
      'over_budget_campaigns',
      'stale_providers',
      'identity_unverifiable',
    ],
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  queue?: string;
}
