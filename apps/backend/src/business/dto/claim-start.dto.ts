import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Phase 4: shared body for POST /claim/start. */
export class ClaimStartDto {
  @ApiProperty({ example: 'ChIJN1t_tDeuEmsRUsoyG83frY4', description: 'Google Place ID to claim' })
  @IsString()
  @IsNotEmpty({ message: 'placeId is required' })
  @MaxLength(255)
  placeId: string;

  @ApiPropertyOptional({ example: 'https://app.example.com/getstarted/business', description: 'Return URL after claim' })
  @IsOptional()
  @IsUrl({}, { message: 'returnUrl must be a valid URL' })
  returnUrl?: string;
}
