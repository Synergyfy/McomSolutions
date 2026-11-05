import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { RedisService } from '../../redis/redis.service';

describe('PresenceService', () => {
  let service: PresenceService;
  let redis: any;

  beforeEach(async () => {
    const sets = new Map<string, Set<string>>();
    redis = {
      sAdd: jest.fn(async (key: string, member: string) => {
        const set = sets.get(key) ?? new Set<string>();
        set.add(member);
        sets.set(key, set);
      }),
      sRem: jest.fn(async (key: string, member: string) => {
        sets.get(key)?.delete(member);
      }),
      sCard: jest.fn(async (key: string) => sets.get(key)?.size ?? 0),
      del: jest.fn(async (key: string) => {
        sets.delete(key);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  it('should track multiple sockets for a user and report online', async () => {
    const wasOffline1 = await service.addSocket('user-1', 'sock-1');
    expect(wasOffline1).toBe(true);
    expect(await service.isUserOnline('user-1')).toBe(true);

    const wasOffline2 = await service.addSocket('user-1', 'sock-2');
    expect(wasOffline2).toBe(false);
    expect(await service.isUserOnline('user-1')).toBe(true);

    // Remove first socket
    const { isNowOffline: off1 } = await service.removeSocket('sock-1');
    expect(off1).toBe(false);
    expect(await service.isUserOnline('user-1')).toBe(true);

    // Remove second socket
    const { isNowOffline: off2 } = await service.removeSocket('sock-2');
    expect(off2).toBe(true);
    expect(await service.isUserOnline('user-1')).toBe(false);
  });
});
