import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { MCOM_CENTRAL_CLIENT_ID } from '../mesh-inbound/service-mesh.constants';

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
    return sectors.map((s) => ({ id: s.id, name: s.name, slug: s.slug, imageUrl: s.imageUrl }));
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
    return categories.map((c) => ({ id: c.id, name: c.name, sectorId: c.sectorId, slug: c.slug, imageUrl: c.imageUrl }));
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
    return subcategories.map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId, slug: s.slug, imageUrl: s.imageUrl }));
  }

  @Get('apps')
  @ApiOperation({ summary: 'List active registered ecosystem applications' })
  @ApiOkResponse({ description: 'List of active registered applications' })
  async getApps() {
    const apps = await this.prisma.ssoClient.findMany({
      where: { isActive: true },
      orderBy: [
        { isSystemApp: 'desc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        clientId: true,
        name: true,
        description: true,
        platformSlug: true,
        appUrl: true,
        redirectUris: true,
        logoUrl: true,
        isSystemApp: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Central is the hub that brokers SSO for every app in this directory — it
    // is not a launchable product, so keep it (and any duplicate registration
    // using the same platform slug) out of the public list. Filtered in memory
    // so clients with a null `platformSlug` are never dropped by SQL null
    // semantics.
    return apps.filter(
      (app) =>
        app.clientId !== MCOM_CENTRAL_CLIENT_ID &&
        app.platformSlug !== MCOM_CENTRAL_CLIENT_ID,
    );
  }
}