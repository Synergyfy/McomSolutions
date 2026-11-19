import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { LocationAssignmentService } from '../geography/location-assignment.service';

describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: any;

  const user = {
    id: 'cust-1',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    firstName: 'Ada',
    lastName: 'Lovelace',
    jobTitle: 'Engineer',
    emailNotifications: true,
    twoFactorEnabled: false,
    referralCode: 'ABC123',
    createdAt: new Date('2026-01-05T00:00:00Z'),
  };

  const customerProfile = {
    id: 'cp-1',
    userId: 'cust-1',
    phone: '+447911123456',
    loyaltyPoints: 1200,
    status: 'Active',
    createdAt: new Date('2026-01-05T00:00:00Z'),
    updatedAt: new Date('2026-01-05T00:00:00Z'),
  };

  const mockPrisma = {
    user: { findFirst: jest.fn() },
    customerProfile: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const resolvedPostcode = {
    postcode: 'SW1A 1AA',
    outwardCode: 'SW1A',
    city: 'London',
    borough: 'Westminster',
    highStreet: 'St James',
    localMall: 'London Local Mall',
  };

  const mockLocationAssignment = {
    resolvePostcode: jest.fn().mockResolvedValue(resolvedPostcode),
    assignCustomer: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LocationAssignmentService, useValue: mockLocationAssignment },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('returns identity plus existing customer-profile fields', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.customerProfile.findUnique.mockResolvedValue(customerProfile);

      const result = await service.getProfile('cust-1');

      expect(result).toMatchObject({
        success: true,
        id: 'cust-1',
        email: 'customer@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        jobTitle: 'Engineer',
        phone: '+447911123456',
        loyaltyPoints: 1200,
        status: 'Active',
        referralCode: 'ABC123',
      });
      expect(result.customerProfile).toEqual(customerProfile);
      // Membership tier is deliberately not part of the customer payload yet.
      expect(result).not.toHaveProperty('membershipStatus');
      expect(result).not.toHaveProperty('tier');
    });

    it('lazily creates a missing CustomerProfile', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.customerProfile.findUnique.mockResolvedValue(null);
      mockPrisma.customerProfile.create.mockResolvedValue({
        ...customerProfile,
        phone: null,
        loyaltyPoints: 0,
      });

      const result = await service.getProfile('cust-1');

      expect(mockPrisma.customerProfile.create).toHaveBeenCalledWith({
        data: { userId: 'cust-1' },
        select: expect.any(Object),
      });
      expect(result.phone).toBeNull();
    });

    it('throws when the user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates and trims the phone number', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.customerProfile.upsert.mockResolvedValue({
        ...customerProfile,
        phone: '+447700900123',
      });

      const result = await service.updateProfile('cust-1', { phone: '  +447700900123  ' });

      expect(mockPrisma.customerProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'cust-1' },
          update: { phone: '+447700900123' },
        }),
      );
      expect(result.phone).toBe('+447700900123');
    });

    it('clears the phone when an empty string is sent', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.customerProfile.upsert.mockResolvedValue({
        ...customerProfile,
        phone: null,
      });

      await service.updateProfile('cust-1', { phone: '   ' });

      expect(mockPrisma.customerProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { phone: null } }),
      );
    });

    it('rejects non-customer/missing users', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.updateProfile('missing', { phone: '+1' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.customerProfile.upsert).not.toHaveBeenCalled();
    });

    it('saves a postcode and assigns the customer to their local hierarchy', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockPrisma.customerProfile.upsert.mockResolvedValue({
        ...customerProfile,
        postcode: 'SW1A 1AA',
      });
      mockPrisma.customerProfile.findUniqueOrThrow.mockResolvedValue({
        ...customerProfile,
        postcode: 'SW1A 1AA',
        cityId: 'city-1',
        boroughId: 'borough-1',
        highStreetId: 'street-1',
        localMallId: 'mall-1',
      });

      const result = await service.updateProfile('cust-1', { postcode: 'sw1a1aa' });

      expect(mockLocationAssignment.resolvePostcode).toHaveBeenCalledWith('sw1a1aa');
      expect(mockPrisma.customerProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'cust-1' },
          update: { postcode: 'SW1A 1AA' },
        }),
      );
      expect(mockLocationAssignment.assignCustomer).toHaveBeenCalledWith(
        'cp-1',
        'SW1A 1AA',
        resolvedPostcode,
      );
      expect(result.localMallId).toBe('mall-1');
    });

    it('does not write an invalid postcode', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockLocationAssignment.resolvePostcode.mockRejectedValueOnce(
        new Error('Please enter a valid UK postcode (e.g. SW1A 1AA).'),
      );

      await expect(
        service.updateProfile('cust-1', { postcode: 'not-a-postcode' }),
      ).rejects.toThrow('Please enter a valid UK postcode');

      expect(mockPrisma.customerProfile.upsert).not.toHaveBeenCalled();
    });

    it('refuses to clear a compulsory postcode', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(
        service.updateProfile('cust-1', { postcode: '   ' }),
      ).rejects.toThrow('A UK postcode is required for customer accounts.');

      expect(mockLocationAssignment.resolvePostcode).not.toHaveBeenCalled();
      expect(mockPrisma.customerProfile.upsert).not.toHaveBeenCalled();
    });
  });
});
