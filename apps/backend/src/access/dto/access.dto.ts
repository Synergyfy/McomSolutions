import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({ enum: ['SELF', 'GIFT', 'CODE'], default: 'SELF' })
  @IsOptional()
  @IsIn(['SELF', 'GIFT', 'CODE'])
  purchaseMode?: 'SELF' | 'GIFT' | 'CODE';

  @ApiPropertyOptional({ example: 'recipient@example.com' })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiPropertyOptional({ enum: ['membership', 'access_pass'] })
  @IsOptional()
  @IsIn(['membership', 'access_pass'])
  entitlementChoice?: 'membership' | 'access_pass';
}

export class RedeemAccessCodeDto {
  @ApiProperty({ example: 'MCOM-ABCD-2345' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
