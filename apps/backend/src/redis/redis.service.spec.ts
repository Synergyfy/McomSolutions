import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    await service.onModuleInit();
  });

  it('should set, get and delete keys from cache', async () => {
    await service.set('test:key1', { hello: 'world' }, 60);
    const value = await service.get<{ hello: string }>('test:key1');
    expect(value).toEqual({ hello: 'world' });

    await service.del('test:key1');
    const afterDel = await service.get('test:key1');
    expect(afterDel).toBeNull();
  });

  it('should delete keys by pattern with delPattern', async () => {
    await service.set('user:1:profile', 'alice', 60);
    await service.set('user:2:profile', 'bob', 60);
    await service.set('other:key', 'charlie', 60);

    await service.delPattern('user:*:profile');

    expect(await service.get('user:1:profile')).toBeNull();
    expect(await service.get('user:2:profile')).toBeNull();
    expect(await service.get('other:key')).toBe('charlie');
  });

  it('should acquire lock with setNx and release when expired or deleted', async () => {
    const acquired = await service.setNx('lock:resource', '1', 60);
    expect(acquired).toBe(true);

    const acquiredAgain = await service.setNx('lock:resource', '1', 60);
    expect(acquiredAgain).toBe(false);

    await service.del('lock:resource');
    const acquiredAfterDel = await service.setNx('lock:resource', '1', 60);
    expect(acquiredAfterDel).toBe(true);
  });
});
