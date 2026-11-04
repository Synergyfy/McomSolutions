import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { QueueModule } from '../queue/queue.module';
import { CHAT_OUTBOX_QUEUE } from '../queue/queue.constants';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatSessionController } from './chat-session.controller';
import { ChatOutboxProcessor } from './chat-outbox.processor';
import { ChatService } from './services/chat.service';
import { ChatSessionService } from './services/chat-session.service';
import { ChatOutboxService } from './services/chat-outbox.service';
import { PresenceService } from './services/presence.service';
import { TypingService } from './services/typing.service';
import { PushNotificationService } from './services/push-notification.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ConfigModule,
    QueueModule,
    BullModule.registerQueue({ name: CHAT_OUTBOX_QUEUE }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [ChatController, ChatSessionController],
  providers: [
    ChatGateway,
    ChatOutboxProcessor,
    ChatService,
    ChatSessionService,
    ChatOutboxService,
    PresenceService,
    TypingService,
    PushNotificationService,
  ],
  exports: [
    ChatService,
    ChatSessionService,
    ChatOutboxService,
    PresenceService,
    PushNotificationService,
    ChatGateway,
  ],
})
export class ChatModule {}
