import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateCouponDto } from '../../coupon/dto/coupon.dto';

/**
 * Partner coupon create payload: the full admin field set plus the Rewards
 * issuance id used as the idempotency key.
 */
export class CreatePartnerCouponDto extends CreateCouponDto {
  @ApiProperty({ example: 'rewards-issuance-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  issuanceId: string;
}
