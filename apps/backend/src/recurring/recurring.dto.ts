import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CancelRecurringDto {
  @ApiPropertyOptional({
    example: false,
    description: 'Cancel immediately instead of at the end of the current period',
  })
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}

export class SetAutoRenewDto {
  @ApiProperty({ example: false, description: 'Enable or disable automatic renewal' })
  @IsBoolean()
  enabled: boolean;
}

export class AdminRecurringQueryDto {
  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'stripe' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  take?: number;
}

export class EnableWalletRecurringDto {
  @ApiProperty({ example: 'MEMBERSHIP', enum: ['MEMBERSHIP', 'PLATFORM'] })
  @IsString()
  scope: 'MEMBERSHIP' | 'PLATFORM';

  @ApiProperty({ example: 'monthly', description: 'Renewal cycle: monthly, quarterly or annual' })
  @IsString()
  billingCycle: string;

  @ApiPropertyOptional({ example: 'mall', description: 'Required when scope = PLATFORM' })
  @IsOptional()
  @IsString()
  platform?: string;
}
