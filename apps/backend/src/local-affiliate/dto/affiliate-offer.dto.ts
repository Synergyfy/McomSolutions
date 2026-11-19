import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OfferQueryDto {
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

  @ApiPropertyOptional({ example: 'local-businesses', description: 'Category slug' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ example: 'mcom_mall', description: 'Provider code' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional({
    example: 'POINTS',
    description: 'Reward unit filter',
    enum: ['POINTS', 'CREDIT'],
  })
  @IsOptional()
  @IsIn(['POINTS', 'CREDIT'])
  rewardUnit?: 'POINTS' | 'CREDIT';

  @ApiPropertyOptional({ example: 'barber', description: 'Free-text search over title/subtitle' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: '2026-11-17', description: 'Offers active on this date (default: now)' })
  @IsOptional()
  @IsString()
  activeOn?: string;

  @ApiPropertyOptional({ example: 'createdAt', enum: ['createdAt', 'title', 'startedAt'] })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

export class CreateOfferLinkDto {
  @ApiPropertyOptional({ example: 'clx123campaign', description: 'Optional campaign to attribute the link to' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  campaignId?: string;
}
