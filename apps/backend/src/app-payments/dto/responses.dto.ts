import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppChargeMethod, AppChargeStatus } from '@prisma/client';

/**
 * Serialized charge. All monetary values are minor-unit integer strings so the
 * BigInt precision survives JSON (BigInt is not JSON-serializable natively).
 */
export class AppChargeDto {
  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p' })
  id: string;

  @ApiProperty({ example: 'mcom-mall', description: 'Registered app that owns the charge' })
  appClientId: string;

  @ApiProperty({ example: '10270', description: 'Gross amount in minor units (pence)' })
  amountMinor: string;

  @ApiProperty({ example: 'GBP' })
  currency: string;

  @ApiProperty({ example: '270', description: 'MCOM fee in minor units (pence)' })
  feeMinor: string;

  @ApiProperty({ example: '10000', description: 'Net amount owed to the app in minor units (pence)' })
  netMinor: string;

  @ApiProperty({ enum: AppChargeMethod, example: 'stripe' })
  method: AppChargeMethod;

  @ApiProperty({ enum: AppChargeStatus, example: 'paid' })
  status: AppChargeStatus;

  @ApiPropertyOptional({ example: 'order_12345' })
  reference?: string | null;

  @ApiPropertyOptional({ example: 'Pro plan renewal' })
  description?: string | null;

  @ApiPropertyOptional({ example: 'user_abc123' })
  mcomUserId?: string | null;

  @ApiPropertyOptional({ example: 'cust_987' })
  externalCustomerId?: string | null;

  @ApiPropertyOptional({ example: 'stripe' })
  provider?: string | null;

  @ApiPropertyOptional({ example: 'pi_3Pabc...' })
  providerRef?: string | null;

  @ApiPropertyOptional({ example: '100.0000', description: 'MCOM credits debited (wallet method only)' })
  walletDebitAmount?: string | null;

  @ApiPropertyOptional({ example: '2026-10-11T10:00:00.000Z' })
  paidAt?: string | null;

  @ApiProperty({ example: '2026-10-11T10:00:00.000Z' })
  createdAt: string;
}

export class CreateChargeResponseDto {
  @ApiProperty({ type: AppChargeDto })
  charge: AppChargeDto;

  @ApiPropertyOptional({
    example: 'pi_3Pabc..._secret_xyz',
    description: 'Stripe client secret (stripe method only)',
  })
  clientSecret?: string | null;

  @ApiPropertyOptional({
    example: 'https://www.sandbox.paypal.com/checkoutnow?token=5O1...',
    description: 'PayPal approval URL (paypal method only)',
  })
  approvalUrl?: string | null;
}

export class PaginatedChargesDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [AppChargeDto] })
  data: AppChargeDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
