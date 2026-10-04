import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Phase 3: whitelisted body for PUT /auth/settings (replaces body:any). */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Managing Director', description: 'Job title' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;

  @ApiPropertyOptional({ example: false, description: 'Two-factor authentication enabled' })
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Email notifications enabled' })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional({ example: false, description: 'SMS notifications enabled' })
  @IsOptional()
  @IsBoolean()
  smsNotifications?: boolean;
}
