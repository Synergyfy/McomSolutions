import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export type AccessPurchaseMode = 'SELF' | 'GIFT' | 'CODE';

export class AccessInitiateDto {
  @ApiProperty({ example: 'access-plan-id', description: 'Access plan ID' })
  @IsString()
  @IsNotEmpty()
  accessPlanId: string;

  @ApiPropertyOptional({ example: 'MCOM-20OFF', description: 'Optional coupon code for this access pass' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    enum: ['SELF', 'GIFT', 'CODE'],
    default: 'SELF',
    description: 'SELF activates immediately; GIFT emails a locked code; CODE returns a transferable code',
  })
  @IsOptional()
  @IsIn(['SELF', 'GIFT', 'CODE'], { message: 'purchaseMode must be SELF, GIFT or CODE' })
  purchaseMode?: AccessPurchaseMode;

  @ApiPropertyOptional({ example: 'recipient@example.com', description: 'Required for GIFT purchases' })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiPropertyOptional({
    enum: ['membership', 'access_pass'],
    description:
      'When the pass overlaps an active membership: keep the membership (defer the pass) or switch to the pass now',
  })
  @IsOptional()
  @IsIn(['membership', 'access_pass'])
  entitlementChoice?: 'membership' | 'access_pass';
}

export class AccessStripeConfirmDto extends AccessInitiateDto {
  @ApiProperty({ example: 'pi_3O...', description: 'Stripe PaymentIntent ID' })
  @IsString()
  @IsNotEmpty({ message: 'paymentIntentId is required' })
  paymentIntentId: string;
}

export class AccessPaypalInitiateDto extends AccessInitiateDto {
  @ApiProperty({ example: 'https://app.example.com/payment/success' })
  @IsUrl({ require_tld: false }, { message: 'returnUrl must be a valid URL' })
  @IsNotEmpty({ message: 'returnUrl is required' })
  returnUrl: string;

  @ApiProperty({ example: 'https://app.example.com/payment/cancel' })
  @IsUrl({ require_tld: false }, { message: 'cancelUrl must be a valid URL' })
  @IsNotEmpty({ message: 'cancelUrl is required' })
  cancelUrl: string;
}

export class AccessPaypalCaptureDto {
  @ApiProperty({ example: '5O190127TN364715T', description: 'PayPal order ID' })
  @IsString()
  @IsNotEmpty({ message: 'orderId is required' })
  orderId: string;
}
