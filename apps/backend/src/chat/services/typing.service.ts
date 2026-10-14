import { Injectable } from '@nestjs/common';

export interface TypingUser {
  userId: string;
  userName: string;
  expiresAt: number;
}

@Injectable()
export class TypingService {
  // conversationId -> (userId -> TypingUser)
  private readonly conversationTyping = new Map<string, Map<string, TypingUser>>();

  startTyping(conversationId: string, userId: string, userName: string, ttlSeconds = 5): TypingUser[] {
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

    return this.cleanAndGetTyping(conversationId);
  }

  stopTyping(conversationId: string, userId: string): TypingUser[] {
    const map = this.conversationTyping.get(conversationId);
    if (map) {
      map.delete(userId);
      if (map.size === 0) {
        this.conversationTyping.delete(conversationId);
      }
    }
    return this.cleanAndGetTyping(conversationId);
  }

  getTypingUsers(conversationId: string): TypingUser[] {
    return this.cleanAndGetTyping(conversationId);
  }

  removeUserFromAll(userId: string): Map<string, TypingUser[]> {
    const affected = new Map<string, TypingUser[]>();
    for (const [conversationId, map] of this.conversationTyping.entries()) {
      if (map.has(userId)) {
        map.delete(userId);
        affected.set(conversationId, this.cleanAndGetTyping(conversationId));
      }
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
