import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Phase 3: validated body for POST /auth/reset-password (replaces body:any). */
export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Account email address' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Password-reset code from email' })
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  code: string;

  @ApiProperty({ example: 'StrongP@ssw0rd!', description: 'New password (min 8 chars, 1 uppercase, 1 number, 1 special)' })
  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters long' })
  @MaxLength(128, { message: 'newPassword must be at most 128 characters long' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).+$/, {
    message: 'newPassword must include 1 uppercase letter, 1 number, and 1 special character',
  })
  newPassword: string;
}
