import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SsoTokenRefreshDto {
  @ApiProperty({ example: 'refresh_token_xyz...', description: 'Refresh token issued by Central' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
