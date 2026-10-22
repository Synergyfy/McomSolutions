import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AccessCouponQuoteDto {
  @ApiProperty({ example: 'access-plan-id' })
  @IsString()
  @IsNotEmpty()
  accessPlanId: string;

  @ApiProperty({ example: 'MCOM-20OFF' })
  @IsString()
  @IsNotEmpty()
  couponCode: string;
}

export class AccessWalletPurchaseDto {
  @ApiProperty({ example: 'access-plan-id' })
  @IsString()
  @IsNotEmpty()
  accessPlanId: string;

  @ApiPropertyOptional({ example: 'MCOM-20OFF' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
