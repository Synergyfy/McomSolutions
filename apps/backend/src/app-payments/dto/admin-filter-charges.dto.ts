import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { FilterChargesDto } from './filter-charges.dto';

export class AdminFilterChargesDto extends FilterChargesDto {
  @ApiPropertyOptional({ example: 'mcom-mall', description: 'Filter by registered app client id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  appClientId?: string;

  @ApiPropertyOptional({
    example: 'order_12345',
    description: 'Free-text search across charge id, reference, description, user, customer, provider ref',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
