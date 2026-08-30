import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreatePlatformPurchaseDto {
  @ApiProperty({ example: 'MCOM Mall', description: 'Target platform (a named platform or a Console-registered app slug, e.g. vcard)' })
  @IsString()
  @IsNotEmpty()
  platform: string

  @ApiProperty({ example: 'uuid-of-plan', description: 'External plan ID from the platform service' })
  @IsString()
  @IsNotEmpty()
  externalPlanId: string

  @ApiProperty({ example: 'monthly', enum: ['monthly', 'quarterly', 'annual'], description: 'Billing cycle' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['monthly', 'quarterly', 'annual'])
  billingCycle: string

  @ApiPropertyOptional({ example: 'https://example.com/payment/success', description: 'Return URL after PayPal payment' })
  @IsOptional()
  @IsString()
  returnUrl?: string

  @ApiPropertyOptional({ example: 'https://example.com/payment/cancel', description: 'Cancel URL for PayPal payment' })
  @IsOptional()
  @IsString()
  cancelUrl?: string
}
