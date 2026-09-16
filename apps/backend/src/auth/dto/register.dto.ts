import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;

  @ApiProperty({ example: 'StrongP@ssw0rd!', description: 'User password (min 8 chars)' })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({ example: 'John', description: 'User first name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'User last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'AGENT', description: 'User role (CUSTOMER, BUSINESS, AGENT, CONSULTANT, ACCOUNT_MANAGER)' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: '+447911123456', description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '+447911123456', description: 'Alternative phone number field' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Digital Marketing & Strategy', description: 'Consultant specialisation' })
  @IsString()
  @IsOptional()
  specialisation?: string;

  // Business registration optional fields
  @ApiPropertyOptional({ example: 'Acme Corp', description: 'Business name' })
  @IsString()
  @IsOptional()
  businessName?: string;

  @ApiPropertyOptional({ example: 'retail', description: 'Business type' })
  @IsString()
  @IsOptional()
  businessType?: string;

  @ApiPropertyOptional({ example: 'United Kingdom', description: 'Country' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: '123 High Street', description: 'Business address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'SW1A 1AA', description: 'Postcode' })
  @IsString()
  @IsOptional()
  postcode?: string;

  @ApiPropertyOptional({ example: 'Retail', description: 'Industry' })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({ example: 'Fashion', description: 'Category' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'Clothing & Apparel', description: 'Sub category' })
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiPropertyOptional({ example: 'https://example.com', description: 'Website URL' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ example: 'A brief description of the business', description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether business is listed on Google' })
  @IsOptional()
  isOnGoogle?: boolean;

  @ApiPropertyOptional({ example: 'ChIJN1t_tDeuEmsRUsoyG83frY4', description: 'Google Place ID' })
  @IsString()
  @IsOptional()
  googlePlaceId?: string;
}
