import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionCategory, TransactionStatus, TransactionType } from '@prisma/client';

/**
 * Composable filter set for transaction list endpoints. All fields optional.
 */
export class FilterTransactionsDto {
  @ApiPropertyOptional({ example: 'mall', description: 'Filter by platform slug' })
  @IsOptional()
  @IsString()
  platformSlug?: string;

  @ApiPropertyOptional({ example: 'mcom-mall', description: 'Filter by platform client ID' })
  @IsOptional()
  @IsString()
  platformClientId?: string;

  @ApiPropertyOptional({ enum: ['CREDIT', 'DEBIT'], example: 'DEBIT' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: TransactionCategory, example: 'SUBSCRIPTION' })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiPropertyOptional({ enum: TransactionStatus, example: 'COMPLETED' })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Start date (inclusive)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'End date (inclusive to 23:59:59)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 'inv-0042', description: 'Searches description + reference' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '10', description: 'Minimum amount' })
  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  @ApiPropertyOptional({ example: '500', description: 'Maximum amount' })
  @IsOptional()
  @IsNumberString()
  maxAmount?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, description: 'Max 100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class WalletSummaryQueryDto {
  @ApiPropertyOptional({ enum: ['30d', '90d', '1y'], default: '30d' })
  @IsOptional()
  @IsString()
  period?: '30d' | '90d' | '1y' = '30d';
}

export class AdminWalletQueryDto {
  @ApiPropertyOptional({ example: 'john@mcom.com', description: 'Search by user email or user ID' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED'], example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Max 100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}