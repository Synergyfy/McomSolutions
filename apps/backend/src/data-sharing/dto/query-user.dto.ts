import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class QueryUserDto {
  @ApiPropertyOptional({ example: 'john@example.com', description: 'User email address to query' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'user-uuid', description: 'User ID to query' })
  @IsString()
  @IsOptional()
  userId?: string;
}
