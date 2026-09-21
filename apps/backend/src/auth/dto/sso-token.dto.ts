import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SsoTokenDto {
  @ApiProperty({ example: 'code_abc123...', description: 'Authorization code issued by Central' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'mcom-mall', description: 'Registered OAuth client ID' })
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @ApiPropertyOptional({ example: 'cs_secret_123', description: 'OAuth client secret (if passed in request body)' })
  @IsString()
  @IsOptional()
  client_secret?: string;

  @ApiProperty({ example: 'https://mcommall.vercel.app/auth/callback', description: 'Redirect callback URL' })
  @IsString()
  @IsNotEmpty()
  redirect_uri: string;

  @ApiPropertyOptional({ example: 'authorization_code', description: 'OAuth 2.0 grant type' })
  @IsString()
  @IsOptional()
  grant_type?: string;

  @ApiPropertyOptional({ example: 'code_verifier_123', description: 'PKCE code verifier' })
  @IsString()
  @IsOptional()
  code_verifier?: string;
}

