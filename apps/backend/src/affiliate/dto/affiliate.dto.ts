import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AffiliateReviewDecision,
  AffiliateTaskSource,
  AffiliateTaskStatus,
} from '@prisma/client';

export class CreateAffiliateTaskDto {
  @ApiProperty({ example: 'Set up my MCOM Mall storefront' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(180)
  title: string;

  @ApiProperty({ example: 'Please upload the first 20 products and configure delivery zones.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({
    description: 'Platform tags the work may span. Must be a subset of the business platform access list.',
    example: ['mall', 'rewards'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  platforms?: string[];

  @ApiPropertyOptional({ description: 'Admin programme task definition to copy into this delegation.' })
  @IsOptional()
  @IsString()
  taskDefinitionId?: string;

  @ApiPropertyOptional({ description: 'The business user task assignment this delegation was pushed from.' })
  @IsOptional()
  @IsString()
  assignmentId?: string;

  @ApiPropertyOptional({ description: 'Explicit affiliate user to assign. Defaults to the business account manager.' })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional({ description: 'ISO deadline for the affiliate.', example: '2026-12-01T17:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class AffiliateTaskQueryDto {
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

  @ApiPropertyOptional({ enum: AffiliateTaskStatus })
  @IsOptional()
  @IsEnum(AffiliateTaskStatus)
  status?: AffiliateTaskStatus;

  @ApiPropertyOptional({ enum: AffiliateTaskSource })
  @IsOptional()
  @IsEnum(AffiliateTaskSource)
  source?: AffiliateTaskSource;

  @ApiPropertyOptional({ description: 'Filter by platform tag.' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Admin only: filter by assignee user id.' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Admin only: only show tasks still awaiting assignment.' })
  @IsOptional()
  @IsString()
  unassigned?: string;
}

export class AssignAffiliateTaskDto {
  @ApiProperty({ description: 'Affiliate user id (AGENT / ACCOUNT_MANAGER / CONSULTANT).' })
  @IsString()
  @IsNotEmpty()
  assigneeUserId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewAffiliateTaskDto {
  @ApiProperty({ enum: AffiliateReviewDecision })
  @IsEnum(AffiliateReviewDecision)
  decision: AffiliateReviewDecision;

  @ApiPropertyOptional({ example: 'Great work — just re-upload the delivery-zone screenshot.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class RateAffiliateDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Fast, clear and very helpful.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ReportAffiliateDto {
  @ApiProperty({ example: 'Unprofessional communication' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason: string;

  @ApiProperty({ example: 'Missed two agreed calls and did not respond for a week.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(5000)
  description: string;
}

export class ReviewAffiliateReportDto {
  @ApiProperty({ enum: ['VALID', 'INVALID'] })
  @IsEnum(['VALID', 'INVALID'] as const)
  decision: 'VALID' | 'INVALID';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  adminNotes?: string;
}

export class NearbyAffiliatesQueryDto {
  @ApiPropertyOptional({ enum: ['AGENT', 'ACCOUNT_MANAGER', 'CONSULTANT'] })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'M1', description: 'Postcode or outward code to filter affiliates by' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  postcode?: string;

  @ApiPropertyOptional({ example: 'design', description: 'Skill to search for (case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  skill?: string;

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
  @Max(50)
  limit?: number = 20;
}

export class AffiliateTaskStatusCallbackDto {
  @ApiProperty({ description: 'Affiliate-side task status.' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  affiliateTaskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  submissionData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  reviewAcknowledged?: boolean;
}
