import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A business (or external business operator) validates a voucher a referred
 * customer presented. Idempotent per (voucher, customer).
 */
export class ValidateVoucherDto {
  @ApiProperty({ example: 'ABCD-EFGH' })
  @IsString()
  @MaxLength(32)
  code: string;

  @ApiPropertyOptional({
    example: 'customer-email-or-chs-user-id',
    description:
      'Opaque customer reference used to enforce one-per-customer. Falls back to a per-request anonymous key when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerRef?: string;

  @ApiPropertyOptional({ example: 2500, description: 'Basket amount in minor units' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountMinor?: number;

  @ApiPropertyOptional({ example: 'POS', enum: ['ONLINE', 'POS', 'MANUAL', 'API'] })
  @IsOptional()
  @IsIn(['ONLINE', 'POS', 'MANUAL', 'API'])
  channel?: 'ONLINE' | 'POS' | 'MANUAL' | 'API';

  @ApiPropertyOptional({ example: 'TXN-99812' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  posReference?: string;
}

export class ReverseRedemptionDto {
  @ApiPropertyOptional({ example: 'Customer cancelled within the window' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
