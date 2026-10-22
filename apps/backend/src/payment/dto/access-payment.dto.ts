import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class AccessInitiateDto {
  @ApiProperty({ example: 'access-plan-id', description: 'Access plan ID' })
  @IsString()
  @IsNotEmpty()
  accessPlanId: string;

  @ApiPropertyOptional({ example: 'MCOM-20OFF', description: 'Optional coupon code for this access pass' })
  @IsOptional()
  @IsString()
  couponCode?: string;
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
