import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SsoTokenDto {
  @ApiProperty({ example: 'code_abc123...', description: 'Authorization code issued by Central' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'mcom-mall', description: 'Registered OAuth client ID' })
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @ApiProperty({ example: 'https://mcommall.vercel.app/auth/callback', description: 'Redirect callback URL' })
  @IsString()
  @IsNotEmpty()
  redirect_uri: string;
}
