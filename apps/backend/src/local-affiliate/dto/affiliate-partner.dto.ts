import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AffiliateQualifyingEvent } from '@prisma/client';

/**
 * Provider → Central conversion push (service mesh).
 * Idempotent: a repeated call returns 202 with `duplicate: true`.
 */
export class IngestConversionDto {
  @ApiProperty({ example: 'mcom_mall', description: 'Provider code' })
  @IsString()
  @MaxLength(60)
  provider: string;

  @ApiProperty({ example: 'ord_12345', description: 'Provider order/transaction id (unique per provider)' })
  @IsString()
  @MaxLength(160)
  providerOrderId: string;

  @ApiProperty({ enum: AffiliateQualifyingEvent })
  @IsIn(Object.values(AffiliateQualifyingEvent))
  eventType: AffiliateQualifyingEvent;

  @ApiPropertyOptional({ example: 'k7Qm2xR9pA', description: 'Tracking link code captured at checkout' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  trackingCode?: string;

  @ApiPropertyOptional({ example: 5000, description: 'Amount in minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountMinor?: number;

  @ApiPropertyOptional({ example: 'GBP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: '2026-11-17T10:00:00Z' })
  @IsOptional()
  @IsString()
  occurredAt?: string;

  @ApiPropertyOptional({ example: 'central-user-uuid', description: 'Buyer CHS user id, when known' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  customerRef?: string;

  @ApiPropertyOptional({ example: 'mall:ord_12345:APPROVED_PURCHASE' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
