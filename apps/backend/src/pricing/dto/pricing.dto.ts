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

export class PaymentQuoteQueryDto {
  @ApiProperty({ example: 'Gold', description: 'Membership plan name or ID' })
  @IsString()
  @IsNotEmpty({ message: 'Please choose a membership plan.' })
  level: string;

  @ApiPropertyOptional({ example: 'Standard', enum: ['Standard', 'Pro', 'Pro+'] })
  @IsString()
  @IsOptional()
  @IsIn(['Standard', 'Normal', 'Pro', 'Pro+', 'ProPlus'], { message: 'Tier must be Standard, Pro or Pro+.' })
  tier?: string = 'Standard';

  @ApiPropertyOptional({ example: 'monthly', enum: ['full', 'monthly', 'quarterly', 'halfYearly'] })
  @IsString()
  @IsOptional()
  @IsIn(['full', 'monthly', 'quarterly', 'halfYearly', 'half_yearly'], { message: 'Payment plan must be full, monthly, quarterly or halfYearly.' })
  paymentPlan?: string = 'full';
}

/** Authenticated coupon preview for the current payment step. */
export class CouponQuoteDto extends PaymentQuoteQueryDto {
  @ApiProperty({ example: 'MCOM-20OFF', description: 'Coupon code to validate' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a coupon code.' })
  couponCode: string;

  @ApiPropertyOptional({ example: 'monthly', enum: ['monthly', 'quarterly', 'yearly'] })
  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'yearly'])
  billing?: 'monthly' | 'quarterly' | 'yearly' = 'monthly';
}
