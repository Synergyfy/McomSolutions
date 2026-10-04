import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

/** Phase 3: validated query for GET /auth/check-email (throttled). */
export class CheckEmailQueryDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'Email address to check' })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;
}
