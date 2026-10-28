import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';

/**
 * Distributed wallet lock via Redis SET NX.
 *
 * Guarantees that no two balance-modifying operations run concurrently on the
 * same wallet. Auto-expires after TTL seconds — a crashed consumer can never
 * deadlock a wallet permanently.
 *
 * The lock is *contention control*, not the source of truth for balance safety:
 * a TTL can lapse mid-operation. Correctness comes from the `SELECT ... FOR
 * UPDATE` row lock that callers take inside their database transaction. What
 * this lock adds is a "one writer at a time" gate, which keeps optimistic
 * validation (holds, limits) meaningful instead of racing.
 *
 * Every acquisition carries a unique token and is released with a
 * compare-and-delete, so a holder whose lease expired can never release (and
 * therefore let a third writer in while the second is still running).
 */
@Injectable()
export class WalletLockUtil {
  private readonly logger = new Logger(WalletLockUtil.name);
  private readonly ttlSeconds = 30; // auto-release prevents deadlock
  private readonly retryAttempts = 3;
  private readonly retryDelayMs = 20;

  constructor(private readonly redis: RedisService) {}

  async withLock<T>(walletId: string, fn: () => Promise<T>): Promise<T> {
    const key = `wallet:lock:${walletId}`;
    const token = randomUUID();

    let acquired = false;
    for (let attempt = 0; attempt < this.retryAttempts && !acquired; attempt += 1) {
      acquired = await this.redis.setNx(key, token, this.ttlSeconds);
      if (!acquired && attempt < this.retryAttempts - 1) {
        // Brief backoff: contention on one wallet is common (retries, bursts) and
        // a few milliseconds usually clears it. Never retry indefinitely.
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      }
    }

    if (!acquired) {
      throw new ConflictException('Wallet locked — retry in a moment');
    }

    try {
      return await fn();
    } finally {
      const released = await this.redis.compareAndDelete(key, token);
      if (!released) {
        // Not fatal: the DB row lock still protected the balance. But it means we
        // ran past our lease, which is worth knowing about.
        this.logger.warn(
          `Wallet lock for ${walletId} was already expired when released — the operation outran its ${this.ttlSeconds}s lease.`,
        );
      }
    }
  }
}
