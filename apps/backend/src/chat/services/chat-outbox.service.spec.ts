import { ChatOutboxService } from './chat-outbox.service';

describe('ChatOutboxService', () => {
  let service: ChatOutboxService;
  let prisma: any;
  let redis: any;
  let presence: any;
  let push: any;
  let queue: any;

  beforeEach(() => {
    prisma = {
      chatOutbox: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      message: { findUnique: jest.fn() },
      chatBlock: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    redis = {
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      setNx: jest.fn().mockResolvedValue(true),
    };
    presence = {
      isViewingConversationAsync: jest.fn().mockResolvedValue(false),
    };
    push = {
      sendPushToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    };
    queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    service = new ChatOutboxService(
      prisma as any,
      redis as any,
      presence as any,
      push as any,
      queue as any,
    );
  });

  function pendingRow(overrides: Record<string, any> = {}) {
    return {
      id: 'o1',
      eventType: 'NEW_MESSAGE',
      status: 'PENDING',
      retryCount: 0,
      errorMessage: null,
      processedAt: null,
      createdAt: new Date(),
      payload: {
        messageId: 'm1',
        conversationId: 'c1',
        senderId: 'u1',
      },
      ...overrides,
    };
  }

  it('skips rows that are already completed', async () => {
    prisma.chatOutbox.findUnique.mockResolvedValue(pendingRow({ status: 'COMPLETED' }));

    await expect(service.process('o1')).resolves.toEqual({ status: 'SKIPPED' });
    expect(prisma.chatOutbox.updateMany).not.toHaveBeenCalled();
  });

  it('delivers notifications only to eligible recipients and marks the row completed', async () => {
    prisma.chatOutbox.findUnique.mockResolvedValue(pendingRow());
    prisma.message.findUnique.mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'Hello there',
      deletedAt: null,
      conversation: {
        id: 'c1',
        type: 'DIRECT',
        title: null,
        participants: [
          { userId: 'u1', isMuted: false }, // sender
          { userId: 'u2', isMuted: false }, // eligible
          { userId: 'u3', isMuted: true }, // muted
          { userId: 'u4', isMuted: false }, // blocked
        ],
      },
      sender: {
        id: 'u1',
        email: 'sender@example.com',
        firstName: 'S',
        lastName: 'End',
        businessProfile: null,
      },
    });
    prisma.chatBlock.findUnique.mockImplementation(async ({ where }: any) =>
      where.blockerId_blockedId.blockerId === 'u4' ? { id: 'block-1' } : null,
    );

    await expect(service.process('o1')).resolves.toEqual({ status: 'COMPLETED' });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u2',
        type: 'chat_message',
        data: expect.objectContaining({ messageId: 'm1', conversationId: 'c1' }),
      }),
    });
    expect(push.sendPushToUser).toHaveBeenCalledTimes(1);
    expect(push.sendPushToUser).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ data: expect.objectContaining({ tag: 'chat-msg-m1' }) }),
    );
    expect(prisma.chatOutbox.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
    expect(redis.del).toHaveBeenCalledWith('chat:outbox:lock:o1');
  });

  it('does not duplicate an in-app notification that already exists', async () => {
    prisma.chatOutbox.findUnique.mockResolvedValue(pendingRow());
    prisma.message.findUnique.mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'Hello there',
      deletedAt: null,
      conversation: {
        id: 'c1',
        type: 'DIRECT',
        title: null,
        participants: [
          { userId: 'u1', isMuted: false },
          { userId: 'u2', isMuted: false },
        ],
      },
      sender: { id: 'u1', email: 'sender@example.com', firstName: 'S', lastName: 'End', businessProfile: null },
    });
    prisma.notification.findFirst.mockResolvedValue({ id: 'existing' });

    await service.process('o1');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('requeues the row when delivery fails', async () => {
    prisma.chatOutbox.findUnique.mockResolvedValue(
      pendingRow({ payload: { conversationId: 'c1', senderId: 'u1' } }),
    );

    await expect(service.process('o1')).rejects.toThrow(/Malformed/);
    expect(prisma.chatOutbox.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: expect.objectContaining({
        status: 'PENDING',
        retryCount: { increment: 1 },
      }),
    });
  });

  it('falls back to inline processing when the queue is unavailable', async () => {
    queue.add.mockRejectedValueOnce(new Error('redis down'));
    const processSpy = jest
      .spyOn(service, 'process')
      .mockResolvedValue({ status: 'COMPLETED' });

    await service.enqueue('o1');

    expect(processSpy).toHaveBeenCalledWith('o1');
  });

  it('sweeps stale processing rows and re-enqueues pending rows', async () => {
    prisma.chatOutbox.findMany.mockImplementation(async ({ where }: any) =>
      where.status === 'PROCESSING' ? [{ id: 'stale-1' }] : [{ id: 'p-1' }],
    );
    redis.get.mockResolvedValueOnce(null);
    const enqueueSpy = jest.spyOn(service, 'enqueue').mockResolvedValue();

    await service.sweep();

    expect(prisma.chatOutbox.updateMany).toHaveBeenCalledWith({
      where: { id: 'stale-1', status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'PENDING' }),
    });
    expect(enqueueSpy).toHaveBeenCalledWith('p-1');
    expect(redis.setNx).toHaveBeenCalledWith(
      'cron:chat-outbox-sweep',
      expect.anything(),
      expect.any(Number),
    );
  });
});
