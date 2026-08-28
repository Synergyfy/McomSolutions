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

export class CreditWalletDto {
  @ApiProperty({ example: 'user_abc123', description: 'McomSolutions user ID to credit' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 15, description: 'Amount to credit (positive, MCOM credits). Enforced server-side by WALLET_MAX_SINGLE_TXN.' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    enum: ['REWARD', 'REFUND', 'ADMIN_CREDIT', 'TRANSFER_IN'],
    example: 'REWARD',
    description: 'Transaction category',
  })
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @ApiProperty({ example: 'Campaign Cashback #5', description: 'Human-readable description' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiPropertyOptional({ example: 'reward-campaign-5', description: 'Your reward/refund reference' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ example: { campaignId: 'camp_5' }, description: 'Arbitrary structured metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}