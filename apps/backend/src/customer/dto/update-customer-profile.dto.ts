import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Customer-editable fields that live on CustomerProfile.
 *
 * The customer UI also exposes country/region/preferred-currency/avatar, but
 * there is no persistence for those yet. Keep this DTO limited to fields the
 * schema actually owns so unknown body keys are rejected rather than silently
 * discarded.
 */
export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ example: '+447911123456', description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
