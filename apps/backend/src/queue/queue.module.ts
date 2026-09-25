import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOK_DISPATCH_QUEUE, WEBHOOK_DISPATCH_DLQ } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl && redisUrl.trim() !== '') {
          try {
            const url = new URL(redisUrl.trim());
            return {
              connection: {
                host: url.hostname,
                port: parseInt(url.port || '6379', 10),
                username: url.username || undefined,
                password: url.password || undefined,
                tls: url.protocol === 'rediss:' ? {} : undefined,
                maxRetriesPerRequest: null,
              },
            };
          } catch {
            // Fall back to host/port
          }
        }

        const host = configService.get<string>('REDIS_HOST') || '127.0.0.1';
        const port = parseInt(configService.get<string>('REDIS_PORT') || '6379', 10);
        const password = configService.get<string>('REDIS_PASSWORD');

        return {
          connection: {
            host,
            port,
            password: password && password.trim() !== '' ? password.trim() : undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue(
      {
        name: WEBHOOK_DISPATCH_QUEUE,
      },
      {
        name: WEBHOOK_DISPATCH_DLQ,
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
