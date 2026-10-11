import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AppChargeStatus } from '@prisma/client';

export class FilterChargesDto {
  @ApiPropertyOptional({ enum: AppChargeStatus, example: 'paid', description: 'Filter by status' })
  @IsOptional()
  @IsEnum(AppChargeStatus)
  status?: AppChargeStatus;

  @ApiPropertyOptional({ example: 'user_abc123', description: 'Filter by MCOM user id' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  mcomUserId?: string;

  @ApiPropertyOptional({ example: 'order_12345', description: 'Filter by reference (exact match)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Created on/after (ISO date)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Created on/before (ISO date, inclusive EOD)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
