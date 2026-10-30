import { ConflictException } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { WalletLockUtil } from './wallet-lock.util';

describe('WalletLockUtil', () => {
  let util: WalletLockUtil;
  let redis: any;

  beforeEach(() => {
    redis = {
      setNx: jest.fn().mockResolvedValue(true),
      compareAndDelete: jest.fn().mockResolvedValue(true),
      del: jest.fn(),
    };
    util = new WalletLockUtil(redis as unknown as RedisService);
  });

  it('releases with the acquisition token — never a blind delete', async () => {
    await util.withLock('w1', async () => 42);

    expect(redis.setNx).toHaveBeenCalledWith('wallet:lock:w1', expect.any(String), 30);
    const token = redis.setNx.mock.calls[0][1];
    expect(redis.compareAndDelete).toHaveBeenCalledWith('wallet:lock:w1', token);
    // A blind DEL could delete a lock acquired by someone else after our lease
    // expired, letting two writers into the same critical section.
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('uses a distinct token for every acquisition', async () => {
    await util.withLock('w1', async () => 1);
    await util.withLock('w1', async () => 2);

    const [first, second] = redis.setNx.mock.calls.map((call: any[]) => call[1]);
    expect(first).not.toBe(second);
  });

  it('retries a bounded number of times, then throws 409', async () => {
    redis.setNx.mockResolvedValue(false);

    await expect(util.withLock('w1', async () => 1)).rejects.toThrow(ConflictException);
    expect(redis.setNx).toHaveBeenCalledTimes(3);
    expect(redis.compareAndDelete).not.toHaveBeenCalled();
  });

  it('succeeds on a retry once the contention clears', async () => {
    redis.setNx.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(util.withLock('w1', async () => 'ok')).resolves.toBe('ok');
    expect(redis.setNx).toHaveBeenCalledTimes(2);
  });

  it('releases the lock when the body throws', async () => {
    await expect(
      util.withLock('w1', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(redis.compareAndDelete).toHaveBeenCalled();
  });

  it('does not fail the operation when the lease expired before release', async () => {
    redis.compareAndDelete.mockResolvedValue(false);

    await expect(util.withLock('w1', async () => 'ok')).resolves.toBe('ok');
  });
});
