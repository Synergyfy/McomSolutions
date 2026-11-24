import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ProfileSyncService } from './profile-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';

describe('ProfileSyncService', () => {
  let service: ProfileSyncService;
  let prisma: any;
  let dispatcher: any;

  const mockPrisma: any = {
    ssoClient: {
      findMany: jest.fn(),
    },
  };

  const mockDispatcher = {
    dispatchAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WebhookDispatcherService, useValue: mockDispatcher },
      ],
    }).compile();

    service = module.get(ProfileSyncService);
    prisma = module.get(PrismaService);
    dispatcher = module.get(WebhookDispatcherService);
    jest.clearAllMocks();
  });

  it('routes a business update only to apps that declare BUSINESS and have one endpoint', async () => {
    prisma.ssoClient.findMany.mockResolvedValue([
      {
        clientId: 'mcom-mall',
        name: 'MCOM Mall',
        supportedRoles: [Role.BUSINESS, Role.CUSTOMER],
        profileSyncEndpoint: 'https://api.mall.com/webhooks/profile-updated',
      },
      {
        clientId: '247gbs-affiliate',
        name: '247GBS Affiliate',
        supportedRoles: [Role.AGENT, Role.CONSULTANT, Role.ACCOUNT_MANAGER],
        profileSyncEndpoint: 'https://api.247gbs.com/webhooks/profile-updated',
      },
    ]);

    await service.emitProfileUpdated({
      userId: 'usr_1',
      role: Role.BUSINESS,
      profileId: 'biz_1',
      changedFields: ['businessName'],
    });

    expect(dispatcher.dispatchAsync).toHaveBeenCalledTimes(1);
    const [clientId, event, data, options] = dispatcher.dispatchAsync.mock.calls[0];
    expect(clientId).toBe('mcom-mall');
    expect(event).toBe('profile.updated');
    // Only the user id (plus event metadata) crosses the wire — no profile data.
    expect(data).toEqual(
      expect.objectContaining({ userId: 'usr_1' }),
    );
    expect(data.profile).toBeUndefined();
    expect(data.role).toBeUndefined();
    expect(data.eventId).toEqual(expect.any(String));
    expect(options.targetUrl).toBe('https://api.mall.com/webhooks/profile-updated');
  });

  it('treats an empty supportedRoles list as "all roles" for legacy apps', async () => {
    prisma.ssoClient.findMany.mockResolvedValue([
      {
        clientId: 'legacy-app',
        name: 'Legacy',
        supportedRoles: [],
        profileSyncEndpoint: 'https://legacy.example.com/profile-sync',
      },
    ]);

    await service.emitProfileUpdated({ userId: 'usr_2', role: Role.CUSTOMER });

    expect(dispatcher.dispatchAsync).toHaveBeenCalledWith(
      'legacy-app',
      'profile.updated',
      expect.objectContaining({ userId: 'usr_2' }),
      { targetUrl: 'https://legacy.example.com/profile-sync' },
    );
  });

  it('skips apps that support the role but registered no endpoint', async () => {
    prisma.ssoClient.findMany.mockResolvedValue([
      {
        clientId: 'no-endpoint',
        name: 'No endpoint',
        supportedRoles: [Role.BUSINESS],
        profileSyncEndpoint: null,
      },
    ]);

    await service.emitProfileUpdated({ userId: 'usr_3', role: Role.BUSINESS });

    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  it('never publishes for non-profile roles such as ADMIN', async () => {
    await service.emitProfileUpdated({ userId: 'usr_admin', role: Role.ADMIN });

    expect(prisma.ssoClient.findMany).not.toHaveBeenCalled();
    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  it('swallows database failures so profile saves never fail', async () => {
    prisma.ssoClient.findMany.mockRejectedValue(new Error('db down'));

    await expect(
      service.emitProfileUpdated({ userId: 'usr_4', role: Role.CUSTOMER }),
    ).resolves.toBeUndefined();
    expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
  });

  describe('emitProfileDeleted', () => {
    it('publishes a profile.deleted event to apps that support the role', async () => {
      prisma.ssoClient.findMany.mockResolvedValue([
        {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          supportedRoles: [Role.BUSINESS, Role.CUSTOMER],
          profileSyncEndpoint: 'https://api.mall.com/webhooks/profile-updated',
        },
      ]);

      await service.emitProfileDeleted({
        userId: 'usr_9',
        role: Role.BUSINESS,
        profileId: 'biz_9',
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      expect(dispatcher.dispatchAsync).toHaveBeenCalledTimes(1);
      const [clientId, event, data, options] = dispatcher.dispatchAsync.mock.calls[0];
      expect(clientId).toBe('mcom-mall');
      expect(event).toBe('profile.deleted');
      expect(data).toEqual(
        expect.objectContaining({
          userId: 'usr_9',
          deleted: true,
          deletedAt: '2026-01-01T00:00:00.000Z',
        }),
      );
      expect(data.eventId).toEqual(expect.any(String));
      expect(options.targetUrl).toBe('https://api.mall.com/webhooks/profile-updated');
    });

    it('never publishes a delete event for non-profile roles', async () => {
      await service.emitProfileDeleted({ userId: 'usr_admin', role: Role.ADMIN });

      expect(prisma.ssoClient.findMany).not.toHaveBeenCalled();
      expect(dispatcher.dispatchAsync).not.toHaveBeenCalled();
    });
  });
});
