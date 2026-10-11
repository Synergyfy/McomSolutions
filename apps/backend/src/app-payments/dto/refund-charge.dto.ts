import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RefundChargeDto {
  @ApiPropertyOptional({
    example: '10270',
    description: 'Amount to refund in minor units (pence). Defaults to the full charge amount.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, {
    message: 'amountMinor must be a positive integer string in minor units (no decimals)',
  })
  amountMinor?: string;

  @ApiPropertyOptional({ example: 'Customer requested refund', description: 'Reason for the refund' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
