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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
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
  private readonly logger = new Logger(AdminCatalogController.name);

  constructor(private readonly catalogService: AdminCatalogService) {}

  private getAdminName(req: any): string {
    return req.user?.name || req.user?.email || 'Admin';
  }

  // ─── Image Upload to Cloudinary ─────────────────────────────
  @Post('upload-image')
  @ApiOperation({ summary: 'Upload an image for sector, category, or subcategory to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads', 'catalog');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const cleanExt = extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
          cb(null, `catalog-${uniqueSuffix}${cleanExt}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        const ext = extname(file.originalname).toLowerCase();
        const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        if (!allowedExts.includes(ext)) {
          return cb(
            new BadRequestException('Only PNG, JPG, JPEG, GIF, WEBP, and SVG images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadCatalogImage(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('No image file uploaded');
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      try {
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true,
        });

        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: 'mcom/catalog',
          resource_type: 'image',
        });

        // Clean up temporary local disk file
        try {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {}

        this.logger.log(`Uploaded catalog image to Cloudinary: ${uploadResult.secure_url}`);
        return {
          success: true,
          url: uploadResult.secure_url || uploadResult.url,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
        };
      } catch (err: any) {
        this.logger.error('Cloudinary catalog image upload failed:', err);
        try {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch {}
        throw new BadRequestException(`Image upload failed: ${err.message || 'Corrupt or unreadable image'}`);
      }
    }

    // Fallback if Cloudinary env vars are missing
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/catalog/${file.filename}`;
    return {
      success: true,
      url: fileUrl,
    };
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
