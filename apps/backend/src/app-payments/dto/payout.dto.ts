import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty({ example: 'mcom-mall', description: 'Registered app client id' })
  @IsString()
  @MaxLength(100)
  appClientId: string;

  @ApiProperty({ example: '8719', description: 'Amount in minor units (pence) as an integer string' })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, {
    message: 'amountMinor must be a positive integer string in minor units',
  })
  amountMinor: string;

  @ApiPropertyOptional({ example: 'bank_transfer', description: 'How the payout will be made' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @ApiPropertyOptional({ example: 'PO-9981', description: 'Bank/provider reference' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerRef?: string;
}

export class ApprovePayoutDto {
  @ApiPropertyOptional({ example: 'PO-9981', description: 'Bank/provider reference for the payment' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerRef?: string;
}

export class RejectPayoutDto {
  @ApiPropertyOptional({ example: 'Bank details mismatch', description: 'Why the payout was rejected' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
