import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CampaignQueryDto {
  @ApiPropertyOptional({ example: 'high_street', enum: ['high_street', 'borough', 'local_mall'], description: 'Filter by location type' })
  @IsOptional()
  @IsEnum(['high_street', 'borough', 'local_mall'])
  locationType?: 'high_street' | 'borough' | 'local_mall';

  @ApiPropertyOptional({ example: 'hs_123', description: 'Filter by location ID' })
  @IsOptional()
  @IsString()
  locationId?: string;

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

export class CreateCampaignDto {
  @ApiProperty({ example: 'Summer Rewards Push', description: 'Campaign name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Boost footfall with a points bonus across participating merchants', description: 'Campaign description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'high_street', enum: ['high_street', 'borough', 'local_mall'], description: 'Where the campaign is targeted' })
  @IsEnum(['high_street', 'borough', 'local_mall'])
  locationType: 'high_street' | 'borough' | 'local_mall';

  @ApiPropertyOptional({ example: 'hs_123', description: 'Target location ID (high street / borough / local mall)' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ example: 'Rye Lane', description: 'Target location display name' })
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiPropertyOptional({ example: 'draft', enum: ['active', 'paused', 'completed', 'draft'], description: 'Campaign status' })
  @IsOptional()
  @IsEnum(['active', 'paused', 'completed', 'draft'])
  status?: 'active' | 'paused' | 'completed' | 'draft';

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z', description: 'Campaign start date (ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31T00:00:00.000Z', description: 'Campaign end date (ISO)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class CampaignActionDto {
  @ApiProperty({ example: 'pause', enum: ['pause', 'resume', 'complete'], description: 'Action to perform on the campaign' })
  @IsEnum(['pause', 'resume', 'complete'])
  action: 'pause' | 'resume' | 'complete';
}