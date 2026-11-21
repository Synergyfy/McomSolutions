import { ApiPropertyOptional } from '@nestjs/swagger';
import { GlIntent } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class TransferQueryDto {
  @ApiPropertyOptional({ enum: GlIntent, description: 'Filter by business intent' })
  @IsOptional()
  @IsEnum(GlIntent)
  intent?: GlIntent;

  @ApiPropertyOptional({ example: 'mcom-mall', description: 'Filter by registered app client id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformId?: string;

  @ApiPropertyOptional({ example: 'order_12345', description: 'Business reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ example: 'wallet:w1', description: 'Only transfers touching this account' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountCode?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 'order_12345' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

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

export class AccountsQueryDto {
  @ApiPropertyOptional({ example: 'LIABILITY_USER_WALLET' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;

  @ApiPropertyOptional({ example: 'wallet' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  scope?: string;

  @ApiPropertyOptional({ example: 'payable:app:' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ example: '2026-10-21' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], example: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';

  @ApiPropertyOptional({ example: 'mcom-mall' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformId?: string;

  @ApiPropertyOptional({ enum: GlIntent, example: 'ORDER' })
  @IsOptional()
  @IsEnum(GlIntent)
  intent?: GlIntent;
}

export class EventQueryDto {
  @ApiPropertyOptional({ example: 'mcom-mall' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformId?: string;

  @ApiPropertyOptional({ enum: GlIntent, example: 'ORDER' })
  @IsOptional()
  @IsEnum(GlIntent)
  intent?: GlIntent;

  @ApiPropertyOptional({ example: 'order_12345' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsString()
  dateTo?: string;

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
