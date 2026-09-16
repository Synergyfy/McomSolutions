import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionCategory } from '@prisma/client';

export class PlaceHoldDto {
  @ApiProperty({ example: 'user_abc123', description: 'McomSolutions user ID to place the hold on' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 50, description: 'Amount to reserve (positive, MCOM credits). Enforced server-side by WALLET_MAX_SINGLE_TXN.' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'sub_inv_0042', description: 'Your reference for the held reservation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reference: string;

  @ApiPropertyOptional({ example: 'Pre-authorization for order' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ description: 'Optional partner metadata payload' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 24, description: 'Hold duration in hours' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ttlHours?: number;
}

export class CaptureHoldDto {
  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p', description: 'Hold ID returned by place-hold' })
  @IsString()
  @IsNotEmpty()
  holdId: string;

  @ApiPropertyOptional({
    enum: ['SUBSCRIPTION', 'PURCHASE', 'SERVICE_FEE'],
    example: 'PURCHASE',
    description: 'Category of the resulting debit transaction',
  })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiPropertyOptional({ example: 50, description: 'Amount to capture' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: 'mall-membership-123' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Optional partner metadata payload' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ReleaseHoldDto {
  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p', description: 'Hold ID to release back to balance' })
  @IsString()
  @IsNotEmpty()
  holdId: string;
}

export class IdempotencyHeader {
  @ApiProperty({
    example: 'mcom-mall-sub-inv-0042-aug2026',
    description:
      'Unique per business event. Same key on retries returns the original result. Format: <platform>-<event-type>-<unique-reference>. Max 255 ASCII chars.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  'X-Idempotency-Key': string;
}

export class HoldIdParamDto {
  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p' })
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class PartnerUserIdParamDto {
  @ApiProperty({ example: 'user_abc123' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class TopUpInitiateDto {
  @ApiProperty({ example: 50, description: 'Amount to top up in GBP (min 5, max 500)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(5)
  @Max(500)
  amount: number;

  @ApiPropertyOptional({ example: 'GBP', default: 'GBP' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'https://mcomsolutions.com/dashboard/wallet', description: 'Stripe success redirect URL' })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'https://mcomsolutions.com/dashboard/wallet', description: 'Stripe cancel redirect URL' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;

  @ApiPropertyOptional({ example: 'stripe', enum: ['stripe', 'paypal'], default: 'stripe' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class ConfirmTopUpDto {
  @ApiProperty({ example: 'clx...topup-request-id', description: 'ID of the WalletTopUpRequest record' })
  @IsString()
  @IsNotEmpty()
  topUpRequestId: string;

  @ApiProperty({ example: 'pi_3MtwBwLkdIwHu7ix28a3tqPa', description: 'Stripe PaymentIntent ID' })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}