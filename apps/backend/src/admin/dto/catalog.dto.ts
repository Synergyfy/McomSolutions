import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Sector DTOs ──────────────────────────────────────────

export class CreateSectorDto {
  @ApiProperty({ example: 'Retail & Fashion', description: 'Name of the business sector' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'retail-fashion', description: 'Unique URL slug (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 1, description: 'Display sort order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSectorDto {
  @ApiPropertyOptional({ example: 'Retail & Fashion' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'retail-fashion' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// ─── Category DTOs ────────────────────────────────────────

export class CreateCategoryDto {
  @ApiProperty({ example: 'sec-retail', description: 'Parent Sector ID' })
  @IsString()
  @IsNotEmpty()
  sectorId: string;

  @ApiProperty({ example: 'Clothing & Fashion', description: 'Name of the category' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'clothing-fashion', description: 'Unique URL slug (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 1, description: 'Display sort order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'sec-retail', description: 'Parent Sector ID' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sectorId?: string;

  @ApiPropertyOptional({ example: 'Clothing & Fashion' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'clothing-fashion' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// ─── SubCategory DTOs ─────────────────────────────────────

export class CreateSubCategoryDto {
  @ApiProperty({ example: 'cat-clothing', description: 'Parent Category ID' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ example: 'Boutiques', description: 'Name of the subcategory' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'boutiques', description: 'Unique URL slug (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 1, description: 'Display sort order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSubCategoryDto {
  @ApiPropertyOptional({ example: 'cat-clothing', description: 'Parent Category ID' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Boutiques' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'boutiques' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
