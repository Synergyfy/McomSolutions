import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { EcosystemProfilesService } from './ecosystem-profiles.service';
import { PrismaService } from '../prisma/prisma.service';
import { SsoService } from '../auth/sso.service';

describe('EcosystemProfilesService', () => {
  let service: EcosystemProfilesService;
  let prisma: any;
  let sso: any;

  const mockPrisma: any = {
    user: { findFirst: jest.fn() },
    ssoClient: { findUnique: jest.fn() },
  };

  const mockSso = {
    getIntrospectedEntitlement: jest.fn().mockResolvedValue({ user: { id: 'usr_1' } }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EcosystemProfilesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SsoService, useValue: mockSso },
      ],
    }).compile();

    service = module.get(EcosystemProfilesService);
    prisma = module.get(PrismaService);
    sso = module.get(SsoService);
    jest.clearAllMocks();
  });

  it('returns the canonical profile when the caller serves the role', async () => {
    prisma.user.findFirst.mockResolvedValue({ role: Role.BUSINESS });
    prisma.ssoClient.findUnique.mockResolvedValue({
      isActive: true,
      supportedRoles: [Role.BUSINESS, Role.CUSTOMER],
    });

    await service.getProfileForCaller('mcom-mall', 'usr_1');

    expect(sso.getIntrospectedEntitlement).toHaveBeenCalledWith('mcom-mall', 'usr_1');
  });

  it('allows legacy apps with an empty supportedRoles list', async () => {
    prisma.user.findFirst.mockResolvedValue({ role: Role.AGENT });
    prisma.ssoClient.findUnique.mockResolvedValue({
      isActive: true,
      supportedRoles: [],
    });

    await service.getProfileForCaller('legacy-app', 'usr_1');

    expect(sso.getIntrospectedEntitlement).toHaveBeenCalled();
  });

  it('rejects reads for a role the caller does not serve', async () => {
    prisma.user.findFirst.mockResolvedValue({ role: Role.AGENT });
    prisma.ssoClient.findUnique.mockResolvedValue({
      isActive: true,
      supportedRoles: [Role.BUSINESS],
    });

    await expect(
      service.getProfileForCaller('mcom-mall', 'usr_1'),
    ).rejects.toThrow(ForbiddenException);
    expect(sso.getIntrospectedEntitlement).not.toHaveBeenCalled();
  });

  it('rejects inactive callers', async () => {
    prisma.user.findFirst.mockResolvedValue({ role: Role.BUSINESS });
    prisma.ssoClient.findUnique.mockResolvedValue({
      isActive: false,
      supportedRoles: [Role.BUSINESS],
    });

    await expect(
      service.getProfileForCaller('mcom-mall', 'usr_1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 for unknown users', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.getProfileForCaller('mcom-mall', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
