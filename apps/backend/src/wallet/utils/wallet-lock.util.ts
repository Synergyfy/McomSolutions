import { Injectable, ConflictException } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Distributed wallet lock via Redis SETNX.
 *
 * Guarantees that no two balance-modifying operations run concurrently on the
 * same wallet. Auto-expires after TTL seconds — a crashed consumer can never
 * deadlock a wallet permanently.
 */
@Injectable()
export class WalletLockUtil {
  private readonly TTL = 10; // seconds — auto-release prevents deadlock

  constructor(private readonly redis: RedisService) {}

  async withLock<T>(walletId: string, fn: () => Promise<T>): Promise<T> {
    const key = `wallet:lock:${walletId}`;
    const acquired = await this.redis.setNx(key, '1', this.TTL);
    if (!acquired) {
      throw new ConflictException('Wallet locked — retry in a moment');
    }
    try {
      return await fn();
    } finally {
      await this.redis.del(key);
    }
  }
}