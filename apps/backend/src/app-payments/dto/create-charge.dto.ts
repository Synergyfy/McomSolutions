import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AppChargeMethod } from '@prisma/client';

/**
 * Partner-supplied charge request. The amount arrives in MINOR units (pence)
 * as a string so no float rounding can occur before it is stored as BigInt.
 */
export class CreateChargeDto {
  @ApiProperty({
    example: '10270',
    description: 'Amount in minor units (pence) as a positive integer string — e.g. "10270" = £102.70',
  })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, {
    message: 'amountMinor must be a positive integer string in minor units (no decimals)',
  })
  amountMinor: string;

  @ApiPropertyOptional({ example: 'GBP', description: 'ISO 4217 currency code (defaults to GBP)' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO 4217 code' })
  currency?: string;

  @ApiProperty({ enum: AppChargeMethod, example: 'stripe', description: 'Payment method' })
  @IsEnum(AppChargeMethod)
  method: AppChargeMethod;

  @ApiProperty({ example: 'order_12345', description: "Your app's order/invoice reference" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reference: string;

  @ApiPropertyOptional({ example: 'Pro plan renewal', description: 'Human-readable description' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({
    example: 'user_abc123',
    description: 'MCOM user id of the payer (required for the wallet method)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  mcomUserId?: string;

  @ApiPropertyOptional({ example: 'cust_987', description: "Your app's own customer id" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  externalCustomerId?: string;

  @ApiPropertyOptional({ example: { cartId: 'c_1' }, description: 'Arbitrary structured metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
