import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public business-sector catalog endpoints. Backed by the `sectors` /
 * `categories` / `sub_categories` tables (seeded + admin-editable). Previously
 * these returned hardcoded frontend constants.
 */
@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('sectors')
  @ApiOperation({ summary: 'List business sectors' })
  @ApiOkResponse({ description: 'List of sectors' })
  async getSectors() {
    const sectors = await this.prisma.sector.findMany({ orderBy: { sortOrder: 'asc' } });
    return sectors.map((s) => ({ id: s.id, name: s.name, slug: s.slug }));
  }

  @Get('categories')
  @ApiOperation({ summary: 'List categories, optionally filtered by sector' })
  @ApiQuery({ name: 'sectorId', required: false, description: 'Filter by sector ID' })
  @ApiOkResponse({ description: 'List of categories' })
  async getCategories(@Query('sectorId') sectorId?: string) {
    const categories = await this.prisma.category.findMany({
      where: sectorId ? { sectorId } : {},
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map((c) => ({ id: c.id, name: c.name, sectorId: c.sectorId, slug: c.slug }));
  }

  @Get('subcategories')
  @ApiOperation({ summary: 'List subcategories, optionally filtered by category' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID' })
  @ApiOkResponse({ description: 'List of subcategories' })
  async getSubCategories(@Query('categoryId') categoryId?: string) {
    const subcategories = await this.prisma.subCategory.findMany({
      where: categoryId ? { categoryId } : {},
      orderBy: { sortOrder: 'asc' },
    });
    return subcategories.map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId, slug: s.slug }));
  }
}