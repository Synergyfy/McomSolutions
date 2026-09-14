import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn } from 'class-validator';
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

  @ApiPropertyOptional({ example: false, description: 'Whether to activate as free trial' })
  @IsBoolean()
  @IsOptional()
  isTrial?: boolean = false;
}

export class PurchasePackageDto {
  @ApiProperty({ example: 'MCOM Mall', description: 'Target platform' })
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiProperty({ example: 'Standard Tier', description: 'Package name' })
  @IsString()
  @IsNotEmpty()
  packageName: string;
}
