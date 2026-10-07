import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscribeMembershipDto {
  @ApiProperty({ example: 'Gold', description: 'Membership plan name or ID' })
  @IsString()
  @IsNotEmpty()
  level: string;

  @ApiPropertyOptional({ example: 'Normal', description: 'Sub-tier: Normal, Pro, Pro+' })
  @IsString()
  @IsOptional()
  tier?: string = 'Normal';

  @ApiPropertyOptional({ example: 'monthly', enum: ['monthly', 'quarterly', 'yearly'] })
  @IsString()
  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'yearly'])
  billing?: 'monthly' | 'quarterly' | 'yearly' = 'monthly';
}

// PurchasePackageDto — REMOVED (memberships-only model). Standalone packages
// are bought on the console-registered external platforms themselves.
