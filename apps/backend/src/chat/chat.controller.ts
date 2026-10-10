import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './services/chat.service';
import { PushNotificationService } from './services/push-notification.service';
import { ChatGateway } from './chat.gateway';
import {
  CreateDirectConversationDto,
  CreateGroupConversationDto,
  SendMessageDto,
  HttpSendMessageDto,
  MarkReadDto,
  AddParticipantDto,
  MuteConversationDto,
  PushSubscriptionDto,
} from './dto/chat.dto';

@ApiTags('Chat & Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly pushService: PushNotificationService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations for the authenticated user' })
  @ApiOkResponse({ description: 'Conversations with unread counts and last messages' })
  async getConversations(@Request() req: any) {
    return this.chatService.getConversations(req.user.userId);
  }

  @Post('conversations/direct')
  @ApiOperation({ summary: 'Get or create canonical 1-on-1 direct conversation' })
  async getOrCreateDirect(
    @Request() req: any,
    @Body() dto: CreateDirectConversationDto,
  ) {
    return this.chatService.getOrCreateDirectConversation(
      req.user.userId,
      dto.targetUserId,
    );
  }

  @Post('conversations/group')
  @ApiOperation({ summary: 'Create a new group conversation' })
  async createGroup(
    @Request() req: any,
    @Body() dto: CreateGroupConversationDto,
  ) {
    return this.chatService.createGroupConversation(req.user.userId, dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get details for a specific conversation' })
  async getConversation(
    @Request() req: any,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.getConversation(req.user.userId, conversationId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get cursor-paginated messages for a conversation' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Message ID cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of messages to load (max 100)' })
  async getMessages(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.chatService.getMessages(
      req.user.userId,
      conversationId,
      cursor,
      parsedLimit,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message via HTTP fallback' })
  async sendMessage(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Body() body: HttpSendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(req.user.userId, {
      ...body,
      conversationId,
    });

    await this.chatGateway.broadcastNewMessage(
      conversationId,
      message,
      req.user.userId,
      body.idempotencyKey,
    );

    return message;
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark messages in a conversation as read' })
  async markAsRead(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Body() body: { messageIds?: string[] },
  ) {
    return this.chatService.markAsRead(
      req.user.userId,
      conversationId,
      body.messageIds,
    );
  }

  @Get('messages/:messageId/receipts')
  @ApiOperation({ summary: 'Get group read-receipts breakdown: Seen by X of Y' })
  async getMessageReceipts(
    @Request() req: any,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.getMessageReceipts(req.user.userId, messageId);
  }

  @Post('conversations/:id/participants')
  @ApiOperation({ summary: 'Add a participant to a group conversation' })
  async addParticipant(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.chatService.addParticipant(
      req.user.userId,
      conversationId,
      dto.userId,
    );
  }

  @Delete('conversations/:id/participants/:targetUserId')
  @ApiOperation({ summary: 'Remove a participant from a group or leave group' })
  async removeParticipant(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.chatService.removeParticipant(
      req.user.userId,
      conversationId,
      targetUserId,
    );
  }

  @Post('conversations/:id/mute')
  @ApiOperation({ summary: 'Mute or unmute conversation notifications' })
  async muteConversation(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Body() dto: MuteConversationDto,
  ) {
    return this.chatService.muteConversation(
      req.user.userId,
      conversationId,
      dto.isMuted,
    );
  }

  @Get('users')
  @ApiOperation({ summary: 'Directory search across all user roles (Business, Customer, Admin, etc.)' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  async searchUsers(
    @Request() req: any,
    @Query('q') query?: string,
  ) {
    return this.chatService.searchUsers(query || '', req.user.userId);
  }

  @Get('push/vapid-key')
  @ApiOperation({ summary: 'Get VAPID public key for Web Push subscription registration' })
  async getVapidPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('push/subscribe')
  @ApiOperation({ summary: 'Register a Web Push device/browser subscription' })
  async subscribePush(
    @Request() req: any,
    @Body() dto: PushSubscriptionDto,
  ) {
    await this.pushService.saveSubscription(req.user.userId, dto);
    return { success: true };
  }

  @Delete('push/unsubscribe')
  @ApiOperation({ summary: 'Unregister a Web Push subscription on logout or preference disable' })
  async unsubscribePush(
    @Request() req: any,
    @Body() body: { endpoint: string },
  ) {
    await this.pushService.removeSubscription(req.user.userId, body.endpoint);
    return { success: true };
  }

  // ─── MESSAGE REQUESTS & BLOCKING ENDPOINTS ────────────────────────────────

  @Get('requests')
  @ApiOperation({ summary: 'Get incoming, outgoing, and rejected message requests' })
  async getMessageRequests(@Request() req: any) {
    return this.chatService.getMessageRequests(req.user.userId);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Send or retry a message request to another user' })
  async sendMessageRequest(
    @Request() req: any,
    @Body() dto: { receiverId: string; message?: string },
  ) {
    const res = await this.chatService.sendMessageRequest(req.user.userId, dto);

    // Notify receiver in real-time
    const senderName = (res as any).senderName || req.user.name || req.user.email?.split('@')[0] || 'Someone';

    this.chatGateway.notifyUser(dto.receiverId, 'chat_notification', {
      type: 'MESSAGE_REQUEST',
      requestId: res.id,
      senderId: req.user.userId,
      senderName,
      message: dto.message?.trim() || null,
      status: res.status,
      conversationId: (res as any).conversationId || null,
      createdAt: new Date().toISOString(),
    });

    return res;
  }

  @Post('requests/:id/respond')
  @ApiOperation({ summary: 'Accept or reject an incoming message request' })
  async respondMessageRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body() dto: { action: 'ACCEPT' | 'REJECT' },
  ) {
    const res = await this.chatService.respondMessageRequest(req.user.userId, requestId, dto);

    if (res.status === 'ACCEPTED' && (res as any).conversationId && (res as any).senderId) {
      this.chatGateway.notifyUser((res as any).senderId, 'chat_notification', {
        type: 'REQUEST_ACCEPTED',
        conversationId: (res as any).conversationId,
        responderId: req.user.userId,
        responderName: (res as any).receiverName || req.user.name || 'Someone',
        createdAt: new Date().toISOString(),
      });
    }

    return res;
  }

  @Post('requests/reset/:senderId')
  @ApiOperation({ summary: 'Reset rejection for a sender to allow them to request again' })
  async resetRejectedRequest(
    @Request() req: any,
    @Param('senderId') senderId: string,
  ) {
    return this.chatService.resetRejectedRequest(req.user.userId, senderId);
  }

  @Post('block')
  @ApiOperation({ summary: 'Block a user from sending messages or requests' })
  async blockUser(
    @Request() req: any,
    @Body() dto: { targetUserId: string },
  ) {
    return this.chatService.blockUser(req.user.userId, dto.targetUserId);
  }

  @Post('unblock')
  @ApiOperation({ summary: 'Unblock a previously blocked user' })
  async unblockUser(
    @Request() req: any,
    @Body() dto: { targetUserId: string },
  ) {
    return this.chatService.unblockUser(req.user.userId, dto.targetUserId);
  }

  @Get('blocked')
  @ApiOperation({ summary: 'List all blocked users' })
  async getBlockedUsers(@Request() req: any) {
    return this.chatService.getBlockedUsers(req.user.userId);
  }
}
