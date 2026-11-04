import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChatService } from './services/chat.service';
import { ChatSessionService } from './services/chat-session.service';
import { PresenceService } from './services/presence.service';
import { resolveChatSenderName } from './chat-sender-name.util';
import { TypingService } from './services/typing.service';
import { SendMessageDto, MarkReadDto } from './dto/chat.dto';
import { isChatOriginAllowed } from './chat-origins';

interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      userId: string;
      email: string;
      role: string;
      name: string;
      businessId: string | null;
    };
    /** Conversations joined by this socket — avoids a DB check on every keystroke. */
    conversations: Set<string>;
  };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isChatOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by chat CORS'));
    },
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  // Chat messages are small text payloads; cap the frame to avoid memory abuse.
  maxHttpBufferSize: 100_000,
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly chatService: ChatService,
    private readonly chatSessionService: ChatSessionService,
    private readonly presenceService: PresenceService,
    private readonly typingService: TypingService,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket Gateway initialized on namespace /chat');

    // Authenticate socket handshake synchronously before client connection fires
    this.server.use(async (socket, next) => {
      try {
        const token = this.extractToken(socket);
        if (!token) {
          return next(new Error('Unauthorized: Missing auth token'));
        }

        const decoded = this.jwtService.decode(token) as any;
        const jwtSecret = this.configService.get<string>('JWT_SECRET');

        let payload: any;
        if (decoded?.aud === 'chat:ws') {
          // Partner app token: verify audience/scope and consume its jti so it
          // can only ever be used for one handshake.
          payload = await this.chatSessionService.consumeSocketToken(token);
        } else {
          payload = this.jwtService.verify(token, { secret: jwtSecret });
        }

        const userId = payload.sub || payload.id;
        if (!userId) {
          return next(new Error('Unauthorized: Invalid token payload'));
        }

        const user = await this.prisma.user.findFirst({
          where: { id: userId, deletedAt: null },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            tokenVersion: true,
            businessProfile: { select: { id: true, businessName: true } },
          },
        });

        if (!user) {
          return next(new Error('Unauthorized: User not found or deleted'));
        }

        if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {
          return next(new Error('Unauthorized: Session revoked'));
        }

        const displayName =
          user.businessProfile?.businessName ||
          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
          user.email.split('@')[0];

        (socket as AuthenticatedSocket).data = {
          user: {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: displayName,
            businessId: user.businessProfile?.id || null,
          },
          conversations: new Set<string>(),
        };

        next();
      } catch (err: any) {
        next(new Error(`Unauthorized: ${err.message}`));
      }
    });
  }

  async handleConnection(client: Socket) {
    const user = (client as AuthenticatedSocket).data?.user;
    if (!user) {
      this.logger.warn(`Connection rejected (unauthenticated): socket ${client.id}`);
      client.disconnect();
      return;
    }

    try {
      // Join user-specific room for private push alerts & multi-tab coordination
      await client.join(`user:${user.userId}`);

      // Track multi-socket presence
      const wasOffline = await this.presenceService.addSocket(user.userId, client.id);
      if (wasOffline) {
        // Only users watching this person's presence get the update.
        this.server.to(`presence:${user.userId}`).emit('presence_update', {
          userId: user.userId,
          isOnline: true,
        });
      }

      this.logger.log(`Client connected: user ${user.userId} (${user.name}), socket ${client.id}`);

      // Acknowledge connection
      client.emit('connected', {
        status: 'CONNECTED',
        userId: user.userId,
        serverTime: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`Error on connection setup for socket ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const { userId, isNowOffline } = await this.presenceService.removeSocket(client.id);
    if (userId) {
      if (isNowOffline) {
        this.server.to(`presence:${userId}`).emit('presence_update', {
          userId,
          isOnline: false,
        });
      }

      // Cleanup any active typing indicators
      const affected = await this.typingService.removeUserFromAll(userId);
      for (const [convId, typingUsers] of affected.entries()) {
        this.server.to(`conversation:${convId}`).emit('typing_update', {
          conversationId: convId,
          typingUsers,
        });
      }

      this.logger.log(`Client disconnected: user ${userId}, socket ${client.id}`);
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    if (client.handshake.auth?.token) {
      const t = client.handshake.auth.token;
      return t.startsWith('Bearer ') ? t.substring(7) : t;
    }
    // Query-string tokens are deliberately NOT accepted: URLs leak into
    // access logs, browser history, referrers and proxy caches.
    return null;
  }

  /**
   * Per-user, cross-instance event budget. Returns false when the caller has
   * exceeded `limit` events in the rolling `windowSeconds`.
   */
  private async allowEvent(
    userId: string,
    action: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const count = await this.redis.incr(
      `rl:chat:${action}:${userId}`,
      windowSeconds,
    );
    return count <= limit;
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.user?.userId;
    if (!userId || !data?.conversationId) {
      return { success: false, error: 'Unauthorized or missing conversationId' };
    }

    if (!(await this.allowEvent(userId, 'join', 30, 60))) {
      return { success: false, error: 'Too many join attempts' };
    }

    // Verify authorized membership in database
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: data.conversationId,
          userId,
        },
      },
      include: { conversation: { select: { deletedAt: true } } },
    });

    if (!participant || participant.conversation.deletedAt) {
      return { success: false, error: 'Access denied: not a conversation participant' };
    }

    await client.join(`conversation:${data.conversationId}`);
    client.data.conversations?.add(data.conversationId);

    return {
      success: true,
      conversationId: data.conversationId,
      typingUsers: await this.typingService.getTypingUsers(data.conversationId),
    };
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
      const userId = client.data?.user?.userId;
      if (userId) {
        this.presenceService.clearConversationViewer(userId, data.conversationId);
        client.data.conversations?.delete(data.conversationId);
      }
      await client.leave(`conversation:${data.conversationId}`);
    }
    return { success: true };
  }

  /**
   * Subscribe to presence updates for specific users. Only users that share a
   * conversation are accepted, so presence is never broadcast platform-wide.
   */
  @SubscribeMessage('watch_presence')
  async handleWatchPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userIds: string[] },
  ) {
    const me = client.data?.user?.userId;
    if (!me) return { success: false, error: 'Unauthorized' };

    const requested = Array.from(
      new Set((data?.userIds || []).filter((id) => typeof id === 'string' && id && id !== me)),
    ).slice(0, 200);

    if (!requested.length) return { success: false, error: 'userIds is required' };

    // Build the set of users who share at least one conversation with me.
    const shared = await this.prisma.conversationParticipant.findMany({
      where: {
        userId: { in: requested },
        conversation: {
          deletedAt: null,
          participants: { some: { userId: me } },
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const allowed = new Set(shared.map((row) => row.userId));

    const online: Record<string, boolean> = {};
    for (const userId of allowed) {
      await client.join(`presence:${userId}`);
      online[userId] = await this.presenceService.isUserOnline(userId);
    }

    return { success: true, online, ignored: requested.filter((id) => !allowed.has(id)) };
  }

  @SubscribeMessage('unwatch_presence')
  async handleUnwatchPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userIds: string[] },
  ) {
    const me = client.data?.user?.userId;
    if (!me) return { success: false, error: 'Unauthorized' };
    for (const userId of Array.from(new Set(data?.userIds || []))) {
      if (typeof userId === 'string' && userId && userId !== me) {
        await client.leave(`presence:${userId}`);
      }
    }
    return { success: true };
  }

  @SubscribeMessage('viewing_conversation')
  handleViewingConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.user?.userId;
    if (userId && data?.conversationId) {
      this.presenceService.setConversationViewer(userId, data.conversationId, 30);
    }
    return { success: true };
  }

  @SubscribeMessage('stop_viewing_conversation')
  handleStopViewingConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.user?.userId;
    if (userId && data?.conversationId) {
      this.presenceService.clearConversationViewer(userId, data.conversationId);
    }
    return { success: true };
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = client.data?.user;
    if (!user || !data?.conversationId) return;

    // Membership is validated once on join — never hit the DB on a keystroke.
    if (!client.data.conversations?.has(data.conversationId)) {
      return { success: false, error: 'Join the conversation before typing' };
    }

    if (!(await this.allowEvent(user.userId, 'typing', 4, 2))) {
      return { success: true, throttled: true };
    }

    const typingUsers = await this.typingService.startTyping(
      data.conversationId,
      user.userId,
      user.name,
      5,
    );

    // Broadcast to conversation room (excluding sender)
    client.to(`conversation:${data.conversationId}`).emit('typing_update', {
      conversationId: data.conversationId,
      typingUsers,
    });
    return { success: true };
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = client.data?.user;
    if (!user || !data?.conversationId) return;

    if (!client.data.conversations?.has(data.conversationId)) {
      return { success: false, error: 'Join the conversation before typing' };
    }

    const typingUsers = await this.typingService.stopTyping(data.conversationId, user.userId);
    client.to(`conversation:${data.conversationId}`).emit('typing_update', {
      conversationId: data.conversationId,
      typingUsers,
    });
    return { success: true };
  }

  async broadcastNewMessage(
    conversationId: string,
    message: any,
    senderId: string,
    clientTempId?: string | null,
  ) {
    if (!this.server) return;

    // Broadcast new message to active conversation room
    this.server.to(`conversation:${conversationId}`).emit('new_message', {
      ...message,
      clientTempId: clientTempId || null,
    });

    // Clear sender's typing indicator in room
    const typingUsers = await this.typingService.stopTyping(conversationId, senderId);
    this.server.to(`conversation:${conversationId}`).emit('typing_update', {
      conversationId,
      typingUsers,
    });

    // Also notify all conversation members' personal rooms to update their inbox previews & badges
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    // REST sends carry the already-formatted response (`senderName`) while the
    // socket path passes the Prisma message (`sender`). Prefer the formatted
    // name so cross-app messages never fall back to "Someone".
    const senderName = resolveChatSenderName(message);

    for (const p of participants) {
      this.server.to(`user:${p.userId}`).emit('inbox_update', {
        conversationId,
        lastMessageText: message.content,
        lastMessageAt: message.createdAt,
        lastMessageSenderId: senderId,
      });

      // Deliver instant in-app notification toast to other participants
      if (p.userId !== senderId) {
        this.server.to(`user:${p.userId}`).emit('chat_notification', {
          type: 'NEW_MESSAGE',
          conversationId,
          messageId: message.id,
          senderId,
          senderName,
          content: message.content,
          createdAt: message.createdAt,
        });
      }
    }
  }

  /**
   * Helper to push direct real-time notification to a specific user
   */
  notifyUser(userId: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, data);
  }

  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const user = client.data?.user;
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!(await this.allowEvent(user.userId, 'send', 20, 10))) {
      return { success: false, error: 'You are sending messages too quickly' };
    }

    try {
      const message = await this.chatService.sendMessage(user.userId, dto);

      await this.broadcastNewMessage(
        dto.conversationId,
        message,
        user.userId,
        dto.idempotencyKey,
      );

      // Return durable persistence acknowledgement to sender
      return {
        success: true,
        message,
        clientTempId: dto.idempotencyKey || null,
      };
    } catch (err: any) {
      this.logger.error(`send_message error: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: MarkReadDto,
  ) {
    const user = client.data?.user;
    if (!user) return { success: false, error: 'Unauthorized' };

    try {
      const result = await this.chatService.markAsRead(
        user.userId,
        dto.conversationId,
        dto.messageIds,
      );

      if (result.markedCount > 0) {
        // Broadcast read receipt event to conversation participants
        this.server.to(`conversation:${dto.conversationId}`).emit('messages_read', {
          conversationId: dto.conversationId,
          readerUserId: user.userId,
          readerName: user.name,
          readMessageIds: result.readMessageIds,
          readAt: result.readAt,
        });
      }

      return { success: true, count: result.markedCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * For session revocation, logout, or password change: forcefully disconnect all sockets for a user
   */
  async disconnectUserSockets(userId: string) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).disconnectSockets(true);
    this.logger.log(`Disconnected all sockets for user ${userId} due to session revocation/logout`);
  }
}
