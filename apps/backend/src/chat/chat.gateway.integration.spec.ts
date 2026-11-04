import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './services/chat.service';
import { ChatSessionService } from './services/chat-session.service';
import { PresenceService } from './services/presence.service';
import { TypingService } from './services/typing.service';

const SECRET = 'gateway-integration-secret';

describe('ChatGateway socket integration', () => {
  let app: INestApplication;
  let port: number;
  let sendMessage: jest.Mock;

  beforeAll(async () => {
    sendMessage = jest.fn().mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: 'hello',
      createdAt: new Date().toISOString(),
      sender: { email: 'agent@example.com', firstName: 'A', lastName: 'B' },
    });

    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'agent@example.com',
          firstName: 'A',
          lastName: 'B',
          role: 'AGENT',
          tokenVersion: 0,
          businessProfile: null,
        }),
      },
      conversationParticipant: {
        findUnique: jest.fn().mockResolvedValue({
          conversationId: 'conv-1',
          userId: 'user-1',
          conversation: { deletedAt: null },
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]),
      },
      conversation: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: JwtService, useValue: new JwtService({ secret: SECRET }) },
        { provide: ConfigService, useValue: { get: () => SECRET } },
        { provide: PrismaService, useValue: prisma },
        {
          provide: RedisService,
          useValue: { incr: jest.fn().mockResolvedValue(1) },
        },
        { provide: ChatService, useValue: { sendMessage, markAsRead: jest.fn() } },
        {
          provide: ChatSessionService,
          useValue: { consumeSocketToken: jest.fn() },
        },
        {
          provide: PresenceService,
          useValue: {
            addSocket: jest.fn().mockResolvedValue(true),
            removeSocket: jest
              .fn()
              .mockResolvedValue({ userId: 'user-1', isNowOffline: true }),
            isUserOnline: jest.fn().mockResolvedValue(true),
          },
        },
        { provide: TypingService, useValue: new TypingService() },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    port = (app.getHttpServer().address() as any).port;
  });

  afterAll(async () => {
    await app.close();
  });

  function connect(token?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`http://127.0.0.1:${port}/chat`, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Timed out waiting for socket connection'));
      }, 5000);
      socket.on('connected', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.on('connect_error', (error) => {
        clearTimeout(timer);
        socket.disconnect();
        reject(error);
      });
    });
  }

  it('authenticates, joins a conversation and round-trips a message', async () => {
    const token = new JwtService({ secret: SECRET }).sign({
      sub: 'user-1',
      tv: 0,
    });
    const socket = await connect(token);

    const joined: any = await new Promise((resolve) =>
      socket.emit('join_conversation', { conversationId: 'conv-1' }, resolve),
    );
    expect(joined).toMatchObject({ success: true, conversationId: 'conv-1' });

    const incoming = new Promise<any>((resolve) => socket.once('new_message', resolve));
    const ack: any = await new Promise((resolve) =>
      socket.emit('send_message', { conversationId: 'conv-1', content: 'hello' }, resolve),
    );
    expect(ack.success).toBe(true);
    expect(ack.message.id).toBe('msg-1');

    const broadcast = await incoming;
    expect(broadcast).toMatchObject({ id: 'msg-1', conversationId: 'conv-1' });
    expect(sendMessage).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ conversationId: 'conv-1', content: 'hello' }),
    );

    socket.disconnect();
  });

  it('rejects a handshake without a token', async () => {
    await expect(connect()).rejects.toBeTruthy();
  });
});
