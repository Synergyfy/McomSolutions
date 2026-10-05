import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage (G4)', () => {
  const makeStorage = () => {
    const store = new Map<string, { value: any; expiresAt: number }>();
    const redis = {
      get: jest.fn(async (key: string) => {
        const hit = store.get(key);
        if (!hit || Date.now() > hit.expiresAt) return null;
        return hit.value;
      }),
      set: jest.fn(async (key: string, value: any, ttl: number) => {
        store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      }),
    };
    return { storage: new RedisThrottlerStorage(redis as any), redis };
  };

  it('allows hits under the limit without blocking', async () => {
    const { storage } = makeStorage();
    for (let i = 1; i <= 5; i++) {
      const res = await storage.increment('k1', 60000, 5, 60000, 'default');
      expect(res.isBlocked).toBe(false);
      expect(res.totalHits).toBe(i);
    }
  });

  it('blocks after exceeding the limit', async () => {
    const { storage } = makeStorage();
    for (let i = 0; i < 5; i++) {
      await storage.increment('k2', 60000, 5, 60000, 'default');
    }
    const blocked = await storage.increment('k2', 60000, 5, 60000, 'default');
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('unblocks after roughly the ttl (regression: v6 passes ms, not seconds)', async () => {
    const { storage } = makeStorage();
    for (let i = 0; i < 5; i++) {
      await storage.increment('k3', 60000, 5, 60000, 'default');
    }
    const blocked = await storage.increment('k3', 60000, 5, 60000, 'default');
    expect(blocked.isBlocked).toBe(true);
    // 60s window → Retry-After style countdown must be seconds-scale, not ~60000.
    expect(blocked.timeToBlockExpire).toBeLessThanOrEqual(60);
  });

  it('shares the budget across instances via Redis', async () => {
    const backing = new Map<string, { value: any; expiresAt: number }>();
    const shared = {
      get: jest.fn(async (key: string) => {
        const hit = backing.get(key);
        if (!hit || Date.now() > hit.expiresAt) return null;
        return hit.value;
      }),
      set: jest.fn(async (key: string, value: any, ttl: number) => {
        backing.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      }),
    };
    const a = new RedisThrottlerStorage(shared as any);
    const b = new RedisThrottlerStorage(shared as any);
    await a.increment('shared', 60000, 2, 60000, 'default');
    await b.increment('shared', 60000, 2, 60000, 'default');
    const third = await a.increment('shared', 60000, 2, 60000, 'default');
    expect(third.isBlocked).toBe(true);
  });

  it('falls back to memory when Redis fails', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('down')),
      set: jest.fn().mockRejectedValue(new Error('down')),
    };
    const storage = new RedisThrottlerStorage(redis as any);
    const first = await storage.increment('mem', 60000, 5, 60000, 'default');
    expect(first.isBlocked).toBe(false);
    expect(first.totalHits).toBe(1);
  });
});
