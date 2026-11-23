import { Test } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { PrismaService } from '../prisma/prisma.service';

const baseApp = {
  id: '1',
  clientId: 'mcom-mall',
  name: 'MCOM Mall',
  description: 'Marketplace',
  platformSlug: 'mall',
  appUrl: 'https://mall.example.test',
  redirectUris: [],
  logoUrl: null,
  isSystemApp: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CatalogController.getApps', () => {
  const findMany = jest.fn();

  let controller: CatalogController;

  beforeEach(async () => {
    findMany.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: PrismaService,
          useValue: { ssoClient: { findMany } },
        },
      ],
    }).compile();

    controller = moduleRef.get(CatalogController);
  });

  it('lists registered apps', async () => {
    findMany.mockResolvedValue([baseApp]);

    await expect(controller.getApps()).resolves.toEqual([baseApp]);
  });

  it('excludes the MCOM Central hub from the product directory', async () => {
    findMany.mockResolvedValue([
      { ...baseApp, id: 'central', clientId: 'mcom-central', name: 'MCOM Central', platformSlug: 'mcom-central', isSystemApp: true },
      { ...baseApp, id: 'central-slug', clientId: 'legacy-central', name: 'MCOM Central (legacy)', platformSlug: 'mcom-central' },
      baseApp,
    ]);

    const apps = await controller.getApps();

    expect(apps.map((app) => app.clientId)).toEqual(['mcom-mall']);
  });

  it('keeps apps whose platform slug is not configured', async () => {
    findMany.mockResolvedValue([{ ...baseApp, platformSlug: null }]);

    const apps = await controller.getApps();

    expect(apps).toHaveLength(1);
  });
});
