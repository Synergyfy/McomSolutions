import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ResolveRecipientQueryDto {
  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  mcomUserId?: string;
}

export class GrantMembershipDto {
  @ApiProperty({ example: 'rewards-issuance-uuid', description: 'Rewards issuance id (idempotency key)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  issuanceId: string;

  @ApiProperty({ example: 'central-user-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  recipientMcomUserId: string;

  @ApiProperty({ example: 'membership-plan-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  planId: string;

  @ApiPropertyOptional({ example: 'Pro', enum: ['Standard', 'Pro', 'Pro+'] })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  tier?: string;

  @ApiPropertyOptional({ example: 365, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({ example: true, description: 'Stack same plan/tier from current expiry' })
  @IsOptional()
  @IsBoolean()
  extendExisting?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Replace a conflicting plan/tier' })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;

  @ApiPropertyOptional({ example: 'Rewards reward' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;
}

export class IssueAccessPassCodeDto {
  @ApiProperty({ example: 'rewards-issuance-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  issuanceId: string;

  @ApiProperty({ example: 'access-plan-uuid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  accessPlanId: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  recipientEmail?: string;

  @ApiPropertyOptional({ example: 'central-user-uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  recipientMcomUserId?: string;

  @ApiPropertyOptional({ enum: ['GIFT', 'CODE'], example: 'GIFT' })
  @IsOptional()
  @IsIn(['GIFT', 'CODE'])
  mode?: 'GIFT' | 'CODE';

  @ApiPropertyOptional({ example: false, description: 'Central sends the email when true' })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ example: 'Rewards reward' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  note?: string;
}
