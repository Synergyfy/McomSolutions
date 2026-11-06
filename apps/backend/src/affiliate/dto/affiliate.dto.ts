import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AffiliateCompensationModel,
  AffiliateReviewDecision,
  AffiliateSettlementFunding,
  AffiliateSettlementStatus,
  AffiliateTaskCategory,
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

  @ApiPropertyOptional({ description: 'Project this task belongs to (groups related tasks).' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: AffiliateTaskCategory, description: 'Internal platform task or external professional task.' })
  @IsOptional()
  @IsEnum(AffiliateTaskCategory)
  category?: AffiliateTaskCategory;

  @ApiPropertyOptional({ type: [String], example: ['Design', 'Branding'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  requiredSkills?: string[];

  @ApiPropertyOptional({ example: 'Two 1080x1080 banners, PNG + source file.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  deliverables?: string;

  @ApiPropertyOptional({ example: 'Logo, brand colours and product photos in the shared drive.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  materials?: string;

  @ApiPropertyOptional({ description: 'Another task that must be approved before this one can start.' })
  @IsOptional()
  @IsString()
  prerequisiteTaskId?: string;

  @ApiPropertyOptional({ description: 'The business owner must approve the submitted outcome.' })
  @IsOptional()
  @Type(() => Boolean)
  requiresBusinessApproval?: boolean;

  @ApiPropertyOptional({ enum: AffiliateCompensationModel, description: 'How the assigned affiliate is compensated.' })
  @IsOptional()
  @IsEnum(AffiliateCompensationModel)
  compensationModel?: AffiliateCompensationModel;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  compensationAmount?: number;

  @ApiPropertyOptional({
    example: 7500,
    description: 'Affiliate compensation in pence; takes precedence over compensationAmount.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compensationPence?: number;

  @ApiPropertyOptional({ example: 'GBP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  compensationCurrency?: string;

  @ApiPropertyOptional({ description: 'Charge the business separately for this task.' })
  @IsOptional()
  @Type(() => Boolean)
  billableToBusiness?: boolean;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  businessChargeAmount?: number;

  @ApiPropertyOptional({ example: 'GBP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  businessChargeCurrency?: string;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Platform fee percentage deducted from the business charge. Clamped to the spread so the affiliate payout is never reduced. Defaults to the programme setting.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  platformFeePercent?: number;
}

export class AdminCreateAffiliateTaskDto extends CreateAffiliateTaskDto {
  @ApiProperty({
    description: 'Business profile id the task is being created on behalf of (admin only).',
  })
  @IsString()
  @IsNotEmpty()
  businessId: string;
}

export class CreateAffiliateServiceRequestDto {
  @ApiProperty({ example: 'Promote my new product collection' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(180)
  title: string;

  @ApiProperty({ example: 'We launch next month and need the collection live on MCOM Mall with a banner.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ example: 'Customers can find and buy the new collection from launch day.' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  desiredOutcome?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsEnum(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const)
  urgency?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export class ClarifyServiceRequestDto {
  @ApiProperty({ example: 'Please confirm the product count and whether you supply photography.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  note: string;
}

export class ApproveServiceRequestDto {
  @ApiPropertyOptional({ example: 150, description: 'Quoted/estimated cost shown to the business.' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional({ example: 'GBP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Includes design and publication.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateAffiliateProjectDto {
  @ApiProperty({ example: 'New Product Collection Launch' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(180)
  title: string;

  @ApiProperty({ example: 'Design, upload and publish the spring collection.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ example: 'The collection is live and visible on MCOM Mall.' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceRequestId?: string;

  @ApiPropertyOptional({ example: '2026-12-15T17:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  requiresBusinessApproval?: boolean;
}

export class CloseAffiliateProjectDto {
  @ApiProperty({ example: 'Collection launched on 12 December; business confirmed sales started.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  outcomeSummary: string;

  @ApiPropertyOptional({ example: 'Follow up in January about the second batch of photos.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  followUpNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  followUpRequired?: boolean;
}

export class ApproveBusinessChargeDto {
  @ApiProperty({ enum: ['APPROVED', 'DECLINED'] })
  @IsEnum(['APPROVED', 'DECLINED'] as const)
  decision: 'APPROVED' | 'DECLINED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
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

  @ApiPropertyOptional({
    example: 2000,
    description:
      'Affiliate compensation in pence (2000 = £20.00). Entered by the admin when approving membership / access-pass funded work.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  compensationPence?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Affiliate compensation in GBP. Converted to pence server-side.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  compensationAmount?: number;
}

export class ReviewBusinessTaskDto extends ReviewAffiliateTaskDto {
  @ApiPropertyOptional({ description: 'Business acceptance notes.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  acceptanceNotes?: string;
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

  @ApiPropertyOptional({ description: 'Admin/account manager: filter by business id.' })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional({ description: 'Filter tasks by project.' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: AffiliateTaskCategory })
  @IsOptional()
  @IsEnum(AffiliateTaskCategory)
  category?: AffiliateTaskCategory;
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

  @ApiPropertyOptional({ enum: AffiliateCompensationModel })
  @IsOptional()
  @IsEnum(AffiliateCompensationModel)
  compensationModel?: AffiliateCompensationModel;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  compensationAmount?: number;

  @ApiPropertyOptional({
    example: 7500,
    description: 'Affiliate compensation in pence; takes precedence over compensationAmount.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compensationPence?: number;

  @ApiPropertyOptional({ example: 'GBP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  compensationCurrency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  billableToBusiness?: boolean;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  businessChargeAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  requiresBusinessApproval?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Optional platform fee percentage for this assignment. The fee is taken from the charge spread; the affiliate payout is never reduced.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  platformFeePercent?: number;
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

  @ApiPropertyOptional({
    example: 10,
    description: 'Only return affiliates within this many miles of the business postcode.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusMiles?: number;

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

  @ApiPropertyOptional({ description: 'Only return affiliates currently marked available.' })
  @IsOptional()
  @IsString()
  availableOnly?: string;
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

  @ApiPropertyOptional({
    description: 'Why the affiliate declined the assignment. Shown to the business and admins.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  declineReason?: string;
}

export class AffiliateSettlementQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: AffiliateSettlementStatus })
  @IsOptional()
  @IsEnum(AffiliateSettlementStatus)
  status?: AffiliateSettlementStatus;

  @ApiPropertyOptional({ enum: AffiliateSettlementFunding })
  @IsOptional()
  @IsEnum(AffiliateSettlementFunding)
  fundingSource?: AffiliateSettlementFunding;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  affiliateUserId?: string;

  @ApiPropertyOptional({ description: 'Task title, affiliate email or settlement reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
