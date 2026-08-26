import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';

export const ALLOWED_SCOPES = ['profile', 'email', 'business', 'membership', 'packages'];

export class RegisterAppDto {
  @ApiProperty({ example: 'Mcom vCard', description: 'App display name' })
  @IsString()
  @MinLength(3, { message: 'Name must be between 3 and 80 characters' })
  @MaxLength(80, { message: 'Name must be between 3 and 80 characters' })
  name: string;

  @ApiProperty({ example: 'mcom-vcard', description: 'Lowercase alphanumeric with hyphens' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Client ID must be lowercase alphanumeric with hyphens' })
  @MinLength(3, { message: 'Client ID must be between 3 and 50 characters' })
  @MaxLength(50, { message: 'Client ID must be between 3 and 50 characters' })
  clientId: string;

  @ApiPropertyOptional({
    example: 'vcard',
    description: 'Platform slug used for the canAccess_<slug> permission key',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+$/, { message: 'Platform slug must be lowercase alphanumeric with underscores' })
  @MinLength(2, { message: 'Platform slug must be between 2 and 30 characters' })
  @MaxLength(30, { message: 'Platform slug must be between 2 and 30 characters' })
  platformSlug?: string;

  @ApiPropertyOptional({ example: 'Digital business card platform', description: 'Short app description' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({ example: 'https://vcard.mcom.com', description: 'Frontend URL of the app' })
  @IsOptional()
  @IsUrl()
  appUrl?: string;

  @ApiPropertyOptional({ example: 'https://api.vcard.mcom.com', description: 'Backend URL used by the Generic Connector for plan management' })
  @IsOptional()
  @IsUrl()
  billingApiUrl?: string;

  @ApiProperty({ example: ['https://vcard.mcom.com/auth/callback'], description: 'Allowed OAuth redirect callback URLs' })
  @IsArray()
  @IsUrl({}, { each: true, message: 'Invalid redirect URI' })
  @ArrayMaxSize(20)
  redirectUris: string[];

  @ApiProperty({ example: ['https://vcard.mcom.com'], description: 'Allowed CORS origins (scheme + hostname only)' })
  @IsArray()
  @IsUrl({}, { each: true, message: 'Invalid CORS origin' })
  @ArrayMaxSize(20)
  corsOrigins: string[];

  @ApiProperty({ example: ['profile', 'email', 'business'], enum: ALLOWED_SCOPES })
  @IsArray()
  @IsIn(ALLOWED_SCOPES, { each: true, message: 'Invalid scope' })
  @ArrayMaxSize(10)
  scopes: string[];

  @ApiPropertyOptional({ example: 'https://api.vcard.mcom.com/webhooks', description: 'Where McomSolutions POSTs lifecycle events' })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({ example: false, description: 'Only super-admins should set this — makes the app non-deletable' })
  @IsOptional()
  @IsBoolean()
  isSystemApp?: boolean;
}