import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
  Max,
  Min,
} from 'class-validator';
import { CouponDiscountType, TaskAccessScope, TaskAudience, TaskAssignmentStatus, TaskSource, TaskSubmissionType } from '@prisma/client';

export class CreateTaskDefinitionDto {
  @ApiProperty({ example: 'Upload Business Logo', description: 'Task title shown to the user' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Upload your high-resolution business logo for your storefront', description: 'Task description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    enum: TaskAudience,
    example: TaskAudience.BUSINESS,
    description: 'Target audience: BUSINESS, CUSTOMER, or BOTH',
  })
  @IsEnum(TaskAudience)
  targetAudience: TaskAudience;

  @ApiPropertyOptional({
    enum: TaskAccessScope,
    example: TaskAccessScope.ALL,
    description:
      'Access scope: ALL (paid members and trial users), PAID (paid members only), or TRIAL (trial users only)',
  })
  @IsOptional()
  @IsEnum(TaskAccessScope)
  accessScope?: TaskAccessScope;

  @ApiPropertyOptional({
    enum: TaskSubmissionType,
    example: TaskSubmissionType.AUTO,
    description:
      'How the task is completed: AUTO (event worker), EXTERNAL_LINK (user opens the admin-supplied link then confirms completion), TEXT_INPUT, DIGIT_INPUT, or IMAGE_UPLOAD',
  })
  @IsOptional()
  @IsEnum(TaskSubmissionType)
  submissionType?: TaskSubmissionType;

  @ApiPropertyOptional({
    enum: TaskSource,
    example: TaskSource.INTERNAL,
    description: 'Task source: INTERNAL (auto-completed by MCOM Central event worker) or EXTERNAL (manual completion on a console-registered platform)',
  })
  @IsOptional()
  @IsEnum(TaskSource)
  taskSource?: TaskSource;

  @ApiPropertyOptional({
    example: 'https://mcomsolutions.com/grow-your-business',
    description:
      'Destination link the user must open for EXTERNAL_LINK tasks. Required when submissionType is EXTERNAL_LINK; the task completes once the user opens it and confirms completion.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  actionUrl?: string;

  @ApiPropertyOptional({
    example: 'Open the guide',
    description: 'Optional label for the button that opens the action link (defaults to "Open link")',
  })
  @IsOptional()
  @IsString()
  actionLabel?: string;

  @ApiPropertyOptional({
    example: 'business.logo_uploaded',
    description: 'The feature key trigger that marks this task completed automatically. Required for INTERNAL tasks; must be omitted for EXTERNAL tasks.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  featureKey?: string;

  @ApiPropertyOptional({
    example: 'mcom-mall',
    description: 'Console-registered app clientId (from /admin/console). Required for EXTERNAL tasks; must be omitted for INTERNAL tasks.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalClientId?: string;

  @ApiProperty({ example: 7, description: 'Number of days from assignment to complete the task' })
  @IsInt()
  @Min(1)
  deadlineDays: number;

  @ApiProperty({ example: 50, description: 'Reward in points credited to wallet upon completion' })
  @IsInt()
  @Min(0)
  rewardPoints: number;

  @ApiPropertyOptional({ example: true, description: 'Whether the task definition is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Issue a personal coupon when this task is completed' })
  @IsOptional()
  @IsBoolean()
  rewardCouponEnabled?: boolean;

  @ApiPropertyOptional({ enum: CouponDiscountType, example: CouponDiscountType.PERCENTAGE })
  @IsOptional()
  @IsEnum(CouponDiscountType)
  rewardCouponDiscountType?: CouponDiscountType;

  @ApiPropertyOptional({ example: 20, description: 'Percentage (1–99) or fixed GBP amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000)
  rewardCouponValue?: number;

  @ApiPropertyOptional({ example: true, description: 'True = all memberships, false = selected plans' })
  @IsOptional()
  @IsBoolean()
  rewardCouponAppliesToAll?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['plan-id-1'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rewardCouponPlanIds?: string[];

  @ApiPropertyOptional({ example: false, description: 'True = all access passes, false = selected access plans' })
  @IsOptional()
  @IsBoolean()
  rewardCouponAppliesToAllAccess?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['access-plan-id-1'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rewardCouponAccessPlanIds?: string[];

  @ApiPropertyOptional({ example: 30, description: 'Days after issuance before the reward coupon expires' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  rewardCouponValidDays?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Absolute expiry for issued reward coupons' })
  @IsOptional()
  @IsISO8601()
  rewardCouponExpiresAt?: string;

  @ApiPropertyOptional({ example: 'mcom_central', description: 'Platform identifier' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class UpdateTaskDefinitionDto extends PartialType(CreateTaskDefinitionDto) {}

export class AssignTaskDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['user-id-1', 'user-id-2'],
    description: 'Optional list of user IDs to assign to. If omitted, bulk assigns to all eligible users.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}

export class UpdateAssignmentStatusDto {
  @ApiProperty({
    enum: TaskAssignmentStatus,
    example: TaskAssignmentStatus.COMPLETED,
    description: 'New assignment status',
  })
  @IsEnum(TaskAssignmentStatus)
  status: TaskAssignmentStatus;

  @ApiPropertyOptional({
    example: true,
    description: 'If setting status to COMPLETED, whether to grant the reward points immediately if not yet granted',
  })
  @IsOptional()
  @IsBoolean()
  grantReward?: boolean;
}

export class QueryAssignmentsDto {
  @ApiPropertyOptional({ enum: TaskAssignmentStatus })
  @IsOptional()
  @IsEnum(TaskAssignmentStatus)
  status?: TaskAssignmentStatus;

  @ApiPropertyOptional({ example: 'barber' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class QueryProgrammeUsersDto {
  @ApiPropertyOptional({ example: 'acme', description: 'Search by name, business name, or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'BUSINESS', 'CUSTOMER'],
    example: 'ALL',
    description: 'Filter by user type',
  })
  @IsOptional()
  @IsIn(['ALL', 'BUSINESS', 'CUSTOMER'])
  role?: 'ALL' | 'BUSINESS' | 'CUSTOMER';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
