import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  ValidateNested,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PlanQuotasDto {
  // MCOM Mall quotas
  @ApiPropertyOptional({ example: 100, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxListings?: number

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowProductListing?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowServiceListing?: boolean

  @ApiPropertyOptional({ example: 50, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxProducts?: number

  @ApiPropertyOptional({ example: 50, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxServices?: number

  @ApiPropertyOptional({ example: 5, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxGiftCardTemplates?: number

  @ApiPropertyOptional({ example: 10, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCouponTemplates?: number

  @ApiPropertyOptional({ example: 1, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxLoyaltyPrograms?: number

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxImagesPerListing?: number

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  featuredListingAllowance?: number

  // MCOM Rewards quotas
  @ApiPropertyOptional({ example: 5, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxActiveCampaigns?: number

  @ApiPropertyOptional({ example: 10, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxActiveRewards?: number

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxRewardsPerCampaign?: number

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  monthlyPointsAllowance?: number

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  monthlyStampsAllowance?: number

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  monthlyRewardBudget?: number

  @ApiPropertyOptional({ example: 2, description: '-1 for unlimited' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxTeamMembers?: number

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxRewardPoints?: number
}

class PlanFeatureFlagsDto {
  // MCOM Mall feature flags
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  priorityInSearch?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  advancedAnalytics?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  dedicatedSupport?: boolean

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowCustomBranding?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowGroupCreation?: boolean

  // MCOM Rewards feature flags
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  canCreateCampaignFromScratch?: boolean

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  canEditAdminTemplates?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasAccessToAdvancedAnalytics?: boolean

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasAccessToCRM?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  canUpdateReward?: boolean

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  canCreateRewardFromScratch?: boolean
}

class PlanConfigurationDto {
  @ApiPropertyOptional({ type: PlanQuotasDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanQuotasDto)
  quotas?: PlanQuotasDto

  @ApiPropertyOptional({ type: PlanFeatureFlagsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanFeatureFlagsDto)
  featureFlags?: PlanFeatureFlagsDto
}

export class CreateExternalPlanDto {
  @ApiProperty({ example: 'Gold Plan', description: 'Plan name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 'MCOM Mall', description: 'Target platform for the plan' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['MCOM Mall', 'MCOM Rewards', 'MCOM Spin', 'GBS Audit', 'GBS Expo'])
  platform: string

  @ApiPropertyOptional({ example: 'Premium tier for established businesses' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ example: 29.99 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  monthlyPrice?: number

  @ApiPropertyOptional({ example: 79.99 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  quarterlyPrice?: number

  @ApiPropertyOptional({ example: 299.99 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  annualPrice?: number

  @ApiPropertyOptional({ example: ['Priority support', 'Unlimited listings'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[]

  @ApiPropertyOptional({ type: PlanConfigurationDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanConfigurationDto)
  configuration?: PlanConfigurationDto

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @ApiPropertyOptional({ example: 'STANDARD', enum: ['STANDARD', 'TRIAL', 'SEASONAL'] })
  @IsOptional()
  @IsString()
  @IsIn(['STANDARD', 'TRIAL', 'SEASONAL'])
  type?: string

  @ApiPropertyOptional({ example: 14, description: 'Trial duration in days (required if type is TRIAL)' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  trialDuration?: number

  @ApiPropertyOptional({ description: 'Season ID (required if type is SEASONAL)' })
  @IsOptional()
  @IsString()
  seasonId?: string

  @ApiPropertyOptional({ example: 'price_abc123' })
  @IsOptional()
  @IsString()
  stripeMonthlyPriceId?: string

  @ApiPropertyOptional({ example: 'price_def456' })
  @IsOptional()
  @IsString()
  stripeQuarterlyPriceId?: string

  @ApiPropertyOptional({ example: 'price_ghi789' })
  @IsOptional()
  @IsString()
  stripeAnnualPriceId?: string

  @ApiPropertyOptional({ example: 'P-123456' })
  @IsOptional()
  @IsString()
  paypalMonthlyPlanId?: string

  @ApiPropertyOptional({ example: 'P-789012' })
  @IsOptional()
  @IsString()
  paypalQuarterlyPlanId?: string

  @ApiPropertyOptional({ example: 'P-345678' })
  @IsOptional()
  @IsString()
  paypalAnnualPlanId?: string
}

export class UpdateExternalPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  monthlyPrice?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  quarterlyPrice?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  annualPrice?: number

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[]

  @ApiPropertyOptional({ type: PlanConfigurationDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanConfigurationDto)
  configuration?: PlanConfigurationDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeMonthlyPriceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeQuarterlyPriceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeAnnualPriceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paypalMonthlyPlanId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paypalQuarterlyPlanId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paypalAnnualPlanId?: string
}
