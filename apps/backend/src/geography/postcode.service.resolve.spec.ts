import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { PostcodeService } from './postcode.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function postcodeResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      status: 200,
      result: {
        postcode: 'M1 1AE',
        outcode: 'M1',
        country: 'England',
        region: 'North West',
        admin_district: 'Manchester',
        admin_ward: 'Piccadilly',
        parish: 'Manchester, unparished area',
        latitude: 53.483487,
        longitude: -2.231182,
        codes: {
          admin_district: 'E08000003',
          admin_ward: 'E05011376',
        },
        ...overrides,
      },
    },
  };
}

describe('PostcodeService — UK hierarchy resolution', () => {
  let service: PostcodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostcodeService();
    mockedAxios.isAxiosError.mockReturnValue(false);
    mockedAxios.post.mockRejectedValue(new Error('overpass unavailable'));
  });

  it('resolves a real city and borough, falling back to the ward when OSM has no high street', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/postcodes/M11AE')) {
        return Promise.resolve(postcodeResponse());
      }
      if (url.includes('/places')) {
        return Promise.resolve({
          data: {
            status: 200,
            result: [
              {
                name_1: 'Manchester',
                local_type: 'City',
                district_borough: 'Manchester',
                country: 'England',
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const resolved = await service.resolve('M1 1AE');

    expect(resolved.city).toBe('Manchester');
    expect(resolved.borough).toBe('Manchester');
    expect(resolved.highStreet).toBe('Piccadilly');
    expect(resolved.highStreetSource).toBe('ward');
    expect(resolved.boroughGssCode).toBe('E08000003');
    expect(resolved.outwardCode).toBe('M1');
  });

  it('uses the densest named street from OSM as the high street', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/postcodes/M11AE')) {
        return Promise.resolve(postcodeResponse());
      }
      if (url.includes('/places')) {
        return Promise.resolve({
          data: {
            status: 200,
            result: [
              {
                name_1: 'Manchester',
                local_type: 'City',
                district_borough: 'Manchester',
                country: 'England',
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    mockedAxios.post.mockResolvedValue({
      data: {
        elements: [
          { tags: { 'addr:street': 'Oldham Street' }, lat: 53.484, lon: -2.236 },
          { tags: { 'addr:street': 'Oldham Street' }, lat: 53.4841, lon: -2.2361 },
          { tags: { 'addr:street': 'Oldham Street' }, lat: 53.4842, lon: -2.2362 },
          { tags: { 'addr:street': 'Church Street' }, lat: 53.483, lon: -2.234 },
        ],
      },
    });

    const resolved = await service.resolve('M1 1AE');

    expect(resolved.highStreet).toBe('Oldham Street');
    expect(resolved.highStreetSource).toBe('osm');
    expect(resolved.highStreetGssCode).toBeNull();
  });

  it('maps London postcodes to the city of London', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/postcodes/SW1A1AA')) {
        return Promise.resolve(
          postcodeResponse({
            postcode: 'SW1A 1AA',
            outcode: 'SW1A',
            region: 'London',
            admin_district: 'Westminster',
            admin_ward: "St James's",
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const resolved = await service.resolve('SW1A 1AA');

    expect(resolved.city).toBe('London');
    expect(resolved.borough).toBe('Westminster');
  });

  it('uses the country as the city for devolved capitals when region is null', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/postcodes/CF101EP')) {
        return Promise.resolve(
          postcodeResponse({
            postcode: 'CF10 1EP',
            outcode: 'CF10',
            country: 'Wales',
            region: null,
            admin_district: 'Cardiff',
            admin_ward: 'Cathays',
            parish: 'Castle',
            codes: {
              admin_district: 'W06000015',
              admin_ward: 'W05001274',
            },
          }),
        );
      }
      if (url.includes('/places')) {
        return Promise.resolve({
          data: {
            status: 200,
            result: [
              {
                name_1: 'Caerdydd',
                name_2: 'Cardiff',
                local_type: 'City',
                county_unitary: 'Caerdydd - Cardiff',
                country: 'Wales',
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const resolved = await service.resolve('CF10 1EP');

    expect(resolved.city).toBe('Cardiff');
    expect(resolved.borough).toBe('Cardiff');
  });

  it('rejects crown-dependency postcodes because they are not UK postcodes', async () => {
    mockedAxios.get.mockResolvedValue(
      postcodeResponse({
        postcode: 'GY1 1AA',
        country: 'Channel Islands',
        region: null,
        admin_district: 'Channel Islands',
        admin_ward: 'Channel Islands (pseudo)',
      }),
    );

    await expect(service.resolve('GY1 1AA')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reports terminated postcodes clearly', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/postcodes/')) {
        return Promise.reject({
          isAxiosError: true,
          response: { status: 404 },
          message: 'Request failed with status code 404',
        });
      }
      if (url.includes('/terminated_postcodes/')) {
        return Promise.resolve({
          data: { status: 200, result: { year_terminated: 2019 } },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    await expect(service.resolve('AB1 2CD')).rejects.toThrow(
      /terminated in 2019/i,
    );
  });
});
