import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const PRESENCE_TTL_SECONDS = 150;
const PRESENCE_KEY_PREFIX = 'presence:user:';

/**
 * Multi-socket presence, backed by Redis sets so every instance sees the same
 * online state. Local maps are kept as a fast path and to resolve a socket's
 * user on disconnect without a Redis round-trip.
 *
 * Keys carry a TTL and are refreshed on every connect/disconnect. If a node
 * crashes, its sockets disappear automatically once the lease expires — no
 * cron cleanup and no permanently "online" ghosts.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  // Map of userId -> Set of connected socket IDs (this process only)
  private readonly userSockets = new Map<string, Set<string>>();
  // Reverse lookup: socketId -> userId
  private readonly socketUsers = new Map<string, string>();

  constructor(private readonly redisService: RedisService) {}

  async addSocket(userId: string, socketId: string): Promise<boolean> {
    this.socketUsers.set(socketId, userId);
    let sockets = this.userSockets.get(userId);
    const wasOffline = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socketId);

    await this.redisService.sAdd(
      `${PRESENCE_KEY_PREFIX}${userId}`,
      socketId,
      PRESENCE_TTL_SECONDS,
    );

    return wasOffline;
  }

  async removeSocket(
    socketId: string,
  ): Promise<{ userId: string | null; isNowOffline: boolean }> {
    const userId = this.socketUsers.get(socketId);
    if (!userId) {
      return { userId: null, isNowOffline: false };
    }

    this.socketUsers.delete(socketId);
    await this.redisService.sRem(`${PRESENCE_KEY_PREFIX}${userId}`, socketId);

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    const remaining = await this.redisService.sCard(`${PRESENCE_KEY_PREFIX}${userId}`);
    const isNowOffline = remaining === 0;
    if (isNowOffline) {
      await this.redisService.del(`${PRESENCE_KEY_PREFIX}${userId}`);
    }

    return { userId, isNowOffline };
  }

  async isUserOnline(userId: string): Promise<boolean> {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) return true;
    return (await this.redisService.sCard(`${PRESENCE_KEY_PREFIX}${userId}`)) > 0;
  }

  async areUsersOnline(userIds: string[]): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    await Promise.all(
      userIds.map(async (userId) => {
        result[userId] = await this.isUserOnline(userId);
      }),
    );
    return result;
  }

  /** Synchronous local lookup (this process only) — for hot paths/diagnostics. */
  getUserSocketIds(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  // Active focused conversation viewers: userId:conversationId -> expiresAt timestamp
  private readonly conversationViewers = new Map<string, number>();

  private viewerKey(userId: string, conversationId: string): string {
    return `presence:viewing:${userId}:${conversationId}`;
  }

  setConversationViewer(userId: string, conversationId: string, ttlSeconds = 30): void {
    const key = `${userId}:${conversationId}`;
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.conversationViewers.set(key, expiresAt);
    // Mirror to Redis so an outbox worker on another instance can suppress
    // push notifications for a conversation the user is actively viewing.
    void this.redisService
      .set(this.viewerKey(userId, conversationId), { at: expiresAt }, ttlSeconds)
      .catch(() => undefined);
  }

  clearConversationViewer(userId: string, conversationId: string): void {
    const key = `${userId}:${conversationId}`;
    this.conversationViewers.delete(key);
    void this.redisService
      .del(this.viewerKey(userId, conversationId))
      .catch(() => undefined);
  }

  /** Cross-instance viewer check for background workers. */
  async isViewingConversationAsync(userId: string, conversationId: string): Promise<boolean> {
    if (this.isViewingConversation(userId, conversationId)) return true;
    const remote = await this.redisService.get<{ at: number }>(
      this.viewerKey(userId, conversationId),
    );
    return Boolean(remote && remote.at > Date.now());
  }

  isViewingConversation(userId: string, conversationId: string): boolean {
    const key = `${userId}:${conversationId}`;
    const expiresAt = this.conversationViewers.get(key);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.conversationViewers.delete(key);
      return false;
    }
    return true;
  }
}
