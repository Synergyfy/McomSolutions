import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

/** Phase 3: typed body for send-otp / resend-otp / forgot-password. */
export class EmailDto {
  @ApiProperty({ example: 'user@example.com', description: 'Account email address' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;
}
