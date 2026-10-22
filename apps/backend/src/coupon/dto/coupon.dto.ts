import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CouponDiscountType, CouponRedemptionStatus, CouponSource } from '@prisma/client';

export const COUPON_STATUSES = ['active', 'scheduled', 'expired', 'exhausted', 'inactive'] as const;
export type CouponStatusFilter = (typeof COUPON_STATUSES)[number];

export const COUPON_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export class CreateCouponDto {
  @ApiProperty({ example: 'MCOM-20OFF', description: 'Unique code (case-insensitive, stored uppercase)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(COUPON_CODE_REGEX, {
    message: 'Code must be 3–40 characters using letters, numbers, hyphens or underscores.',
  })
  code: string;

  @ApiPropertyOptional({ example: '20% off the Gold membership', maxLength: 250 })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;

  @ApiProperty({ enum: CouponDiscountType, example: CouponDiscountType.PERCENTAGE })
  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  @ApiProperty({ example: 20, description: 'Percentage (1–99) or fixed GBP amount' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  discountValue: number;

  @ApiPropertyOptional({ example: true, description: 'True = all memberships, false = selected plans only' })
  @IsOptional()
  @IsBoolean()
  appliesToAllMemberships?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['plan-id-1'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  membershipPlanIds?: string[];

  @ApiPropertyOptional({ example: false, description: 'True = all access passes, false = selected access plans only' })
  @IsOptional()
  @IsBoolean()
  appliesToAllAccess?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['access-plan-id-1'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  accessPlanIds?: string[];

  @ApiPropertyOptional({ example: 100, description: 'Maximum completed redemptions (omit for unlimited)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @ApiPropertyOptional({ example: 1, description: 'Maximum completed redemptions per user' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number | null;

  @ApiPropertyOptional({ example: '2026-10-21T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'user-id', description: 'Optional: lock this code to one person' })
  @IsOptional()
  @IsString()
  lockedToUserId?: string | null;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class UpdateCouponStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;
}

export class QueryCouponsDto {
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
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'MCOM' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ enum: COUPON_STATUSES })
  @IsOptional()
  @IsIn([...COUPON_STATUSES])
  status?: CouponStatusFilter;

  @ApiPropertyOptional({ enum: CouponSource })
  @IsOptional()
  @IsEnum(CouponSource)
  source?: CouponSource;

  @ApiPropertyOptional({ enum: CouponDiscountType })
  @IsOptional()
  @IsEnum(CouponDiscountType)
  discountType?: CouponDiscountType;

  @ApiPropertyOptional({ example: 'plan-id' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'access-plan-id' })
  @IsOptional()
  @IsString()
  accessPlanId?: string;
}

export class QueryCouponRedemptionsDto {
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
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'MCOM' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ enum: CouponRedemptionStatus })
  @IsOptional()
  @IsEnum(CouponRedemptionStatus)
  status?: CouponRedemptionStatus;

  @ApiPropertyOptional({ example: 'coupon-id' })
  @IsOptional()
  @IsString()
  couponId?: string;

  @ApiPropertyOptional({ example: 'plan-id' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'access-plan-id' })
  @IsOptional()
  @IsString()
  accessPlanId?: string;

  @ApiPropertyOptional({ example: 'business-id' })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional({ enum: CouponSource })
  @IsOptional()
  @IsEnum(CouponSource)
  source?: CouponSource;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class CouponUserLookupQueryDto {
  @ApiProperty({ example: 'acme' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  search: string;
}
