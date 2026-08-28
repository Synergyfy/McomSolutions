import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionCategory } from '@prisma/client';

export class AdminAdjustWalletDto {
  @ApiProperty({ example: 100, description: 'Amount to credit/debit (positive). Enforced server-side by WALLET_MAX_SINGLE_TXN.' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: ['ADMIN_CREDIT', 'ADMIN_DEBIT', 'REWARD', 'REFUND'],
    example: 'ADMIN_CREDIT',
  })
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @ApiProperty({ example: 'Goodwill adjustment after support review' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 'Customer requested manual top-up', description: 'Mandatory compliance reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ example: 'ref-xyz', description: 'Reference for the ledger entry' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ example: { ticketId: 'TK-123' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class AdminWalletActionDto {
  @ApiProperty({ example: 'Suspected fraudulent activity', description: 'Mandatory compliance reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class AdminWalletLimitsDto {
  @ApiPropertyOptional({ example: 50000, description: 'Daily debit limit in MCOM credits' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  dailyDebitLimit?: number;

  @ApiPropertyOptional({ example: 200000, description: 'Monthly debit limit in MCOM credits' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monthlyDebitLimit?: number;

  @ApiPropertyOptional({ example: 1000000, description: 'Maximum wallet balance' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  maxBalance?: number;
}

export class ReverseTransactionDto {
  @ApiProperty({ example: 'Wrong amount debited', description: 'Mandatory reason for the compensating reversal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}