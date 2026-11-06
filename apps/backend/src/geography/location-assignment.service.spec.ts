import { LocationAssignmentService } from './location-assignment.service';
import type { ResolvedPostcode } from './postcode.service';

function resolvedPostcode(
  overrides: Partial<ResolvedPostcode> = {},
): ResolvedPostcode {
  return {
    postcode: 'SE15 3TR',
    outwardCode: 'SE15',
    city: 'London',
    borough: 'Southwark',
    highStreet: 'Rye Lane',
    localMall: 'Rye Lane Local Mall',
    region: 'London',
    country: 'England',
    latitude: 51.4696,
    longitude: -0.0639,
    adminDistrict: 'Southwark',
    adminWard: 'Rye Lane',
    parish: '',
    cityGssCode: null,
    boroughGssCode: 'E09000028',
    highStreetGssCode: null,
    highStreetSource: 'osm',
    source: 'postcodes.io',
    ...overrides,
  };
}

describe('LocationAssignmentService', () => {
  const business = {
    id: 'business-1',
    postcode: 'SE15 3TR',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    cityId: null,
    boroughId: null,
    highStreetId: null,
    localMallId: null,
    sectorId: null,
    categoryId: null,
    subCategoryId: null,
  };

  const city = {
    id: 'city-1',
    name: 'London',
    region: 'London',
    country: 'England',
    gssCode: null,
  };
  const borough = {
    id: 'borough-1',
    name: 'Southwark',
    cityId: 'legacy-region-city',
    region: 'London',
    gssCode: 'E09000028',
  };
  const highStreet = {
    id: 'high-street-1',
    name: 'Rye Lane',
    borough: 'Southwark',
    cityId: 'city-1',
    boroughId: 'borough-1',
    lat: 51.4696,
    lng: -0.0639,
    gssCode: null,
  };
  const mall = {
    id: 'mall-1',
    name: 'Peckham LocalMall',
    postcodes: ['SE15', 'SE5', 'SE22'],
    cityId: 'city-1',
    boroughId: 'borough-1',
    highStreetId: 'high-street-1',
  };

  function buildHarness() {
    const tx = {
      city: {
        findFirst: jest.fn().mockResolvedValue(city),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(city),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      borough: {
        findFirst: jest.fn().mockResolvedValue(borough),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...borough, cityId: 'city-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      highStreet: {
        findFirst: jest.fn().mockResolvedValue(highStreet),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(highStreet),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      localMall: {
        findFirst: jest.fn().mockResolvedValue(mall),
        findMany: jest.fn().mockResolvedValue([mall]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(mall),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      businessProfile: {
        update: jest.fn().mockResolvedValue({ id: 'business-1' }),
      },
      sector: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      category: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      subCategory: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    const prisma = {
      businessProfile: { findUnique: jest.fn().mockResolvedValue(business) },
      $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) =>
        fn(tx),
      ),
    };

    const service = new LocationAssignmentService(
      prisma as any,
      {} as any,
    );
    return { service, prisma, tx };
  }

  it('reuses an existing local mall that already covers the postcode outcode', async () => {
    const { service, tx } = buildHarness();

    const result = await service.assignBusiness('business-1', {
      postcode: 'SE15 3TR',
      resolvedPostcode: resolvedPostcode(),
    });

    expect(result?.localMallId).toBe('mall-1');
    expect(result?.localMallName).toBe('Peckham LocalMall');
    expect(tx.localMall.create).not.toHaveBeenCalled();
    expect(tx.businessProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          localMallId: 'mall-1',
          cityId: 'city-1',
          boroughId: 'borough-1',
          highStreetId: 'high-street-1',
        }),
      }),
    );
  });

  it('remaps a legacy region city to the real settlement', async () => {
    const { service, tx } = buildHarness();

    await service.assignBusiness('business-1', {
      postcode: 'SE15 3TR',
      resolvedPostcode: resolvedPostcode(),
    });

    expect(tx.borough.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          city: { connect: { id: 'city-1' } },
        }),
      }),
    );
  });

  it('creates the hierarchy when none of it exists', async () => {
    const { service, tx } = buildHarness();
    tx.city.findFirst.mockResolvedValue(null);
    tx.city.create.mockResolvedValue({ ...city, id: 'city-new' });
    tx.borough.findFirst.mockResolvedValue(null);
    tx.borough.create.mockResolvedValue({ ...borough, id: 'borough-new', cityId: 'city-new' });
    tx.highStreet.findFirst.mockResolvedValue(null);
    tx.highStreet.create.mockResolvedValue({
      ...highStreet,
      id: 'high-street-new',
      cityId: 'city-new',
      boroughId: 'borough-new',
    });
    tx.localMall.findFirst.mockResolvedValue(null);
    tx.localMall.findMany.mockResolvedValue([]);
    tx.localMall.create.mockResolvedValue({
      ...mall,
      id: 'mall-new',
      name: 'Rye Lane Local Mall',
      cityId: 'city-new',
      boroughId: 'borough-new',
      highStreetId: 'high-street-new',
    });

    const result = await service.assignBusiness('business-1', {
      postcode: 'SE15 3TR',
      resolvedPostcode: resolvedPostcode(),
    });

    expect(tx.city.create).toHaveBeenCalled();
    expect(tx.borough.create).toHaveBeenCalled();
    expect(tx.highStreet.create).toHaveBeenCalled();
    expect(tx.localMall.create).toHaveBeenCalled();
    expect(result?.localMallId).toBe('mall-new');
  });
});
