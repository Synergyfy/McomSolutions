import { ApiProperty } from '@nestjs/swagger';

export class ReferredUserDto {
  @ApiProperty({ example: 'cuid123', description: 'Referred user ID' })
  id: string;

  @ApiProperty({ example: 'friend@example.com', description: 'Referred user email' })
  email: string;

  @ApiProperty({ example: 'Jane', description: 'Referred user first name' })
  firstName: string | null;

  @ApiProperty({ example: 'Doe', description: 'Referred user last name' })
  lastName: string | null;

  @ApiProperty({ example: 'BUSINESS', description: 'Referred user role' })
  role: string;

  @ApiProperty({ example: '2026-10-07T12:00:00.000Z', description: 'When the referred user registered' })
  createdAt: Date;
}

export class ReferralListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [ReferredUserDto] })
  data: ReferredUserDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class ReferralInfoResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'A1B2C3D4', description: 'Caller referral code' })
  referralCode: string;

  @ApiProperty({
    example: 'https://mcomsolutions.com/register?ref=A1B2C3D4',
    description: 'Shareable referral link',
  })
  referralLink: string;
}

export class ReferralStatsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 7, description: 'Total users referred by the caller' })
  totalReferrals: number;
}
