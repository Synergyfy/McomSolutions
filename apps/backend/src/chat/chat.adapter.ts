import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { RedisOptions } from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter backed by Redis pub/sub.
 *
 * With this adapter every instance can broadcast to rooms (users,
 * conversations, presence watchers) held on other instances — no sticky
 * sessions and no direct instance-to-instance calls.
 *
 * Development / single-VPS behaviour:
 *  - If Redis is unreachable we keep the default in-memory adapter and log a
 *    warning, so chat still works on one process.
 *  - In production we fail startup instead of silently running a half-scaled
 *    deployment that drops cross-node events.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly wsLogger = new Logger(RedisIoAdapter.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_REDIS_SOCKET_ADAPTER === 'true') {
      this.wsLogger.log('Redis Socket.IO adapter disabled (test/opt-out) — using in-memory adapter.');
      return;
    }

    const redisUrl = this.config.get<string>('REDIS_URL')?.trim();
    const host = this.config.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = parseInt(this.config.get<string>('REDIS_PORT') || '6379', 10);
    const password = this.config.get<string>('REDIS_PASSWORD')?.trim();

    const options: RedisOptions = {
      host,
      port,
      lazyConnect: true,
      // The adapter owns long-lived clients; let ioredis retry forever.
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      connectTimeout: 3000,
    };
    if (password) options.password = password;

    try {
      this.pubClient = redisUrl
        ? new Redis(redisUrl, { ...options, lazyConnect: true })
        : new Redis(options);
      this.subClient = this.pubClient.duplicate();

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      this.wsLogger.log(
        `Redis Socket.IO adapter connected (${redisUrl || `${host}:${port}`}).`,
      );
    } catch (err: any) {
      this.wsLogger.warn(`Redis Socket.IO adapter unavailable: ${err?.message}`);
      await this.disposeClients();

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Redis is required for the Socket.IO adapter in production. ' +
            'Refusing to start with an in-memory adapter that cannot fan out across instances.',
        );
      }
      this.wsLogger.warn('Falling back to the in-memory Socket.IO adapter (single instance only).');
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async close(): Promise<void> {
    await this.disposeClients();
  }

  private async disposeClients(): Promise<void> {
    for (const client of [this.pubClient, this.subClient]) {
      if (!client) continue;
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }
    this.pubClient = null;
    this.subClient = null;
    this.adapterConstructor = null;
  }
}
