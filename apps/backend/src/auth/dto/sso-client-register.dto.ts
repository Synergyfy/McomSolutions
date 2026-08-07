import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class SsoClientRegisterDto {
  @ApiProperty({ example: 'mcom-mall', description: 'Registered OAuth client ID' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: 'mall_secret_123', description: 'Raw client secret (will be hashed)' })
  @IsString()
  @IsNotEmpty()
  clientSecret: string;

  @ApiProperty({ example: 'MCOM Mall', description: 'Display name of client service' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: ['https://mcommall.vercel.app/auth/callback'], description: 'Allowed redirect callback URLs' })
  @IsArray()
  @IsString({ each: true })
  redirectUris: string[];

  @ApiPropertyOptional({ example: ['profile', 'email'], description: 'Allowed scopes' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];

  @ApiPropertyOptional({ example: 'https://mcommall.vercel.app/logo.png', description: 'Client logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'mcom_mall_api_key_secure_987', description: 'Service API key for Data Sharing API' })
  @IsString()
  @IsOptional()
  apiKey?: string;
}
