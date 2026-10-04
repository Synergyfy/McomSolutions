import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Phase 3: typed body for POST /auth/refresh and POST /auth/logout. */
export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...', description: 'Refresh token issued at login/register' })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken is required' })
  refreshToken: string;
}
