import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AppChargeMethod, GlIntent } from '@prisma/client';

/** One payee's share of a charge. */
export class ChargeSplitDto {
  @ApiProperty({
    enum: ['mcom_user', 'external'],
    example: 'mcom_user',
    description:
      'mcom_user credits that user\'s wallet; external parks the share on a payee payable until payout',
  })
  @IsIn(['mcom_user', 'external'])
  payeeType: 'mcom_user' | 'external';

  @ApiPropertyOptional({
    example: 'user_seller123',
    description:
      'Central Hub Solution user id of the payee (from SSO). Required when payeeType is mcom_user; validated as an active CHS user before the charge is created.',
  })
  @ValidateIf((o) => o.payeeType === 'mcom_user')
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  payeeUserId?: string;

  @ApiPropertyOptional({
    example: 'ledger_778',
    description: 'Required when payeeType is external — your own payee identifier',
  })
  @ValidateIf((o) => o.payeeType === 'external')
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  payeeExternalId?: string;

  @ApiProperty({ example: '9000', description: 'Gross share in minor units (pence) as an integer string' })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, {
    message: 'split amountMinor must be a positive integer string in minor units',
  })
  amountMinor: string;
}

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

  @ApiProperty({
    example: 'user_abc123',
    description:
      'Central Hub Solution user id of the payer (issued by SSO). Required for every method — guest payments are rejected, and an id that is not an active CHS user fails with 400.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  mcomUserId: string;

  @ApiPropertyOptional({ example: 'cust_987', description: "Your app's own customer id (never used as an MCOM identity)" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  externalCustomerId?: string;

  @ApiPropertyOptional({
    example: 'https://mall.example.com/payment/paypal/return',
    description:
      'Where PayPal should return the payer after approval. Falls back to the Central success page.',
  })
  @IsOptional()
  @Matches(/^https?:\/\/[^\s]+$/i, {
    message: 'returnUrl must be an http(s) URL',
  })
  @MaxLength(2048)
  returnUrl?: string;

  @ApiPropertyOptional({
    example: 'https://mall.example.com/payment/paypal/cancel',
    description: 'Where PayPal should return the payer after cancelling.',
  })
  @IsOptional()
  @Matches(/^https?:\/\/[^\s]+$/i, {
    message: 'cancelUrl must be an http(s) URL',
  })
  @MaxLength(2048)
  cancelUrl?: string;

  @ApiPropertyOptional({ example: { cartId: 'c_1' }, description: 'Arbitrary structured metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    enum: GlIntent,
    example: 'ORDER',
    description: 'What the charge is for — drives analytics and the user\'s ledger label',
  })
  @IsOptional()
  @IsEnum(GlIntent)
  intent?: GlIntent;

  @ApiPropertyOptional({
    type: [ChargeSplitDto],
    description:
      'Where the money goes. Omit to accrue the net to the calling app\'s payable (legacy). Amounts must sum to amountMinor.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChargeSplitDto)
  splits?: ChargeSplitDto[];
}
