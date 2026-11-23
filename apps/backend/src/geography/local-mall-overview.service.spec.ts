import { NotFoundException } from '@nestjs/common';
import { LocalMallOverviewService } from './local-mall-overview.service';

describe('LocalMallOverviewService', () => {
  const prisma = {
    user: { findFirst: jest.fn() },
    city: { findUnique: jest.fn() },
    borough: { findUnique: jest.fn() },
    highStreet: { findUnique: jest.fn() },
    localMall: { findUnique: jest.fn() },
    businessProfile: { findMany: jest.fn(), count: jest.fn() },
  };

  const service = new LocalMallOverviewService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('resolves the stored hierarchy and partner businesses for a business', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      role: 'BUSINESS',
      customerProfile: null,
      businessProfile: {
        id: 'business-1',
        postcode: 'SW1A 1AA',
        cityId: 'city-1',
        boroughId: 'borough-1',
        highStreetId: 'street-1',
        localMallId: 'mall-1',
        locationAssignedAt: new Date('2026-01-02T03:04:05Z'),
      },
    });
    prisma.city.findUnique.mockResolvedValue({ id: 'city-1', name: 'London' });
    prisma.borough.findUnique.mockResolvedValue({ id: 'borough-1', name: 'Westminster' });
    prisma.highStreet.findUnique.mockResolvedValue({ id: 'street-1', name: 'Buckingham Gate' });
    prisma.localMall.findUnique.mockResolvedValue({
      id: 'mall-1',
      name: "St James's Local Mall",
      slug: 'st-james-local-mall',
      status: 'Active',
      postcodes: ['SW1A'],
    });
    prisma.businessProfile.findMany.mockResolvedValue([
      {
        id: 'business-2',
        businessName: 'Cedar Fitness Studio',
        logoUrl: null,
        category: 'Fitness',
        industry: null,
        membershipTier: 'Pro+',
      },
    ]);
    prisma.businessProfile.count.mockResolvedValue(4);

    const overview = await service.getOverview('user-1');

    expect(overview).toMatchObject({
      assigned: true,
      role: 'BUSINESS',
      postcode: 'SW1A 1AA',
      city: { name: 'London' },
      borough: { name: 'Westminster' },
      highStreet: { name: 'Buckingham Gate' },
      localMall: { name: "St James's Local Mall" },
      locationAssignedAt: '2026-01-02T03:04:05.000Z',
      partnerCount: 4,
    });
    expect(overview.partners).toHaveLength(1);
    // The requesting business must never appear in its own partner list.
    expect(prisma.businessProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ localMallId: 'mall-1', id: { not: 'business-1' } }),
      }),
    );
  });

  it('returns an unassigned payload when the profile has no location', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-2',
      role: 'BUSINESS',
      customerProfile: null,
      businessProfile: {
        id: 'business-2',
        postcode: '3DZDS34R34',
        cityId: null,
        boroughId: null,
        highStreetId: null,
        localMallId: null,
        locationAssignedAt: null,
      },
    });

    const overview = await service.getOverview('user-2');

    expect(overview.assigned).toBe(false);
    expect(overview.localMall).toBeNull();
    expect(overview.partners).toEqual([]);
    expect(overview.partnerCount).toBe(0);
    expect(prisma.businessProfile.findMany).not.toHaveBeenCalled();
  });

  it('falls back to the customer profile and includes every business in the mall', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-3',
      role: 'CUSTOMER',
      businessProfile: null,
      customerProfile: {
        id: 'customer-1',
        postcode: 'SE15 4PT',
        cityId: 'city-1',
        boroughId: 'borough-1',
        highStreetId: 'street-1',
        localMallId: 'mall-1',
        locationAssignedAt: new Date('2026-02-01T00:00:00Z'),
      },
    });
    prisma.city.findUnique.mockResolvedValue({ id: 'city-1', name: 'London' });
    prisma.borough.findUnique.mockResolvedValue({ id: 'borough-1', name: 'Southwark' });
    prisma.highStreet.findUnique.mockResolvedValue({ id: 'street-1', name: 'Rye Lane' });
    prisma.localMall.findUnique.mockResolvedValue({
      id: 'mall-1',
      name: 'Rye Lane Local Mall',
      slug: 'rye-lane-local-mall',
      status: 'Active',
      postcodes: ['SE15'],
    });
    prisma.businessProfile.findMany.mockResolvedValue([]);
    prisma.businessProfile.count.mockResolvedValue(0);

    const overview = await service.getOverview('user-3');

    expect(overview.role).toBe('CUSTOMER');
    expect(overview.localMall?.name).toBe('Rye Lane Local Mall');
    expect(prisma.businessProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { localMallId: 'mall-1', deletedAt: null } }),
    );
  });

  it('throws when the user does not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.getOverview('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses an empty user id instead of querying without a filter', async () => {
    await expect(service.getOverview('')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
