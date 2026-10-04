import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly'] as const;

/** Phase 4: shared body for membership Stripe/PayPal initiates (level/tier/billing). */
export class MembershipInitiateDto {
  @ApiProperty({ example: 'Silver', description: 'Membership level' })
  @IsString()
  @IsNotEmpty({ message: 'level is required' })
  level: string;

  @ApiProperty({ example: 'Normal', description: 'Membership tier' })
  @IsString()
  @IsNotEmpty({ message: 'tier is required' })
  tier: string;

  @ApiProperty({ example: 'monthly', enum: BILLING_CYCLES, description: 'Billing cycle' })
  @IsString()
  @IsIn([...BILLING_CYCLES])
  billing: 'monthly' | 'quarterly' | 'yearly';

  @ApiPropertyOptional({ example: false, description: 'Legacy trial flag — tolerated but ignored (trials discontinued, Phase 2)' })
  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;
}

/** Phase 4: shared body for POST /payment/stripe/confirm. */
export class StripeConfirmDto extends MembershipInitiateDto {
  @ApiProperty({ example: 'pi_3O...', description: 'Stripe PaymentIntent ID' })
  @IsString()
  @IsNotEmpty({ message: 'paymentIntentId is required' })
  paymentIntentId: string;
}

/** Phase 4: shared body for POST /payment/paypal/initiate. */
export class PaypalInitiateDto extends MembershipInitiateDto {
  @ApiProperty({ example: 'https://app.example.com/payment/success', description: 'Return URL after PayPal approval' })
  @IsUrl({ require_tld: false }, { message: 'returnUrl must be a valid URL' })
  @IsNotEmpty({ message: 'returnUrl is required' })
  returnUrl: string;

  @ApiProperty({ example: 'https://app.example.com/payment/cancel', description: 'Cancel URL for PayPal payment' })
  @IsUrl({ require_tld: false }, { message: 'cancelUrl must be a valid URL' })
  @IsNotEmpty({ message: 'cancelUrl is required' })
  cancelUrl: string;
}

/** Phase 4: shared body for POST /payment/platform/stripe/confirm. */
export class PlatformConfirmDto {
  @ApiProperty({ example: 'MCOM Mall', description: 'Target platform' })
  @IsString()
  @IsNotEmpty({ message: 'platform is required' })
  platform: string;

  @ApiProperty({ example: 'uuid-of-plan', description: 'External plan ID from the platform service' })
  @IsString()
  @IsNotEmpty({ message: 'externalPlanId is required' })
  externalPlanId: string;

  @ApiProperty({ example: 'monthly', description: 'Billing cycle' })
  @IsString()
  @IsNotEmpty({ message: 'billingCycle is required' })
  billingCycle: string;

  @ApiPropertyOptional({ example: 'pi_3O...', description: 'Stripe PaymentIntent ID (or setupIntentId)' })
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @ApiPropertyOptional({ example: 'seti_...', description: 'Stripe SetupIntent ID (alternative to paymentIntentId)' })
  @IsOptional()
  @IsString()
  setupIntentId?: string;
}
