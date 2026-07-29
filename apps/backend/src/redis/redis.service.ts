import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly memoryCache = new Map<string, { value: any; expiresAt: number }>();
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
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.isRedisAvailable && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
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
