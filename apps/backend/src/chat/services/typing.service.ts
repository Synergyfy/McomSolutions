import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export interface TypingUser {
  userId: string;
  userName: string;
  expiresAt: number;
}

const TYPING_TTL_SECONDS = 15;

/**
 * Typing indicators.
 *
 * Local maps are the writer's index (used to clean up on disconnect); the
 * actual state is mirrored into a Redis hash so every instance sees the same
 * indicator. Entries carry their own `expiresAt` and are pruned on read.
 *
 * `RedisService` is optional so the service can be unit-tested standalone.
 */
@Injectable()
export class TypingService {
  // conversationId -> (userId -> TypingUser) — this process only
  private readonly conversationTyping = new Map<string, Map<string, TypingUser>>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  private key(conversationId: string): string {
    return `typing:${conversationId}`;
  }

  async startTyping(
    conversationId: string,
    userId: string,
    userName: string,
    ttlSeconds = 5,
  ): Promise<TypingUser[]> {
    let map = this.conversationTyping.get(conversationId);
    if (!map) {
      map = new Map();
      this.conversationTyping.set(conversationId, map);
    }
    map.set(userId, {
      userId,
      userName,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    if (this.redis) {
      await this.redis.hSet(
        this.key(conversationId),
        userId,
        JSON.stringify({ userId, userName, expiresAt: Date.now() + ttlSeconds * 1000 }),
        TYPING_TTL_SECONDS,
      );
    }

    return this.getTypingUsers(conversationId);
  }

  async stopTyping(conversationId: string, userId: string): Promise<TypingUser[]> {
    const map = this.conversationTyping.get(conversationId);
    if (map) {
      map.delete(userId);
      if (map.size === 0) this.conversationTyping.delete(conversationId);
    }
    if (this.redis) await this.redis.hDel(this.key(conversationId), userId);
    return this.getTypingUsers(conversationId);
  }

  async getTypingUsers(conversationId: string): Promise<TypingUser[]> {
    if (this.redis) {
      const raw = await this.redis.hGetAll(this.key(conversationId));
      const now = Date.now();
      const active: TypingUser[] = [];
      for (const [userId, value] of Object.entries(raw)) {
        try {
          const parsed = JSON.parse(value) as TypingUser;
          if (parsed.expiresAt > now) {
            active.push(parsed);
          } else {
            await this.redis.hDel(this.key(conversationId), userId);
          }
        } catch {
          await this.redis.hDel(this.key(conversationId), userId);
        }
      }
      return active;
    }

    return this.cleanAndGetTyping(conversationId);
  }

  async removeUserFromAll(userId: string): Promise<Map<string, TypingUser[]>> {
    const affected = new Map<string, TypingUser[]>();
    for (const [conversationId, map] of this.conversationTyping.entries()) {
      if (!map.has(userId)) continue;
      map.delete(userId);
      if (this.redis) await this.redis.hDel(this.key(conversationId), userId);
      if (map.size === 0) this.conversationTyping.delete(conversationId);
      affected.set(conversationId, await this.getTypingUsers(conversationId));
    }
    return affected;
  }

  private cleanAndGetTyping(conversationId: string): TypingUser[] {
    const map = this.conversationTyping.get(conversationId);
    if (!map) return [];

    const now = Date.now();
    for (const [uid, item] of map.entries()) {
      if (now > item.expiresAt) {
        map.delete(uid);
      }
    }

    if (map.size === 0) {
      this.conversationTyping.delete(conversationId);
      return [];
    }

    return Array.from(map.values());
  }
}
