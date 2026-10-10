import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { PresenceService } from './services/presence.service';
import { TypingService } from './services/typing.service';
import { PushNotificationService } from './services/push-notification.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    PresenceService,
    TypingService,
    PushNotificationService,
  ],
  exports: [
    ChatService,
    PresenceService,
    PushNotificationService,
    ChatGateway,
  ],
})
export class ChatModule {}
