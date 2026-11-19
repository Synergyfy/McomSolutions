import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RedeemRewardDto {
  @ApiProperty({ example: 'VOUCHER', enum: ['VOUCHER', 'POINTS'] })
  @IsIn(['VOUCHER', 'POINTS'])
  rewardType: 'VOUCHER' | 'POINTS';

  @ApiProperty({ example: 100, description: 'Units to spend (points)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  units: number;

  @ApiPropertyOptional({ example: 'clxoffer', description: 'Optional offer the voucher is for' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  offerId?: string;
}

export class RewardLedgerQueryDto {
  @ApiPropertyOptional({ example: 'AVAILABLE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'POINTS', enum: ['POINTS', 'CREDIT'] })
  @IsOptional()
  @IsIn(['POINTS', 'CREDIT'])
  unit?: 'POINTS' | 'CREDIT';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
