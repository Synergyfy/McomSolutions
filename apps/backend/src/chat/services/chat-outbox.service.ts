import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatOutbox } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CHAT_OUTBOX_QUEUE, ChatOutboxJobData } from '../../queue/queue.constants';
import { PresenceService } from './presence.service';
import { PushNotificationService } from './push-notification.service';

interface NewMessagePayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content?: string;
  createdAt?: string;
}

const MAX_ATTEMPTS = 5;
const OUTBOX_LOCK_TTL_SECONDS = 300;

/**
 * Durable, idempotent delivery for chat side effects (in-app notification +
 * Web Push).
 *
 * `ChatService.sendMessage` writes a `ChatOutbox` row inside the same
 * transaction as the message, then enqueues it. The worker claims the row
 * atomically, delivers side effects, and retries with exponential backoff.
 * A per-minute sweeper re-enqueues rows left behind by a crashed process.
 *
 * Idempotency:
 *  - the row claim is a conditional UPDATE (only one worker wins);
 *  - in-app notifications are deduped by `(userId, type, data.messageId)`;
 *  - push payloads carry `tag: chat-msg-{messageId}` so the browser collapses
 *    duplicates.
 */
@Injectable()
export class ChatOutboxService {
  private readonly logger = new Logger(ChatOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly presenceService: PresenceService,
    private readonly pushService: PushNotificationService,
    @Optional()
    @InjectQueue(CHAT_OUTBOX_QUEUE)
    private readonly queue?: Queue<ChatOutboxJobData>,
  ) {}

  // ─── Enqueue / claim ──────────────────────────────────────────────────────

  /**
   * Enqueue a row for async delivery. If BullMQ/Redis is unavailable we fall
   * back to inline processing so notifications still go out (single process).
   */
  async enqueue(outboxId: string): Promise<void> {
    if (!outboxId) return;

    if (this.queue) {
      try {
        await this.queue.add(
          'process-outbox',
          { outboxId },
          {
            jobId: outboxId,
            attempts: MAX_ATTEMPTS,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 200,
            removeOnFail: 500,
          },
        );
        return;
      } catch (error: any) {
        this.logger.warn(
          `Chat outbox queue unavailable (${error?.message}); processing ${outboxId} inline`,
        );
      }
    }

    void this.process(outboxId).catch((error) =>
      this.logger.error(`Inline chat outbox processing failed for ${outboxId}: ${error?.message}`),
    );
  }

  /** Process one outbox row. Safe to call more than once. */
  async process(outboxId: string): Promise<{ status: 'COMPLETED' | 'SKIPPED' }> {
    const row = await this.prisma.chatOutbox.findUnique({ where: { id: outboxId } });
    if (!row || row.status === 'COMPLETED' || row.status === 'FAILED') {
      return { status: 'SKIPPED' };
    }

    // Atomic claim: only a PENDING row can move to PROCESSING. A second worker
    // (or a duplicate sweep job) sees count 0 and skips.
    const claim = await this.prisma.chatOutbox.updateMany({
      where: { id: outboxId, status: 'PENDING' },
      data: { status: 'PROCESSING', errorMessage: null },
    });
    if (claim.count === 0) {
      return { status: 'SKIPPED' };
    }

    await this.redis
      .set(`chat:outbox:lock:${outboxId}`, { worker: process.pid }, OUTBOX_LOCK_TTL_SECONDS)
      .catch(() => undefined);

    try {
      await this.deliver(row);
      await this.prisma.chatOutbox.update({
        where: { id: outboxId },
        data: { status: 'COMPLETED', processedAt: new Date(), errorMessage: null },
      });
      return { status: 'COMPLETED' };
    } catch (error: any) {
      const message = String(error?.message || error).slice(0, 500);
      await this.prisma.chatOutbox
        .update({
          where: { id: outboxId },
          data: {
            status: 'PENDING',
            retryCount: { increment: 1 },
            errorMessage: message,
          },
        })
        .catch(() => undefined);
      throw error;
    } finally {
      await this.redis.del(`chat:outbox:lock:${outboxId}`).catch(() => undefined);
    }
  }

  /** Terminal failure (BullMQ exhausted its retries). */
  async markDead(outboxId: string, errorMessage?: string): Promise<void> {
    await this.prisma.chatOutbox
      .updateMany({
        where: { id: outboxId, status: { not: 'COMPLETED' } },
        data: {
          status: 'FAILED',
          errorMessage: (errorMessage || 'Exhausted retries').slice(0, 500),
        },
      })
      .catch(() => undefined);
    this.logger.error(`Chat outbox ${outboxId} exhausted retries and is now FAILED`);
  }

