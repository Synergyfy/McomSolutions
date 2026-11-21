import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmChargeDto {
  @ApiProperty({
    example: 'user_abc123',
    description:
      'Central Hub user id the app expected to pay this charge. Must match the payer stored when the charge/intent was created.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  mcomUserId: string;

  @ApiPropertyOptional({
    example: 'pi_3Pabc...',
    description: 'Stripe PaymentIntent id (required for stripe method)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentIntentId?: string;

  @ApiPropertyOptional({
    example: '5O190127TN364715T',
    description: 'PayPal order id (required for paypal method)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  orderId?: string;
}
