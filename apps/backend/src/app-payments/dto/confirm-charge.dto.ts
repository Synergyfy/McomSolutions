import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmChargeDto {
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
