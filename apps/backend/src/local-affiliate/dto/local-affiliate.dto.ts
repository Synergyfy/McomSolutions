import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Scenario A — an existing CHS identity activates an affiliate profile. */
export class ActivateAffiliateDto {
  @ApiProperty({ example: '2026-11-01', description: 'Terms version being accepted' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  termsVersion: string;

  @ApiProperty({ example: true, description: 'Explicit acceptance of the affiliate terms' })
  @IsBoolean()
  acceptTerms: boolean;

  @ApiPropertyOptional({ example: 'QR-2026-BIRMINGHAM', description: 'Optional acquisition reference' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  inviteCode?: string;
}

/**
 * Scenario B — a brand-new CHS identity plus its affiliate profile, created in
 * one transaction. Deliberately separate from /auth/register so the affiliate
 * journey can never be triggered accidentally by ordinary customer signup.
 */
export class RegisterLocalAffiliateDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongP@ssw0rd', description: 'Minimum 8 characters' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: '+447911123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-()]{7,20}$/, { message: 'Invalid phone number format' })
  phone?: string;

  @ApiPropertyOptional({ example: 'B1 1AA', description: 'UK postcode (used for location-scoped offers)' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  postcode?: string;

  @ApiProperty({ example: '2026-11-01' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  termsVersion: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  acceptTerms: boolean;

  @ApiPropertyOptional({ example: 'LAF-INVITE-001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  inviteCode?: string;
}

export class VerifyAffiliateEmailDto {
  @ApiProperty({ example: '483920', description: 'Six-digit code sent to the account email' })
  @IsString()
  @MinLength(4)
  @MaxLength(10)
  code: string;
}

export class UpdateLocalAffiliateDto {
  @ApiPropertyOptional({ example: 'Johnny S.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ example: true, description: 'Marketing email opt-in' })
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

export class AffiliatePageQueryDto {
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

  @ApiPropertyOptional({ example: 'APPROVED_PURCHASE' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'PENDING' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'POINTS', enum: ['POINTS', 'CREDIT'] })
  @IsOptional()
  @IsIn(['POINTS', 'CREDIT'])
  unit?: 'POINTS' | 'CREDIT';

  @ApiPropertyOptional({ example: '2026-01-01', description: 'ISO date lower bound' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'ISO date upper bound' })
  @IsOptional()
  @IsString()
  to?: string;
}
