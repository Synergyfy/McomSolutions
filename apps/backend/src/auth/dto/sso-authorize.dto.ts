import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SsoAuthorizeDto {
  @ApiProperty({ example: 'mcom-mall', description: 'Registered OAuth client ID' })
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @ApiProperty({ example: 'https://mcommall.vercel.app/auth/callback', description: 'Redirect callback URL' })
  @IsString()
  @IsNotEmpty()
  redirect_uri: string;

  @ApiPropertyOptional({ example: 'state-123456', description: 'State string to prevent CSRF' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: 'profile email', description: 'Space-separated scopes' })
  @IsString()
  @IsOptional()
  scope?: string;
}
