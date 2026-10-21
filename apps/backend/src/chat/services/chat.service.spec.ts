import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from './presence.service';
import { PushNotificationService } from './push-notification.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let presenceService: any;
  let pushService: any;

  beforeEach(async () => {
    prisma = {
      conversation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationParticipant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      messageReadReceipt: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      chatBlock: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      chatMessageRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      chatOutbox: {
        create: jest.fn(),
      },
      notification: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    presenceService = {
      isUserOnline: jest.fn().mockReturnValue(true),
    };

    pushService = {
      sendPushToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: PresenceService, useValue: presenceService },
        { provide: PushNotificationService, useValue: pushService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('getOrCreateDirectConversation', () => {
    it('should disallow starting a conversation with oneself', async () => {
      await expect(service.getOrCreateDirectConversation('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if target user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getOrCreateDirectConversation('user-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create a canonical direct conversation with sorted directKey if none exists', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-2', email: 'u2@example.com', role: 'ADMIN' });
      prisma.conversation.findUnique.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue({
        id: 'conv-123',
        type: 'DIRECT',
        directKey: 'user-1:user-2',
      });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'cp-1',
        conversationId: 'conv-123',
        userId: 'user-1',
        role: 'ADMIN',
        conversation: {
          id: 'conv-123',
          type: 'DIRECT',
          directKey: 'user-1:user-2',
          participants: [
            { userId: 'user-1', user: { id: 'user-1', email: 'u1@example.com' } },
            { userId: 'user-2', user: { id: 'user-2', email: 'u2@example.com' } },
          ],
        },
      });

      const result = await service.getOrCreateDirectConversation('user-1', 'user-2');
      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            directKey: 'user-1:user-2',
            type: 'DIRECT',
          }),
        }),
      );
      expect(result.id).toBe('conv-123');
    });
  });

  describe('sendMessage and idempotency', () => {
    it('should return existing message if idempotency key matches', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'cp-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        conversation: { id: 'conv-1', participants: [] },
      });
      prisma.message.findFirst.mockResolvedValue({
        id: 'msg-existing',
        conversationId: 'conv-1',
        idempotencyKey: 'idem-1',
        content: 'Hello world',
        createdAt: new Date(),
        sender: { id: 'user-1', email: 'user1@example.com' },
      });

      const result = await service.sendMessage('user-1', {
        conversationId: 'conv-1',
        content: 'Hello world',
        idempotencyKey: 'idem-1',
      });

      expect(result.id).toBe('msg-existing');
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('should persist new message and update read cursor when valid', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'cp-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        user: { id: 'user-1', email: 'user1@test.com' },
        conversation: { id: 'conv-1', type: 'DIRECT', participants: [{ userId: 'user-1', isMuted: false }] },
      });
      prisma.message.findFirst.mockResolvedValue(null);
      prisma.message.create.mockResolvedValue({
        id: 'msg-new',
        conversationId: 'conv-1',
        content: 'Brand new message',
        senderId: 'user-1',
        type: 'TEXT',
        createdAt: new Date(),
        sender: { id: 'user-1', email: 'user1@test.com' },
      });

      const result = await service.sendMessage('user-1', {
        conversationId: 'conv-1',
        content: 'Brand new message',
        idempotencyKey: 'new-key',
      });

      expect(result.id).toBe('msg-new');
      expect(prisma.conversation.update).toHaveBeenCalled();
      expect(prisma.messageReadReceipt.create).toHaveBeenCalled();
      expect(prisma.chatOutbox.create).toHaveBeenCalled();
    });
  });

  describe('markAsRead and group receipts', () => {
    it('should record read receipts and update participant cursor', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'cp-2',
        conversationId: 'conv-1',
        userId: 'user-2',
      });
      prisma.message.findMany.mockResolvedValue([
        { id: 'msg-1', createdAt: new Date() },
        { id: 'msg-2', createdAt: new Date() },
      ]);

      const result = await service.markAsRead('user-2', 'conv-1');
      expect(result.markedCount).toBe(2);
      expect(prisma.messageReadReceipt.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ messageId: 'msg-1', userId: 'user-2' }),
          expect.objectContaining({ messageId: 'msg-2', userId: 'user-2' }),
        ]),
        skipDuplicates: true,
      });
      expect(prisma.conversationParticipant.update).toHaveBeenCalled();
    });

    it('should return Seen by X of Y breakdown for a message', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        conversation: {
          participants: [
            { userId: 'user-1', user: { email: 'u1@test.com', role: 'BUSINESS' } },
            { userId: 'user-2', user: { email: 'u2@test.com', role: 'CUSTOMER' } },
            { userId: 'user-3', user: { email: 'u3@test.com', role: 'ADMIN' } },
          ],
        },
        readReceipts: [
          { userId: 'user-1', readAt: new Date(), user: { email: 'u1@test.com', role: 'BUSINESS' } },
          { userId: 'user-2', readAt: new Date(), user: { email: 'u2@test.com', role: 'CUSTOMER' } },
        ],
      });

      const receipts = await service.getMessageReceipts('user-1', 'msg-1');
      expect(receipts.readersCount).toBe(2);
      expect(receipts.totalRecipients).toBe(2); // excluding sender
      expect(receipts.readers).toHaveLength(2);
    });
  });

  describe('User Blocking (blockUser, unblockUser, isUserBlocked)', () => {
    it('should disallow blocking oneself', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should forbid blocking an ADMIN user', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-user', role: 'ADMIN' });
      await expect(service.blockUser('user-1', 'admin-user')).rejects.toThrow(BadRequestException);
    });

    it('should block a regular user and reject any pending requests from them', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-2', role: 'CUSTOMER' });
      prisma.chatBlock.upsert.mockResolvedValue({});
      prisma.chatMessageRequest.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.blockUser('user-1', 'user-2');
      expect(res.success).toBe(true);
      expect(res.isBlocked).toBe(true);
      expect(prisma.chatBlock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { blockerId_blockedId: { blockerId: 'user-1', blockedId: 'user-2' } },
        }),
      );
      expect(prisma.chatMessageRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { senderId: 'user-2', receiverId: 'user-1', status: 'PENDING' },
        }),
      );
    });

    it('should unblock a user successfully', async () => {
      prisma.chatBlock.deleteMany.mockResolvedValue({ count: 1 });
      const res = await service.unblockUser('user-1', 'user-2');
      expect(res.success).toBe(true);
      expect(res.isBlocked).toBe(false);
      expect(prisma.chatBlock.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-1', blockedId: 'user-2' },
      });
    });
  });

  describe('Message Requests (sendMessageRequest, respondMessageRequest, resetRejectedRequest)', () => {
    it('should bypass request flow for ADMIN users immediately', async () => {
      prisma.user.findFirst.mockImplementation(async ({ where }: any) => {
        if (where?.id === 'admin-1') return { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' };
        return { id: 'user-2', role: 'CUSTOMER', email: 'user2@test.com' };
      });
      prisma.conversation.findUnique.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue({ id: 'conv-admin-direct' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'cp-1',
        conversationId: 'conv-admin-direct',
        conversation: { id: 'conv-admin-direct', participants: [] },
      });

      const res = await service.sendMessageRequest('admin-1', {
        receiverId: 'user-2',
        message: 'Hello, support needed',
      });

      expect(res.status).toBe('ACCEPTED');
      expect(res.conversationId).toBe('conv-admin-direct');
    });

    it('should reject request sending if recipient has blocked sender', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'user-1', role: 'CUSTOMER', email: 'u1@test.com' })
        .mockResolvedValueOnce({ id: 'user-2', role: 'CUSTOMER', email: 'u2@test.com' });
      prisma.chatBlock.findUnique.mockResolvedValue({ id: 'block-1' });

      await expect(
        service.sendMessageRequest('user-1', { receiverId: 'user-2', message: 'Hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should enforce 3-strikes rule when request was rejected 3 times', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'user-1', role: 'CUSTOMER', email: 'u1@test.com' })
        .mockResolvedValueOnce({ id: 'user-2', role: 'CUSTOMER', email: 'u2@test.com' });
      prisma.chatBlock.findUnique.mockResolvedValue(null);
      prisma.chatMessageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        status: 'REJECTED',
        rejectionCount: 3,
      });

      await expect(
        service.sendMessageRequest('user-1', { receiverId: 'user-2', message: 'Please talk' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow retrying if rejection count is less than 3', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'user-1', role: 'CUSTOMER', email: 'u1@test.com' })
        .mockResolvedValueOnce({ id: 'user-2', role: 'CUSTOMER', email: 'u2@test.com' });
      prisma.chatBlock.findUnique.mockResolvedValue(null);
      prisma.chatMessageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        status: 'REJECTED',
        rejectionCount: 1,
      });
      prisma.chatMessageRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        rejectionCount: 1,
      });

      const res = await service.sendMessageRequest('user-1', {
        receiverId: 'user-2',
        message: 'Trying again',
      });

      expect(res.status).toBe('PENDING');
      expect(res.canRetry).toBe(true);
      expect(prisma.chatMessageRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING', message: 'Trying again' }),
        }),
      );
    });

    it('should accept message request and activate direct conversation', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', role: 'ADMIN', email: 'u1@test.com' });
      prisma.chatMessageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        status: 'PENDING',
        rejectionCount: 0,
        sender: { id: 'user-1', email: 'u1@test.com', role: 'CUSTOMER' },
        receiver: { id: 'user-2', email: 'u2@test.com', role: 'CUSTOMER' },
      });
      prisma.chatMessageRequest.update.mockResolvedValue({});
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-accepted' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'cp-accepted',
        conversationId: 'conv-accepted',
        conversation: { id: 'conv-accepted', participants: [] },
      });

      const res = await service.respondMessageRequest('user-2', 'req-1', { action: 'ACCEPT' });
      expect(res.success).toBe(true);
      expect(res.status).toBe('ACCEPTED');
      expect(res.conversationId).toBe('conv-accepted');
    });

    it('should reject message request and increment rejection count', async () => {
      prisma.chatMessageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        status: 'PENDING',
        rejectionCount: 1,
        sender: { id: 'user-1', email: 'u1@test.com', role: 'CUSTOMER' },
        receiver: { id: 'user-2', email: 'u2@test.com', role: 'CUSTOMER' },
      });
      prisma.chatMessageRequest.update.mockResolvedValue({});

      const res = await service.respondMessageRequest('user-2', 'req-1', { action: 'REJECT' });
      expect(res.success).toBe(true);
      expect(res.status).toBe('REJECTED');
      expect(res.rejectionCount).toBe(2);
      expect(res.canRetry).toBe(true);
    });

    it('should allow recipient to reset rejection count so sender can request again', async () => {
      prisma.chatMessageRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        rejectionCount: 3,
      });
      prisma.chatMessageRequest.update.mockResolvedValue({
        id: 'req-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        rejectionCount: 0,
      });

      const res = await service.resetRejectedRequest('user-2', 'user-1');
      expect(res.success).toBe(true);
      expect(prisma.chatMessageRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({ rejectionCount: 0 }),
        }),
      );
    });
  });
});
