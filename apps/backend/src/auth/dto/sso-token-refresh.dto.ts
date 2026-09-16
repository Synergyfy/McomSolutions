import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SsoTokenRefreshDto {
  @ApiProperty({ example: 'refresh_token_xyz...', description: 'Refresh token issued by Central' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @ApiPropertyOptional({ example: 'mcom-mall', description: 'Registered OAuth client ID' })
  @IsString()
  @IsOptional()
  client_id?: string;

  @ApiPropertyOptional({ example: 'cs_secret_123', description: 'OAuth client secret' })
  @IsString()
  @IsOptional()
  client_secret?: string;

  @ApiPropertyOptional({ example: 'refresh_token', description: 'OAuth grant type' })
  @IsString()
  @IsOptional()
  grant_type?: string;
}

