import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from './presence.service';
import { PushNotificationService } from './push-notification.service';
import { ChatOutboxService } from './chat-outbox.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let presenceService: any;
  let pushService: any;
  let chatOutbox: any;

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
        groupBy: jest.fn(),
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
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      notification: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    presenceService = {
      isUserOnline: jest.fn().mockResolvedValue(true),
      areUsersOnline: jest.fn().mockImplementation(async (ids: string[]) =>
        Object.fromEntries(ids.map((id) => [id, true])),
      ),
      isViewingConversation: jest.fn().mockReturnValue(false),
    };

    pushService = {
      sendPushToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    };

    chatOutbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: PresenceService, useValue: presenceService },
        { provide: PushNotificationService, useValue: pushService },
        { provide: ChatOutboxService, useValue: chatOutbox },
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
      // The socket bridge omits `type`; the conversation preview must still be
      // the message text rather than the "[Message]" placeholder.
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastMessageText: 'Brand new message' }),
        }),
      );
      expect(prisma.messageReadReceipt.create).toHaveBeenCalled();
      expect(prisma.chatOutbox.create).toHaveBeenCalled();
      expect(chatOutbox.enqueue).toHaveBeenCalledWith('outbox-1');
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

  describe('getConversations unread aggregation', () => {
    it('uses one grouped query + one presence batch instead of N+1 counts', async () => {
      const participant = (userId: string, businessName: string | null) => ({
        userId,
        role: userId === 'u1' ? 'ADMIN' : 'MEMBER',
        lastReadAt: null,
        user: {
          id: userId,
          email: `${userId}@example.com`,
          firstName: userId.toUpperCase(),
          lastName: 'User',
          role: userId === 'u2' ? 'AGENT' : 'BUSINESS',
          businessProfile: businessName ? { businessName, logoUrl: null } : null,
        },
      });

      prisma.conversationParticipant.findMany.mockResolvedValue([
        {
          conversationId: 'c1',
          role: 'ADMIN',
          isMuted: false,
          lastReadAt: new Date('2026-01-01T00:00:00Z'),
          conversation: {
            id: 'c1',
            type: 'DIRECT',
            title: null,
            avatarUrl: null,
            directKey: 'u1:u2',
            lastMessageAt: new Date('2026-01-02T00:00:00Z'),
            lastMessageText: 'hello',
            lastMessageSenderId: 'u2',
            participants: [participant('u1', null), participant('u2', 'Acme Ltd')],
          },
        },
        {
          conversationId: 'c2',
          role: 'ADMIN',
          isMuted: false,
          lastReadAt: null,
          conversation: {
            id: 'c2',
            type: 'DIRECT',
            title: null,
            avatarUrl: null,
            directKey: 'u1:u3',
            lastMessageAt: new Date('2026-01-03T00:00:00Z'),
            lastMessageText: 'yo',
            lastMessageSenderId: 'u3',
            participants: [participant('u1', null), participant('u3', 'Beta Ltd')],
          },
        },
      ]);
      prisma.message.groupBy.mockResolvedValue([
        { conversationId: 'c1', _count: { _all: 2 } },
        { conversationId: 'c2', _count: { _all: 5 } },
      ]);
      presenceService.areUsersOnline.mockResolvedValue({
        u1: true,
        u2: false,
        u3: true,
      });

      const result = await service.getConversations('u1');

      expect(prisma.message.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.message.count).not.toHaveBeenCalled();
      expect(presenceService.areUsersOnline).toHaveBeenCalledTimes(1);

      expect(result[0]).toMatchObject({ id: 'c1', title: 'Acme Ltd', unreadCount: 2 });
      expect(result[0].isOnline).toBe(false);
      expect(result[1]).toMatchObject({ id: 'c2', title: 'Beta Ltd', unreadCount: 5 });
      expect(result[1].isOnline).toBe(true);
    });
  });

  // ─── Group administration: admin-only (read-only) mode ───────────────────
  describe('Group administration (admin-only mode, roles, ownership)', () => {
    /** Participant + conversation shape shared by the group-admin helpers. */
    const groupConversation = (overrides: Record<string, any> = {}) => ({
      id: 'conv-1',
      type: 'GROUP',
      deletedAt: null,
      title: 'Acme Weekly',
      avatarUrl: null,
      isAdminOnly: false,
      createdById: 'owner-1',
      participants: [
        { userId: 'owner-1', role: 'ADMIN', user: { id: 'owner-1', email: 'o@t.com' } },
        { userId: 'admin-1', role: 'ADMIN', user: { id: 'admin-1', email: 'a@t.com' } },
        { userId: 'member-1', role: 'MEMBER', user: { id: 'member-1', email: 'm@t.com' } },
      ],
      ...overrides,
    });

    const participantRecord = (userId: string, role: 'ADMIN' | 'MEMBER', overrides: Record<string, any> = {}) => ({
      id: `cp-${userId}`,
      conversationId: 'conv-1',
      userId,
      role,
      isMuted: false,
      lastReadAt: null,
      user: { id: userId, email: `${userId}@t.com`, firstName: userId, lastName: 'User', role: 'BUSINESS' },
      conversation: groupConversation(),
      ...overrides,
    });

    describe('admin-only posting mode', () => {
      it('should reject a MEMBER sending into an admin-only group', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('member-1', 'MEMBER', {
            conversation: groupConversation({ isAdminOnly: true }),
          }),
        );

        await expect(
          service.sendMessage('member-1', { conversationId: 'conv-1', content: 'Hi team' }),
        ).rejects.toThrow(ForbiddenException);

        // Nothing must be persisted when the sender is not allowed to post.
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.chatOutbox.create).not.toHaveBeenCalled();
      });

      it('should allow an ADMIN to send into an admin-only group', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('admin-1', 'ADMIN', {
            conversation: groupConversation({ isAdminOnly: true }),
          }),
        );
        prisma.message.findFirst.mockResolvedValue(null);
        prisma.message.create.mockResolvedValue({
          id: 'msg-admin',
          conversationId: 'conv-1',
          content: 'Hello team',
          senderId: 'admin-1',
          type: 'TEXT',
          createdAt: new Date(),
          sender: { id: 'admin-1', email: 'a@t.com' },
        });

        const result = await service.sendMessage('admin-1', {
          conversationId: 'conv-1',
          content: 'Hello team',
        });

        expect(result.id).toBe('msg-admin');
        expect(prisma.message.create).toHaveBeenCalled();
      });

      it('should still allow a MEMBER to send in a normal group', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('member-1', 'MEMBER'),
        );
        prisma.message.findFirst.mockResolvedValue(null);
        prisma.message.create.mockResolvedValue({
          id: 'msg-member',
          conversationId: 'conv-1',
          content: 'Hello team',
          senderId: 'member-1',
          type: 'TEXT',
          createdAt: new Date(),
          sender: { id: 'member-1', email: 'm@t.com' },
        });

        const result = await service.sendMessage('member-1', {
          conversationId: 'conv-1',
          content: 'Hello team',
        });

        expect(result.id).toBe('msg-member');
      });

      it('should never apply the admin-only rule to direct conversations', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue({
          id: 'cp-1',
          conversationId: 'conv-1',
          userId: 'member-1',
          role: 'MEMBER',
          user: { id: 'member-1', email: 'm@t.com' },
          conversation: {
            id: 'conv-1',
            type: 'DIRECT',
            isAdminOnly: false,
            deletedAt: null,
            participants: [
              { userId: 'member-1', isMuted: false },
              { userId: 'other-1', isMuted: false },
            ],
          },
        });
        prisma.message.findFirst.mockResolvedValue(null);
        prisma.message.create.mockResolvedValue({
          id: 'msg-direct',
          conversationId: 'conv-1',
          content: 'Hello',
          senderId: 'member-1',
          type: 'TEXT',
          createdAt: new Date(),
          sender: { id: 'member-1', email: 'm@t.com' },
        });
        // The counterpart must exist for a direct conversation.
        prisma.user.findFirst.mockResolvedValue({ id: 'other-1' });

        const result = await service.sendMessage('member-1', {
          conversationId: 'conv-1',
          content: 'Hello',
        });

        expect(result.id).toBe('msg-direct');
      });
    });

    describe('updateGroupSettings', () => {
      it('should forbid a MEMBER from toggling the admin-only mode', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('member-1', 'MEMBER'),
        );

        await expect(
          service.updateGroupSettings('member-1', 'conv-1', { isAdminOnly: true }),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.conversation.update).not.toHaveBeenCalled();
      });

      it('should let an ADMIN switch the group to admin-only and announce it', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('admin-1', 'ADMIN'),
        );
        prisma.conversation.update.mockResolvedValue({});

        await service.updateGroupSettings('admin-1', 'conv-1', { isAdminOnly: true });

        expect(prisma.conversation.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'conv-1' },
            data: expect.objectContaining({ isAdminOnly: true }),
          }),
        );
        // The change is recorded in the transcript as a system message.
        expect(prisma.message.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ type: 'SYSTEM' }),
          }),
        );
      });

      it('should let an ADMIN rename the group', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('admin-1', 'ADMIN'),
        );
        prisma.conversation.update.mockResolvedValue({});

        await service.updateGroupSettings('admin-1', 'conv-1', { title: '  New Name  ' });

        expect(prisma.conversation.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ title: 'New Name' }),
          }),
        );
      });

      it('should not write a system message when nothing actually changed', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('admin-1', 'ADMIN'),
        );

        await service.updateGroupSettings('admin-1', 'conv-1', { isAdminOnly: false });

        expect(prisma.conversation.update).not.toHaveBeenCalled();
        expect(prisma.message.create).not.toHaveBeenCalled();
      });

      it('should reject a non-http group photo URL', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('admin-1', 'ADMIN'),
        );

        await expect(
          service.updateGroupSettings('admin-1', 'conv-1', { avatarUrl: 'javascript:alert(1)' }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('setParticipantRole', () => {
      it('should let an ADMIN promote a member', async () => {
        prisma.conversationParticipant.findUnique.mockImplementation(
          async ({ where }: any) => {
            if (where?.conversationId_userId?.userId === 'member-1') {
              return participantRecord('member-1', 'MEMBER');
            }
            return participantRecord('admin-1', 'ADMIN');
          },
        );

        await service.setParticipantRole('admin-1', 'conv-1', 'member-1', 'ADMIN');

        expect(prisma.conversationParticipant.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { conversationId_userId: { conversationId: 'conv-1', userId: 'member-1' } },
            data: { role: 'ADMIN' },
          }),
        );
      });

      it('should refuse to demote the group owner', async () => {
        prisma.conversationParticipant.findUnique.mockImplementation(
          async ({ where }: any) => {
            if (where?.conversationId_userId?.userId === 'owner-1') {
              return participantRecord('owner-1', 'ADMIN');
            }
            return participantRecord('admin-1', 'ADMIN');
          },
        );

        await expect(
          service.setParticipantRole('admin-1', 'conv-1', 'owner-1', 'MEMBER'),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.conversationParticipant.update).not.toHaveBeenCalled();
      });

      it('should refuse to change the caller own role', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('admin-1', 'ADMIN'),
        );

        await expect(
          service.setParticipantRole('admin-1', 'conv-1', 'admin-1', 'MEMBER'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('transferOwnership', () => {
      it('should refuse a transfer requested by a non-owner admin', async () => {
        prisma.conversationParticipant.findUnique.mockResolvedValue(
          participantRecord('admin-1', 'ADMIN'),
        );

        await expect(
          service.transferOwnership('admin-1', 'conv-1', 'member-1'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should let the owner transfer ownership and promote the new owner', async () => {
        prisma.conversationParticipant.findUnique.mockImplementation(
          async ({ where }: any) => {
            if (where?.conversationId_userId?.userId === 'member-1') {
              return participantRecord('member-1', 'MEMBER');
            }
            return participantRecord('owner-1', 'ADMIN');
          },
        );
        prisma.conversation.update.mockResolvedValue({});
        prisma.conversationParticipant.update.mockResolvedValue({});

        await service.transferOwnership('owner-1', 'conv-1', 'member-1');

        expect(prisma.conversation.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'conv-1' },
            data: expect.objectContaining({ createdById: 'member-1' }),
          }),
        );
        expect(prisma.conversationParticipant.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { conversationId_userId: { conversationId: 'conv-1', userId: 'member-1' } },
            data: { role: 'ADMIN' },
          }),
        );
      });
    });

    describe('removeParticipant', () => {
      it('should refuse to remove the group owner', async () => {
        prisma.conversationParticipant.findUnique.mockImplementation(
          async ({ where }: any) => {
            if (where?.conversationId_userId?.userId === 'owner-1') {
              return participantRecord('owner-1', 'ADMIN');
            }
            return participantRecord('admin-1', 'ADMIN');
          },
        );

        await expect(
          service.removeParticipant('admin-1', 'conv-1', 'owner-1'),
        ).rejects.toThrow(ForbiddenException);

        expect(prisma.conversationParticipant.delete).not.toHaveBeenCalled();
      });
    });
  });
});
