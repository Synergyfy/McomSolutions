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

export class DebitWalletDto {
  @ApiProperty({ example: 'user_abc123', description: 'McomSolutions user ID to debit' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 50, description: 'Amount to debit (positive, MCOM credits). Enforced server-side by WALLET_MAX_SINGLE_TXN.' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: ['SUBSCRIPTION', 'PURCHASE', 'SERVICE_FEE', 'ADMIN_DEBIT', 'TRANSFER_OUT'],
    example: 'SUBSCRIPTION',
    description: 'Transaction category',
  })
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @ApiProperty({ example: 'MCOM Mall Gold Package — August 2026', description: 'Human-readable description' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiPropertyOptional({ example: 'sub_inv_0042', description: 'Your invoice/order ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ example: { packageId: 'gold-monthly' }, description: 'Arbitrary structured metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}