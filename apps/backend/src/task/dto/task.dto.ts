import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TaskAudience, TaskAssignmentStatus } from '@prisma/client';

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

  @ApiProperty({
    example: 'business.logo_uploaded',
    description: 'The feature key trigger that marks this task completed automatically',
  })
  @IsString()
  @IsNotEmpty()
  featureKey: string;

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
