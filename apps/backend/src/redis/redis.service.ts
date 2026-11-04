import { Injectable, OnModuleInit, OnModuleDestroy, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryCache = new Map<string, { value: any; expiresAt: number }>();
  // Redis Set emulation for the in-memory fallback (presence, watchers).
  private readonly memorySets = new Map<string, { members: Set<string>; expiresAt: number }>();
  // Redis Hash emulation for the in-memory fallback (typing indicators).
  private readonly memoryHashes = new Map<string, { fields: Map<string, string>; expiresAt: number }>();
  private isRedisAvailable = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // In test environments, skip Redis entirely and rely on the in-memory cache.
    // This prevents ioredis from entering its retry loop when Redis isn't running,
    // which was causing test processes to hang indefinitely.
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Test environment: Redis connection skipped — using in-memory cache.');
      return;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    const options: RedisOptions = {
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: 0,    // Don't retry individual commands — fail fast
      enableOfflineQueue: false,  // Don't queue commands while disconnected (they'd never resolve)
      connectTimeout: 2000,       // Give up connecting after 2 seconds
      retryStrategy(times) {
        // Stop retrying after 3 attempts so the process can exit cleanly
        if (times >= 3) return null;
        return Math.min(times * 100, 1000);
      },
    };

    if (password && password.trim() !== '') {
      options.password = password.trim();
    }

    try {
      if (redisUrl && redisUrl.trim() !== '') {
        this.client = new Redis(redisUrl.trim(), {
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          connectTimeout: 2000,
          retryStrategy(times) {
            if (times >= 3) return null;
            return Math.min(times * 100, 1000);
          },
        });
      } else {
        this.client = new Redis(options);
      }

      this.client.on('error', (err) => {
        this.logger.warn(`Redis connection event error: ${err.message}`);
        this.isRedisAvailable = false;
      });

      this.client.on('ready', () => {
        this.isRedisAvailable = true;
        this.logger.log(`Redis ready and operational (${redisUrl || `${host}:${port}`})`);
      });

      await this.client.connect();
      this.isRedisAvailable = true;
      this.logger.log(`Connected to Redis server at ${redisUrl || `${host}:${port}`}`);
    } catch (err: any) {
      this.logger.warn(`Redis initialization failed (${err.message}). Using in-memory fallback cache.`);
      this.isRedisAvailable = false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (e) {
        // Ignore disconnect errors on shutdown
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisAvailable && this.client) {
      try {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } catch (e: any) {
        this.logger.warn(`Redis get error for key ${key}: ${e.message}`);
      }
    }

    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return cached.value as T;
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch (e: any) {
        this.logger.warn(`Redis set error for key ${key}: ${e.message}`);
      }
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.del(key);
      } catch (e: any) {
        this.logger.warn(`Redis del error for key ${key}: ${e.message}`);
      }
    }
    this.memoryCache.delete(key);
    this.memorySets.delete(key);
    this.memoryHashes.delete(key);
  }

  // ─── Sets (presence, watchers) ────────────────────────────────────────────

  async sAdd(key: string, member: string, ttlSeconds = 300): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.sadd(key, member);
        await this.client.expire(key, ttlSeconds);
        return;
      } catch (e: any) {
        this.logger.warn(`Redis sAdd error for key ${key}: ${e.message}`);
      }
    }

    const now = Date.now();
    const existing = this.memorySets.get(key);
    const entry =
      existing && existing.expiresAt > now
        ? existing
        : { members: new Set<string>(), expiresAt: 0 };
    entry.members.add(member);
    entry.expiresAt = now + ttlSeconds * 1000;
    this.memorySets.set(key, entry);
  }

  async sRem(key: string, member: string): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.srem(key, member);
        return;
      } catch (e: any) {
        this.logger.warn(`Redis sRem error for key ${key}: ${e.message}`);
      }
    }

    const entry = this.memorySets.get(key);
    if (!entry) return;
    entry.members.delete(member);
    if (entry.members.size === 0) this.memorySets.delete(key);
  }

  async sMembers(key: string): Promise<string[]> {
    if (this.isRedisAvailable && this.client) {
      try {
        return await this.client.smembers(key);
      } catch (e: any) {
        this.logger.warn(`Redis sMembers error for key ${key}: ${e.message}`);
      }
    }

    const entry = this.memorySets.get(key);
    if (!entry) return [];
    if (Date.now() > entry.expiresAt) {
      this.memorySets.delete(key);
      return [];
    }
    return Array.from(entry.members);
  }

  async sCard(key: string): Promise<number> {
    if (this.isRedisAvailable && this.client) {
      try {
        return await this.client.scard(key);
      } catch (e: any) {
        this.logger.warn(`Redis sCard error for key ${key}: ${e.message}`);
      }
    }

    const entry = this.memorySets.get(key);
    if (!entry) return 0;
    if (Date.now() > entry.expiresAt) {
      this.memorySets.delete(key);
      return 0;
    }
    return entry.members.size;
  }

  // ─── Hashes (typing indicators) ───────────────────────────────────────────

  async hSet(key: string, field: string, value: string, ttlSeconds = 300): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.hset(key, field, value);
        await this.client.expire(key, ttlSeconds);
        return;
      } catch (e: any) {
        this.logger.warn(`Redis hSet error for key ${key}: ${e.message}`);
      }
    }

    const now = Date.now();
    const existing = this.memoryHashes.get(key);
    const entry =
      existing && existing.expiresAt > now
        ? existing
        : { fields: new Map<string, string>(), expiresAt: 0 };
    entry.fields.set(field, value);
    entry.expiresAt = now + ttlSeconds * 1000;
    this.memoryHashes.set(key, entry);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    if (this.isRedisAvailable && this.client) {
      try {
        return await this.client.hgetall(key);
      } catch (e: any) {
        this.logger.warn(`Redis hGetAll error for key ${key}: ${e.message}`);
      }
    }

    const entry = this.memoryHashes.get(key);
    if (!entry) return {};
    if (Date.now() > entry.expiresAt) {
      this.memoryHashes.delete(key);
      return {};
    }
    return Object.fromEntries(entry.fields);
  }

  async hDel(key: string, field: string): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.hdel(key, field);
        return;
      } catch (e: any) {
        this.logger.warn(`Redis hDel error for key ${key}: ${e.message}`);
      }
    }

    const entry = this.memoryHashes.get(key);
    if (!entry) return;
    entry.fields.delete(field);
    if (entry.fields.size === 0) this.memoryHashes.delete(key);
  }

  /** Atomic counter with a rolling TTL. Used for WebSocket rate limiting. */
  async incr(key: string, ttlSeconds = 60): Promise<number> {
    if (this.isRedisAvailable && this.client) {
      try {
        const value = await this.client.incr(key);
        if (value === 1) await this.client.expire(key, ttlSeconds);
        return value;
      } catch (e: any) {
        this.logger.warn(`Redis incr error for key ${key}: ${e.message}`);
      }
    }

    const now = Date.now();
    const cached = this.memoryCache.get(key);
    if (!cached || now > cached.expiresAt) {
      this.memoryCache.set(key, { value: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number(cached.value) + 1;
    this.memoryCache.set(key, { value: next, expiresAt: cached.expiresAt });
    return next;
  }

  /**
   * Atomically set a key only if it does not already exist (SET NX EX).
   * Used for distributed wallet locks.
   *
   * Financial safety: distributed locks MUST NOT fall back to in-memory —
   * an in-memory lock does not coordinate across instances and would allow
   * double-spend under horizontal scale. When Redis is unavailable this throws
   * 503, suspending balance-modifying operations rather than running unlocked.
   *
   * The single-process in-memory fallback is preserved ONLY in test mode
   * (NODE_ENV=test) so the suite runs without a Redis server.
   *
   * @returns true if the key was acquired, false if it already existed.
   */
  async setNx(key: string, value: any, ttlSeconds = 10): Promise<boolean> {
    if (!this.isRedisAvailable || !this.client) {
      if (process.env.NODE_ENV !== 'production') {
        const cached = this.memoryCache.get(key);
        if (cached && Date.now() < cached.expiresAt) {
          return false;
        }
        this.memoryCache.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
        return true;
      }
      throw new ServiceUnavailableException('Redis unavailable — wallet operations suspended');
    }

    try {
      const result = await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (e: any) {
      this.logger.warn(`Redis setNx error for key ${key}: ${e.message}`);
      if (process.env.NODE_ENV !== 'production') {
        const cached = this.memoryCache.get(key);
        if (cached && Date.now() < cached.expiresAt) {
          return false;
        }
        this.memoryCache.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
        return true;
      }
      throw new ServiceUnavailableException('Redis unavailable — wallet operations suspended');
    }
  }

  /** True when the real Redis connection is up. Used for fail-closed checks in prod. */
  isAvailable(): boolean {
    return this.isRedisAvailable && !!this.client;
  }

  /**
   * Remaining TTL for a key in seconds, or null when the key does not exist.
   * Falls back to the in-memory cache so OTP attempt-counters preserve expiry.
   */
  async ttl(key: string): Promise<number | null> {
    if (this.isRedisAvailable && this.client) {
      try {
        const seconds = await this.client.ttl(key);
        // -2 = no key, -1 = no expiry (should not happen — treat as missing).
        if (seconds >= 0) return seconds;
      } catch (e: any) {
        this.logger.warn(`Redis ttl error for key ${key}: ${e.message}`);
      }
    }

    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    const remainingMs = cached.expiresAt - Date.now();
    if (remainingMs <= 0) {
      this.memoryCache.delete(key);
      return null;
    }
    return Math.ceil(remainingMs / 1000);
  }

  /**
   * Atomically delete `key` only if it still holds `expected`.
   *
   * Locks must be released with this instead of a blind DEL: a holder whose lock
   * already expired must never delete the lock a *different* holder has since
   * acquired (that is how two writers end up inside the same critical section).
   *
   * @returns true when this caller owned the key and it was deleted.
   */
  async compareAndDelete(key: string, expected: any): Promise<boolean> {
    const expectedSerialized = JSON.stringify(expected);

    if (this.isRedisAvailable && this.client) {
      try {
        const result = await this.client.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          key,
          expectedSerialized,
        );
        return result === 1;
      } catch (e: any) {
        this.logger.warn(`Redis compareAndDelete error for key ${key}: ${e.message}`);
      }
    }

    const cached = this.memoryCache.get(key);
    if (cached && JSON.stringify(cached.value) === expectedSerialized) {
      this.memoryCache.delete(key);
      return true;
    }
    return false;
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.client.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100,
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await this.client.del(...keys);
          }
        } while (cursor !== '0');
      } catch (e: any) {
        this.logger.warn(`Redis delPattern error: ${e.message}`);
      }
    }

    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryCache.keys()) {
      if (regexPattern.test(key)) {
        this.memoryCache.delete(key);
      }
    }
  }
}
