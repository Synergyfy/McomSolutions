import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSectorDto,
  UpdateSectorDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
} from './dto/catalog.dto';

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Audit Logger Helper ──────────────────────────────────
  private async logAudit(
    action: string,
    targetType: string,
    targetName: string,
    details: string,
    adminName = 'System',
    category = 'Catalog',
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { action, adminName, targetType, targetName, details, category },
      });
    } catch {
      // Avoid failing the transaction if audit log table fails
    }
  }

  // ─── Slug Generator & Uniqueness Helper ────────────────────
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
  }

  // ─── Complete Catalog Tree & Stats ────────────────────────
  async getCatalogTree() {
    const sectors = await this.prisma.sector.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subCategories: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    let totalCategories = 0;
    let totalSubcategories = 0;

    for (const s of sectors) {
      totalCategories += s.categories.length;
      for (const c of s.categories) {
        totalSubcategories += c.subCategories.length;
      }
    }

    return {
      success: true,
      data: {
        sectors,
        stats: {
          totalSectors: sectors.length,
          totalCategories,
          totalSubcategories,
        },
      },
    };
  }

  // ─── Sectors ──────────────────────────────────────────────
  async getSectors() {
    const sectors = await this.prisma.sector.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { categories: true },
        },
      },
    });
    return { success: true, data: sectors };
  }

  async getSectorById(id: string) {
    const sector = await this.prisma.sector.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subCategories: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!sector) {
      throw new NotFoundException(`Sector with ID '${id}' not found`);
    }
    return { success: true, data: sector };
  }

  async createSector(dto: CreateSectorDto, adminName = 'Admin') {
    const slug = dto.slug?.trim() ? this.slugify(dto.slug) : this.slugify(dto.name);

    const existing = await this.prisma.sector.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`A sector with slug '${slug}' already exists`);
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await this.prisma.sector.aggregate({ _max: { sortOrder: true } });
      sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;
    }

    const sector = await this.prisma.sector.create({
      data: {
        name: dto.name.trim(),
        slug,
        sortOrder,
      },
    });

    await this.logAudit(
      'CREATE_SECTOR',
      'Sector',
      sector.name,
      `Created sector "${sector.name}" with slug "${sector.slug}"`,
      adminName,
      'Catalog',
    );

    return { success: true, data: sector };
  }

  async updateSector(id: string, dto: UpdateSectorDto, adminName = 'Admin') {
    const existing = await this.prisma.sector.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Sector with ID '${id}' not found`);
    }

    let slug = existing.slug;
    if (dto.slug && dto.slug.trim() !== existing.slug) {
      slug = this.slugify(dto.slug);
      const slugMatch = await this.prisma.sector.findUnique({ where: { slug } });
      if (slugMatch && slugMatch.id !== id) {
        throw new ConflictException(`A sector with slug '${slug}' already exists`);
      }
    }

    const updated = await this.prisma.sector.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        slug,
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.logAudit(
      'UPDATE_SECTOR',
      'Sector',
      updated.name,
      `Updated sector "${updated.name}"`,
      adminName,
      'Catalog',
    );

    return { success: true, data: updated };
  }

  async deleteSector(id: string, adminName = 'Admin') {
    const existing = await this.prisma.sector.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            subCategories: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Sector with ID '${id}' not found`);
    }

    const catCount = existing.categories.length;
    let subCount = 0;
    for (const c of existing.categories) {
      subCount += c.subCategories.length;
    }

    await this.prisma.sector.delete({ where: { id } });

    await this.logAudit(
      'DELETE_SECTOR',
      'Sector',
      existing.name,
      `Deleted sector "${existing.name}" along with ${catCount} categories and ${subCount} subcategories`,
      adminName,
      'Catalog',
    );

    return { success: true, message: `Sector "${existing.name}" deleted successfully` };
  }

  // ─── Categories ───────────────────────────────────────────
  async getCategories(sectorId?: string) {
    const categories = await this.prisma.category.findMany({
      where: sectorId ? { sectorId } : {},
      orderBy: { sortOrder: 'asc' },
      include: {
        sector: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { subCategories: true },
        },
      },
    });
    return { success: true, data: categories };
  }

  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        sector: true,
        subCategories: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }
    return { success: true, data: category };
  }

  async createCategory(dto: CreateCategoryDto, adminName = 'Admin') {
    const sector = await this.prisma.sector.findUnique({ where: { id: dto.sectorId } });
    if (!sector) {
      throw new NotFoundException(`Parent sector with ID '${dto.sectorId}' not found`);
    }

    const slug = dto.slug?.trim() ? this.slugify(dto.slug) : this.slugify(dto.name);
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`A category with slug '${slug}' already exists`);
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await this.prisma.category.aggregate({
        where: { sectorId: dto.sectorId },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;
    }

    const category = await this.prisma.category.create({
      data: {
        sectorId: dto.sectorId,
        name: dto.name.trim(),
        slug,
        sortOrder,
      },
      include: {
        sector: { select: { id: true, name: true, slug: true } },
      },
    });

    await this.logAudit(
      'CREATE_CATEGORY',
      'Category',
      category.name,
      `Created category "${category.name}" under sector "${sector.name}"`,
      adminName,
      'Catalog',
    );

    return { success: true, data: category };
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, adminName = 'Admin') {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    if (dto.sectorId && dto.sectorId !== existing.sectorId) {
      const sector = await this.prisma.sector.findUnique({ where: { id: dto.sectorId } });
      if (!sector) {
        throw new NotFoundException(`Parent sector with ID '${dto.sectorId}' not found`);
      }
    }

    let slug = existing.slug;
    if (dto.slug && dto.slug.trim() !== existing.slug) {
      slug = this.slugify(dto.slug);
      const slugMatch = await this.prisma.category.findUnique({ where: { slug } });
      if (slugMatch && slugMatch.id !== id) {
        throw new ConflictException(`A category with slug '${slug}' already exists`);
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.sectorId ? { sectorId: dto.sectorId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        slug,
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: {
        sector: { select: { id: true, name: true, slug: true } },
      },
    });

    await this.logAudit(
      'UPDATE_CATEGORY',
      'Category',
      updated.name,
      `Updated category "${updated.name}"`,
      adminName,
      'Catalog',
    );

    return { success: true, data: updated };
  }

  async deleteCategory(id: string, adminName = 'Admin') {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: {
        subCategories: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    const subCount = existing.subCategories.length;
    await this.prisma.category.delete({ where: { id } });

    await this.logAudit(
      'DELETE_CATEGORY',
      'Category',
      existing.name,
      `Deleted category "${existing.name}" along with ${subCount} subcategories`,
      adminName,
      'Catalog',
    );

    return { success: true, message: `Category "${existing.name}" deleted successfully` };
  }

  // ─── SubCategories ────────────────────────────────────────
  async getSubCategories(categoryId?: string) {
    const subCategories = await this.prisma.subCategory.findMany({
      where: categoryId ? { categoryId } : {},
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            sector: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    return { success: true, data: subCategories };
  }

  async getSubCategoryById(id: string) {
    const subCategory = await this.prisma.subCategory.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            sector: true,
          },
        },
      },
    });
    if (!subCategory) {
      throw new NotFoundException(`SubCategory with ID '${id}' not found`);
    }
    return { success: true, data: subCategory };
  }

  async createSubCategory(dto: CreateSubCategoryDto, adminName = 'Admin') {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw new NotFoundException(`Parent category with ID '${dto.categoryId}' not found`);
    }

    const slug = dto.slug?.trim() ? this.slugify(dto.slug) : this.slugify(dto.name);
    const existing = await this.prisma.subCategory.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`A subcategory with slug '${slug}' already exists`);
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await this.prisma.subCategory.aggregate({
        where: { categoryId: dto.categoryId },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;
    }

    const subCategory = await this.prisma.subCategory.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        slug,
        sortOrder,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await this.logAudit(
      'CREATE_SUBCATEGORY',
      'SubCategory',
      subCategory.name,
      `Created subcategory "${subCategory.name}" under category "${category.name}"`,
      adminName,
      'Catalog',
    );

    return { success: true, data: subCategory };
  }

  async updateSubCategory(id: string, dto: UpdateSubCategoryDto, adminName = 'Admin') {
    const existing = await this.prisma.subCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`SubCategory with ID '${id}' not found`);
    }

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new NotFoundException(`Parent category with ID '${dto.categoryId}' not found`);
      }
    }

    let slug = existing.slug;
    if (dto.slug && dto.slug.trim() !== existing.slug) {
      slug = this.slugify(dto.slug);
      const slugMatch = await this.prisma.subCategory.findUnique({ where: { slug } });
      if (slugMatch && slugMatch.id !== id) {
        throw new ConflictException(`A subcategory with slug '${slug}' already exists`);
      }
    }

    const updated = await this.prisma.subCategory.update({
      where: { id },
      data: {
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        slug,
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await this.logAudit(
      'UPDATE_SUBCATEGORY',
      'SubCategory',
      updated.name,
      `Updated subcategory "${updated.name}"`,
      adminName,
      'Catalog',
    );

    return { success: true, data: updated };
  }

  async deleteSubCategory(id: string, adminName = 'Admin') {
    const existing = await this.prisma.subCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`SubCategory with ID '${id}' not found`);
    }

    await this.prisma.subCategory.delete({ where: { id } });

    await this.logAudit(
      'DELETE_SUBCATEGORY',
      'SubCategory',
      existing.name,
      `Deleted subcategory "${existing.name}"`,
      adminName,
      'Catalog',
    );

    return { success: true, message: `SubCategory "${existing.name}" deleted successfully` };
  }
}
