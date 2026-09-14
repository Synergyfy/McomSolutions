import { Test, TestingModule } from '@nestjs/testing';
import { AdminCatalogService } from './admin-catalog.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AdminCatalogService', () => {
  let service: AdminCatalogService;

  const mockPrisma = {
    sector: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    subCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCatalogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminCatalogService>(AdminCatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCatalogTree', () => {
    it('should return sectors with nested categories and calculated stats', async () => {
      const mockSectors = [
        {
          id: 'sec-1',
          name: 'Retail',
          slug: 'retail',
          sortOrder: 1,
          categories: [
            {
              id: 'cat-1',
              name: 'Clothing',
              slug: 'clothing',
              sortOrder: 1,
              subCategories: [
                { id: 'sub-1', name: 'Shoes', slug: 'shoes', sortOrder: 1 },
              ],
            },
          ],
        },
      ];
      mockPrisma.sector.findMany.mockResolvedValue(mockSectors);

      const result = await service.getCatalogTree();
      expect(result.success).toBe(true);
      expect(result.data.sectors).toEqual(mockSectors);
      expect(result.data.stats).toEqual({
        totalSectors: 1,
        totalCategories: 1,
        totalSubcategories: 1,
      });
    });
  });

  describe('createSector', () => {
    it('should auto-generate slug and create sector', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);
      mockPrisma.sector.aggregate.mockResolvedValue({ _max: { sortOrder: 5 } });
      mockPrisma.sector.create.mockResolvedValue({
        id: 'sec-new',
        name: 'Health & Wellness',
        slug: 'health-wellness',
        sortOrder: 6,
      });

      const result = await service.createSector(
        { name: 'Health & Wellness' },
        'SuperAdmin',
      );

      expect(mockPrisma.sector.findUnique).toHaveBeenCalledWith({ where: { slug: 'health-wellness' } });
      expect(mockPrisma.sector.create).toHaveBeenCalledWith({
        data: { name: 'Health & Wellness', slug: 'health-wellness', sortOrder: 6 },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('sec-new');
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue({ id: 'sec-exist', slug: 'retail' });

      await expect(
        service.createSector({ name: 'Retail', slug: 'retail' }, 'Admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateSector', () => {
    it('should update existing sector', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue({ id: 'sec-1', name: 'Old', slug: 'old' });
      mockPrisma.sector.update.mockResolvedValue({ id: 'sec-1', name: 'New', slug: 'old', sortOrder: 2 });

      const result = await service.updateSector('sec-1', { name: 'New', sortOrder: 2 });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New');
    });

    it('should throw NotFoundException if sector does not exist', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);
      await expect(
        service.updateSector('non-existent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSector', () => {
    it('should delete sector and cascade log audit', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue({
        id: 'sec-1',
        name: 'Retail',
        categories: [{ id: 'cat-1', subCategories: [{ id: 'sub-1' }] }],
      });
      mockPrisma.sector.delete.mockResolvedValue({ id: 'sec-1' });

      const result = await service.deleteSector('sec-1', 'Admin');
      expect(mockPrisma.sector.delete).toHaveBeenCalledWith({ where: { id: 'sec-1' } });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('createCategory', () => {
    it('should throw NotFoundException if parent sector is missing', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue(null);
      await expect(
        service.createCategory({ sectorId: 'invalid', name: 'Fashion' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create category with parent sector', async () => {
      mockPrisma.sector.findUnique.mockResolvedValue({ id: 'sec-1', name: 'Retail' });
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
      mockPrisma.category.create.mockResolvedValue({
        id: 'cat-1',
        sectorId: 'sec-1',
        name: 'Fashion',
        slug: 'fashion',
        sortOrder: 3,
      });

      const result = await service.createCategory({ sectorId: 'sec-1', name: 'Fashion' });
      expect(result.success).toBe(true);
      expect(mockPrisma.category.create).toHaveBeenCalled();
    });
  });

  describe('createSubCategory', () => {
    it('should throw NotFoundException if parent category is missing', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(
        service.createSubCategory({ categoryId: 'invalid', name: 'Boutique' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create subcategory with parent category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Fashion' });
      mockPrisma.subCategory.findUnique.mockResolvedValue(null);
      mockPrisma.subCategory.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      mockPrisma.subCategory.create.mockResolvedValue({
        id: 'sub-1',
        categoryId: 'cat-1',
        name: 'Boutique',
        slug: 'boutique',
        sortOrder: 1,
      });

      const result = await service.createSubCategory({ categoryId: 'cat-1', name: 'Boutique' });
      expect(result.success).toBe(true);
      expect(mockPrisma.subCategory.create).toHaveBeenCalled();
    });
  });
});
