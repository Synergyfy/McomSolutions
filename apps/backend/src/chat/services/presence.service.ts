import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  // Map of userId -> Set of connected socket IDs
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

    // Update presence in Redis / cache with 2-minute lease
    await this.redisService.set(`presence:user:${userId}`, { online: true, count: sockets.size }, 120);

    return wasOffline;
  }

  async removeSocket(socketId: string): Promise<{ userId: string | null; isNowOffline: boolean }> {
    const userId = this.socketUsers.get(socketId);
    if (!userId) {
      return { userId: null, isNowOffline: false };
    }

    this.socketUsers.delete(socketId);
    const sockets = this.userSockets.get(userId);

    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        await this.redisService.del(`presence:user:${userId}`);
        return { userId, isNowOffline: true };
      } else {
        await this.redisService.set(`presence:user:${userId}`, { online: true, count: sockets.size }, 120);
        return { userId, isNowOffline: false };
      }
    }

    return { userId, isNowOffline: true };
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  getUserSocketIds(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  getOnlineUsers(userIds: string[]): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const uid of userIds) {
      result[uid] = this.isUserOnline(uid);
    }
    return result;
  }

  // Active focused conversation viewers: userId:conversationId -> expiresAt timestamp
  private readonly conversationViewers = new Map<string, number>();

  setConversationViewer(userId: string, conversationId: string, ttlSeconds = 30): void {
    const key = `${userId}:${conversationId}`;
    this.conversationViewers.set(key, Date.now() + ttlSeconds * 1000);
  }

  clearConversationViewer(userId: string, conversationId: string): void {
    const key = `${userId}:${conversationId}`;
    this.conversationViewers.delete(key);
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
