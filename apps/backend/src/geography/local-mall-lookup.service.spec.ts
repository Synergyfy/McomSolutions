import { LocalMallLookupService } from './local-mall-lookup.service';
import type { PostcodeService, ResolvedPostcode } from './postcode.service';

function resolvedPostcode(
  overrides: Partial<ResolvedPostcode> = {},
): ResolvedPostcode {
  return {
    postcode: 'SE15 4TP',
    outwardCode: 'SE15',
    city: 'London',
    borough: 'Southwark',
    highStreet: 'Nunhead Lane',
    localMall: 'Peckham LocalMall',
    region: 'London',
    country: 'England',
    latitude: 51.467501,
    longitude: -0.066371,
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

const peckhamMall = {
  id: 'mall-peckham',
  name: 'Peckham LocalMall',
  slug: 'peckham-localmall',
  osmId: 'node/1',
  source: 'osm',
  postcodes: ['SE15'],
  borough: 'Southwark',
  cityId: 'city-london',
  boroughId: 'borough-southwark',
  highStreetId: 'street-nunhead',
  primaryHighStreet: 'Nunhead Lane',
  additionalHighStreets: [],
  businesses: 0,
  affiliateCount: 0,
  customers: 12800,
  campaigns: 8,
  events: 12,
  status: 'Active',
  createdDate: new Date('2026-01-01T00:00:00Z'),
  description: 'Peckham mall',
  longDescription: 'Peckham mall long description',
  tagline: 'Shop local',
  welcomeMessage: 'Welcome',
  logo: null,
  coverBanner: null,
  mobileBanner: null,
  primaryColour: '#1D4ED8',
  secondaryColour: '#F97316',
  radiusCoverage: '5 miles',
};

function buildHarness(options: {
  assignedMallId?: string | null;
  outcodeMall?: any;
  nearestMall?: any;
}) {
  const prisma: any = {
    businessProfile: {
      findFirst: jest.fn().mockResolvedValue(
        options.assignedMallId !== undefined
          ? {
              postcode: 'SE15 4TP',
              localMallId: options.assignedMallId,
              cityId: null,
              boroughId: null,
              highStreetId: null,
            }
          : null,
      ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    customerProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    agentProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    consultantProfile: { findFirst: jest.fn().mockResolvedValue(null) },
    accountManagerProfile: { findFirst: jest.fn().mockResolvedValue(null) },
    localMall: {
      findUnique: jest.fn().mockResolvedValue(
        options.assignedMallId ? peckhamMall : null,
      ),
      findMany: jest.fn().mockImplementation(({ where }: any) => {
        // findNearestMall filters on highStreetId; findByOutwardCode filters
        // on the postcode outcode.
        if (where?.highStreetId) {
          return Promise.resolve(options.nearestMall ? [options.nearestMall] : []);
        }
        return Promise.resolve(options.outcodeMall ? [options.outcodeMall] : []);
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    campaign: { count: jest.fn().mockResolvedValue(0) },
    city: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'city-london',
        name: 'London',
        region: 'London',
        country: 'England',
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    borough: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'borough-southwark',
        name: 'Southwark',
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    highStreet: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'street-nunhead',
        name: 'Nunhead Lane',
        lat: 51.463688,
        lng: -0.062573,
      }),
    },
  };

  const postcodeService = {
    resolve: jest.fn().mockResolvedValue(resolvedPostcode()),
  } as unknown as PostcodeService;

  return {
    prisma,
    service: new LocalMallLookupService(prisma, postcodeService),
  };
}

describe('LocalMallLookupService', () => {
  it('prefers the mall already assigned to the user profile', async () => {
    const { service } = buildHarness({ assignedMallId: 'mall-peckham' });

    const result = await service.resolve({
      userId: 'central-user-1',
      postcode: 'SE15 4TP',
    });

    expect(result.matchType).toBe('assignment');
    expect(result.mall?.name).toBe('Peckham LocalMall');
  });

  it('matches a mall by outward code when no assignment exists', async () => {
    const { service } = buildHarness({
      assignedMallId: null,
      outcodeMall: { ...peckhamMall, highStreetRef: { lat: 51.463688, lng: -0.062573 } },
    });

    const result = await service.resolve({ postcode: 'SE15 4TP' });

    expect(result.matchType).toBe('outward-code');
    expect(result.mall?.id).toBe('mall-peckham');
    expect(result.outwardCode).toBe('SE15');
  });

  it('falls back to the nearest mall when no outcode is covered', async () => {
    const { service } = buildHarness({
      assignedMallId: null,
      outcodeMall: null,
      nearestMall: {
        ...peckhamMall,
        postcodes: ['SE5'],
        highStreetRef: { lat: 51.463688, lng: -0.062573 },
      },
    });

    const result = await service.resolve({ postcode: 'SE15 4TP' });

    expect(result.matchType).toBe('nearest');
    expect(result.distanceKm).not.toBeNull();
  });
});
