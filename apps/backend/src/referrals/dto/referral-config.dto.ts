import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ReferralCommissionFrequency,
  ReferralRewardMode,
  ReferralRewardType,
} from '@prisma/client';

export class RoleRewardDto {
  @IsEnum(ReferralRewardType)
  rewardType: ReferralRewardType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedAmountGbp?: number | null;
}

export class PublishReferralConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsEnum(ReferralRewardMode)
  rewardMode: ReferralRewardMode;

  @IsEnum(ReferralRewardType)
  rewardType: ReferralRewardType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedAmountGbp?: number | null;

  @IsOptional()
  @IsObject()
  roleRewards?: Record<string, RoleRewardDto>;

  @IsArray()
  @IsString({ each: true })
  eligibleRoles: string[];

  @IsOptional()
  @IsBoolean()
  qualifyAllMemberships?: boolean;

  @IsOptional()
  @IsBoolean()
  qualifyAllAccessPasses?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifiedMembershipPlanIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifiedAccessPlanIds?: string[];

  @IsEnum(ReferralCommissionFrequency)
  commissionFrequency: ReferralCommissionFrequency;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReferralAdminQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ReferralEarningsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
