import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

/** Phase 3: typed body for verify-otp. */
export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Account email address' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit one-time code' })
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  @Length(4, 12, { message: 'code has an invalid length' })
  code: string;
}
