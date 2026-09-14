import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AdminCatalogService } from './admin-catalog.service';
import {
  CreateSectorDto,
  UpdateSectorDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
} from './dto/catalog.dto';

@ApiTags('Admin Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalogService: AdminCatalogService) {}

  private getAdminName(req: any): string {
    return req.user?.name || req.user?.email || 'Admin';
  }

  // ─── Complete Hierarchy Tree & Stats ───────────────────────
  @Get('tree')
  @ApiOperation({ summary: 'Get complete sector -> category -> subcategory tree and summary stats' })
  @ApiOkResponse({ description: 'Catalog tree with nested relationships' })
  async getCatalogTree() {
    return this.catalogService.getCatalogTree();
  }

  // ─── Sectors ──────────────────────────────────────────────
  @Get('sectors')
  @ApiOperation({ summary: 'List all sectors with category counts' })
  async getSectors() {
    return this.catalogService.getSectors();
  }

  @Get('sectors/:id')
  @ApiOperation({ summary: 'Get sector by ID with categories' })
  async getSectorById(@Param('id') id: string) {
    return this.catalogService.getSectorById(id);
  }

  @Post('sectors')
  @ApiOperation({ summary: 'Create a new sector' })
  @ApiCreatedResponse({ description: 'Created sector' })
  async createSector(@Req() req: any, @Body() dto: CreateSectorDto) {
    return this.catalogService.createSector(dto, this.getAdminName(req));
  }

  @Put('sectors/:id')
  @ApiOperation({ summary: 'Update an existing sector' })
  async updateSector(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSectorDto,
  ) {
    return this.catalogService.updateSector(id, dto, this.getAdminName(req));
  }

  @Delete('sectors/:id')
  @ApiOperation({ summary: 'Delete a sector and cascade-delete its categories and subcategories' })
  async deleteSector(@Req() req: any, @Param('id') id: string) {
    return this.catalogService.deleteSector(id, this.getAdminName(req));
  }

  // ─── Categories ───────────────────────────────────────────
  @Get('categories')
  @ApiOperation({ summary: 'List categories, optionally filtered by sector' })
  @ApiQuery({ name: 'sectorId', required: false })
  async getCategories(@Query('sectorId') sectorId?: string) {
    return this.catalogService.getCategories(sectorId);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get category by ID with sector and subcategories' })
  async getCategoryById(@Param('id') id: string) {
    return this.catalogService.getCategoryById(id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiCreatedResponse({ description: 'Created category' })
  async createCategory(@Req() req: any, @Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(dto, this.getAdminName(req));
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update an existing category' })
  async updateCategory(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(id, dto, this.getAdminName(req));
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category and cascade-delete its subcategories' })
  async deleteCategory(@Req() req: any, @Param('id') id: string) {
    return this.catalogService.deleteCategory(id, this.getAdminName(req));
  }

  // ─── SubCategories ────────────────────────────────────────
  @Get('subcategories')
  @ApiOperation({ summary: 'List subcategories, optionally filtered by category' })
  @ApiQuery({ name: 'categoryId', required: false })
  async getSubCategories(@Query('categoryId') categoryId?: string) {
    return this.catalogService.getSubCategories(categoryId);
  }

  @Get('subcategories/:id')
  @ApiOperation({ summary: 'Get subcategory by ID' })
  async getSubCategoryById(@Param('id') id: string) {
    return this.catalogService.getSubCategoryById(id);
  }

  @Post('subcategories')
  @ApiOperation({ summary: 'Create a new subcategory' })
  @ApiCreatedResponse({ description: 'Created subcategory' })
  async createSubCategory(@Req() req: any, @Body() dto: CreateSubCategoryDto) {
    return this.catalogService.createSubCategory(dto, this.getAdminName(req));
  }

  @Put('subcategories/:id')
  @ApiOperation({ summary: 'Update an existing subcategory' })
  async updateSubCategory(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubCategoryDto,
  ) {
    return this.catalogService.updateSubCategory(id, dto, this.getAdminName(req));
  }

  @Delete('subcategories/:id')
  @ApiOperation({ summary: 'Delete a subcategory' })
  async deleteSubCategory(@Req() req: any, @Param('id') id: string) {
    return this.catalogService.deleteSubCategory(id, this.getAdminName(req));
  }
}
