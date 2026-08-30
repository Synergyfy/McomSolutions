import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { OmitType, PartialType } from '@nestjs/swagger';

// ─── System API Keys ───────────────────────────────────────────────
export class CreateSystemApiKeyDto {
  @ApiProperty({ example: 'Production Mall Key', description: 'Human-readable key name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: ['mall:read', 'rewards:write'], description: 'Permissions granted to the key' })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateSystemApiKeyDto extends PartialType(CreateSystemApiKeyDto) {
  @ApiPropertyOptional({ example: 'Revoked', enum: ['Active', 'Revoked'], description: 'Key status' })
  @IsOptional()
  @IsString()
  status?: string;
}

// ─── System Integrations ───────────────────────────────────────────
export class CreateSystemIntegrationDto {
  @ApiProperty({ example: 'Stripe Payments', description: 'Integration name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'payment', description: 'Integration type/category' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: 'Connected', enum: ['Connected', 'Disconnected', 'Error'], description: 'Integration status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z', description: 'Last sync timestamp' })
  @IsOptional()
  @IsDateString()
  lastSync?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z', description: 'Date connected' })
  @IsOptional()
  @IsDateString()
  connectedDate?: string;
}

export class UpdateSystemIntegrationDto extends PartialType(CreateSystemIntegrationDto) {}

// ─── Assessment Questions ──────────────────────────────────────────
export class CreateAssessmentQuestionDto {
  @ApiProperty({ example: 'What sector does your business operate in?', description: 'Question text' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ example: 'Briefcase', description: 'Icon name from the icon set' })
  @IsString()
  @IsNotEmpty()
  iconName: string;

  @ApiProperty({
    example: 'single-choice',
    enum: ['single-choice', 'multi-choice', 'text', 'textarea', 'number', 'date', 'rating', 'yes-no'],
    description: 'Field type',
  })
  @IsEnum(['single-choice', 'multi-choice', 'text', 'textarea', 'number', 'date', 'rating', 'yes-no'])
  fieldType:
    | 'single-choice'
    | 'multi-choice'
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'rating'
    | 'yes-no';

  @ApiPropertyOptional({ example: ['Retail', 'Hospitality'], description: 'Options for choice fields' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: 'Select the one that best fits', description: 'Helper hint text' })
  @IsOptional()
  @IsString()
  hint?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the question is active' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Display order' })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateAssessmentQuestionDto extends PartialType(CreateAssessmentQuestionDto) {}

export class ReorderAssessmentQuestionsDto {
  @ApiProperty({ example: ['q1', 'q2', 'q3'], description: 'Ordered question IDs' })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

// ─── Activity Feed ──────────────────────────────────────────────────
export class CreateActivityFeedDto {
  @ApiProperty({ example: 'foot_traffic_spike', description: 'Activity type' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'Marylebone Zone spike detected', description: 'Activity title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: '+22% foot traffic compared to last week', description: 'Detail text' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ example: 'Marylebone', description: 'Location label' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'success', enum: ['info', 'success', 'warning', 'danger'], description: 'Severity level' })
  @IsOptional()
  @IsEnum(['info', 'success', 'warning', 'danger'])
  severity?: 'info' | 'success' | 'warning' | 'danger';

  @ApiPropertyOptional({ example: 'MCOM Central', description: 'Source system' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'hs_123', description: 'Related high street ID' })
  @IsOptional()
  @IsString()
  highStreetId?: string;
}

export class UpdateActivityFeedDto extends PartialType(CreateActivityFeedDto) {}

export class ActivityQueryDto {
  @ApiPropertyOptional({ example: 'hs_123', description: 'Filter by high street ID' })
  @IsOptional()
  @IsString()
  highStreetId?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ─── Borough Metrics ────────────────────────────────────────────────
export class CreateBoroughMetricDto {
  @ApiProperty({ example: '2026-07', description: 'Month in YYYY-MM format' })
  @IsString()
  @IsNotEmpty()
  month: string;

  @ApiPropertyOptional({ example: 8200, description: 'Footfall for the month' })
  @IsOptional()
  @IsInt()
  footfall?: number;

  @ApiPropertyOptional({ example: 1420000, description: 'Revenue for the month' })
  @IsOptional()
  @IsNumber()
  revenue?: number;

  @ApiPropertyOptional({ example: 42500, description: 'Active customers for the month' })
  @IsOptional()
  @IsInt()
  activeCustomers?: number;

  @ApiPropertyOptional({ example: 1284, description: 'Business count for the month' })
  @IsOptional()
  @IsInt()
  businesses?: number;
}

export class UpdateBoroughMetricDto extends PartialType(CreateBoroughMetricDto) {}

// ─── Background Jobs ────────────────────────────────────────────────
export class CreateBackgroundJobDto {
  @ApiProperty({ example: 'Expire subscriptions', description: 'Job name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'pending', enum: ['pending', 'running', 'completed', 'failed'], description: 'Job status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 0, description: 'Progress percent (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  progress?: number;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z', description: 'Started at timestamp' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({ example: '2026-07-01T01:00:00.000Z', description: 'Completed at timestamp' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional({ example: '', description: 'Error message if failed' })
  @IsOptional()
  @IsString()
  error?: string;
}

export class UpdateBackgroundJobDto extends PartialType(CreateBackgroundJobDto) {}

// ─── Error Logs ─────────────────────────────────────────────────────
export class CreateErrorLogDto {
  @ApiPropertyOptional({ example: 'error', enum: ['error', 'warn', 'info'], description: 'Log level' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiProperty({ example: 'Failed to connect to external service', description: 'Log message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ example: 'Error: ...', description: 'Stack trace' })
  @IsOptional()
  @IsString()
  stack?: string;

  @ApiPropertyOptional({ example: 'PaymentService', description: 'Source of the error' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: '/api/v1/payments', description: 'Request path' })
  @IsOptional()
  @IsString()
  path?: string;
}

// ─── External Platform Packages ───────────────────────────────────────
export class CreateExternalPlanDto {
  @ApiProperty({ example: 'MCOM Mall Basic', description: 'Plan name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'MCOM Mall', description: 'External platform this plan belongs to' })
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiPropertyOptional({ example: 'Entry tier for MCOM Mall merchants', description: 'Plan description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 9.99, description: 'Monthly price (minor-unit decimal)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional({ example: 24.99, description: 'Quarterly price (minor-unit decimal)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quarterlyPrice?: number;

  @ApiPropertyOptional({ example: 89.99, description: 'Annual price (minor-unit decimal)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualPrice?: number;

  @ApiPropertyOptional({ type: [String], example: ['Online store', 'Inventory sync'], description: 'Included features' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: { quotas: { products: 100 }, featureFlags: { loyalty: true } }, description: 'Arbitrary plan configuration (quotas/feature flags)' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true, description: 'Whether the plan is currently active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Whether this is the default plan for its platform' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 'standard', description: 'Plan type/category' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 14, description: 'Trial duration in days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDuration?: number;

  @ApiPropertyOptional({ example: 'season_2026', description: 'Related season ID' })
  @IsOptional()
  @IsString()
  seasonId?: string;

  @ApiPropertyOptional({ example: 'price_1ABC', description: 'Stripe monthly price ID' })
  @IsOptional()
  @IsString()
  stripeMonthlyPriceId?: string;

  @ApiPropertyOptional({ example: 'price_1DEF', description: 'Stripe quarterly price ID' })
  @IsOptional()
  @IsString()
  stripeQuarterlyPriceId?: string;

  @ApiPropertyOptional({ example: 'price_1GHI', description: 'Stripe annual price ID' })
  @IsOptional()
  @IsString()
  stripeAnnualPriceId?: string;

  @ApiPropertyOptional({ example: 'P-ABC123', description: 'PayPal monthly plan ID' })
  @IsOptional()
  @IsString()
  paypalMonthlyPlanId?: string;

  @ApiPropertyOptional({ example: 'P-DEF456', description: 'PayPal quarterly plan ID' })
  @IsOptional()
  @IsString()
  paypalQuarterlyPlanId?: string;

  @ApiPropertyOptional({ example: 'P-GHI789', description: 'PayPal annual plan ID' })
  @IsOptional()
  @IsString()
  paypalAnnualPlanId?: string;
}

export class UpdateExternalPlanDto extends OmitType(PartialType(CreateExternalPlanDto), ['platform'] as const) {}