  // ─── Delivery ─────────────────────────────────────────────────────────────

  private async deliver(row: ChatOutbox): Promise<void> {
    if (row.eventType !== 'NEW_MESSAGE') {
      this.logger.warn(`Unknown chat outbox event type "${row.eventType}" (${row.id})`);
      return;
    }

    const payload = (row.payload || {}) as unknown as NewMessagePayload;
    if (!payload.messageId || !payload.conversationId || !payload.senderId) {
      throw new Error('Malformed NEW_MESSAGE outbox payload');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: payload.messageId },
      include: {
        conversation: {
          include: {
            participants: { select: { userId: true, isMuted: true } },
          },
        },
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            businessProfile: { select: { businessName: true } },
          },
        },
      },
    });

    // Message deleted/removed before delivery — nothing to do.
    if (!message || message.deletedAt) return;

    const conversation = message.conversation;
    const senderName =
      message.sender?.businessProfile?.businessName ||
      [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(' ') ||
      message.sender?.email?.split('@')[0] ||
      payload.senderName ||
      'Someone';

    const recipients = conversation.participants.filter(
      (participant) =>
        participant.userId !== message.senderId && !participant.isMuted,
    );

    for (const recipient of recipients) {
      // Silent blocking: never notify a recipient who has blocked the sender.
      const blocked = await this.prisma.chatBlock.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: recipient.userId,
            blockedId: message.senderId,
          },
        },
        select: { id: true },
      });
      if (blocked) continue;

      const alreadyNotified = await this.prisma.notification.findFirst({
        where: {
          userId: recipient.userId,
          type: 'chat_message',
          data: { path: ['messageId'], equals: message.id },
        },
        select: { id: true },
      });

      if (!alreadyNotified) {
        await this.prisma.notification
          .create({
            data: {
              userId: recipient.userId,
              type: 'chat_message',
              title:
                conversation.type === 'GROUP'
                  ? `New message in ${conversation.title || 'Group'}`
                  : `Message from ${senderName}`,
              message: `${senderName}: ${message.content.slice(0, 150)}`,
              data: {
                conversationId: conversation.id,
                messageId: message.id,
                senderId: message.senderId,
              },
            },
          })
          .catch((error: any) =>
            this.logger.warn(
              `Could not create chat notification for ${recipient.userId}: ${error?.message}`,
            ),
          );
      }

      const isViewing = await this.presenceService.isViewingConversationAsync(
        recipient.userId,
        conversation.id,
      );
      if (!isViewing) {
        await this.pushService
          .sendPushToUser(recipient.userId, {
            title:
              conversation.type === 'GROUP'
                ? `${conversation.title || 'Group'}: ${senderName}`
                : senderName,
            body: message.content.slice(0, 120),
            data: {
              conversationId: conversation.id,
              messageId: message.id,
              tag: `chat-msg-${message.id}`,
            },
          })
          .catch(() => undefined);
      }
    }
  }

  // ─── Sweeper ──────────────────────────────────────────────────────────────

  /**
   * Re-enqueue rows that were written but never picked up (e.g. the process
   * died between the DB commit and the BullMQ `add`), and release rows stuck
   * in PROCESSING whose worker lock expired.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    await this.withLock('cron:chat-outbox-sweep', 55, async () => {
      const processing = await this.prisma.chatOutbox.findMany({
        where: { status: 'PROCESSING' },
        select: { id: true },
        take: 200,
      });

      for (const row of processing) {
        const lock = await this.redis
          .get(`chat:outbox:lock:${row.id}`)
          .catch(() => null);
        if (lock) continue;
        await this.prisma.chatOutbox
          .updateMany({
            where: { id: row.id, status: 'PROCESSING' },
            data: {
              status: 'PENDING',
              errorMessage: 'Requeued after stale processing lease expired',
            },
          })
          .catch(() => undefined);
      }

      const pending = await this.prisma.chatOutbox.findMany({
        where: { status: 'PENDING' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      for (const row of pending) {
        await this.enqueue(row.id);
      }

      if (pending.length > 0) {
        this.logger.debug(`Swept ${pending.length} pending chat outbox row(s)`);
      }
    });
  }

  private async withLock(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<void>,
  ): Promise<void> {
    let acquired = false;
    try {
      acquired = await this.redis.setNx(key, { pid: process.pid }, ttlSeconds);
    } catch {
      // Redis unavailable: run locally (single-process fallback).
      acquired = true;
    }
    if (!acquired) {
      this.logger.debug(`${key} already running elsewhere — skipping`);
      return;
    }
    try {
      await fn();
    } finally {
      await this.redis.del(key).catch(() => undefined);
    }
  }
}
