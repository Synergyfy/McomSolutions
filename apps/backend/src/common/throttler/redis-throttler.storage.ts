import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

interface HitRecord {
  hits: { expiresAt: number }[];
  blockedUntil: number;
}

/**
 * Phase 3 (G4): Redis-backed throttler storage so rate limits hold across
 * instances. Falls back to an in-memory map when Redis is unavailable
 * (single-instance dev/test) — never fails open, just scopes the budget
 * per-instance with a warn log.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memory = new Map<string, HitRecord>();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    // NOTE: @nestjs/throttler v6 passes ttl/blockDuration in MILLISECONDS.
    // Do not multiply by 1000 here — only the Redis key expiry (seconds)
    // needs a ms→s conversion at save() time.
    const ttlMs = ttl;
    const storageKey = `throttle:${key}`;

    let record = await this.load(storageKey);
    if (!record) record = { hits: [], blockedUntil: 0 };

    // Drop expired hits outside the window.
    record.hits = record.hits.filter((h) => h.expiresAt > now);

    if (record.blockedUntil > now) {
      return this.toResult(record, now);
    }

    record.hits.push({ expiresAt: now + ttlMs });
    if (record.hits.length > limit) {
      record.blockedUntil = now + blockDuration;
      this.logger.warn(`[Throttle] ${key} exceeded ${limit}/${ttl}ms — blocked for ${blockDuration}ms`);
    }

    // Redis EX takes seconds — convert from ms (min 1s so the key expires).
    await this.save(storageKey, record, Math.max(1, Math.ceil(Math.max(ttl, blockDuration) / 1000)));
    return this.toResult(record, now);
  }

  private toResult(record: HitRecord, now: number): ThrottlerStorageRecord {
    const timeToExpire = record.hits.length
      ? Math.max(0, Math.ceil((Math.max(...record.hits.map((h) => h.expiresAt)) - now) / 1000))
      : 0;
    const isBlocked = record.blockedUntil > now;
    return {
      totalHits: record.hits.length,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil((record.blockedUntil - now) / 1000) : 0,
    };
  }

  private async load(key: string): Promise<HitRecord | null> {
    try {
      const cached = await this.redis.get<HitRecord>(key);
      if (cached) return cached;
    } catch {
      // Fall through to memory on Redis errors.
    }
    const mem = this.memory.get(key);
    if (!mem) return null;
    if (mem.hits.every((h) => h.expiresAt <= Date.now()) && mem.blockedUntil <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return mem;
  }

  private async save(key: string, record: HitRecord, ttlSeconds: number): Promise<void> {
    this.memory.set(key, record);
    try {
      await this.redis.set(key, record, ttlSeconds);
    } catch {
      this.logger.warn('[Throttle] Redis unavailable — using per-instance in-memory budget');
    }
  }
}
