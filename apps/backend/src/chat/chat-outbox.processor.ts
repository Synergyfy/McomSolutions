import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CHAT_OUTBOX_QUEUE, ChatOutboxJobData } from '../queue/queue.constants';
import { ChatOutboxService } from './services/chat-outbox.service';

/**
 * BullMQ worker for durable chat side effects. The API writes the message and
 * the `ChatOutbox` row in one transaction, then enqueues the row id; this
 * worker performs notification/push delivery with retries.
 */
@Processor(CHAT_OUTBOX_QUEUE)
export class ChatOutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatOutboxProcessor.name);

  constructor(private readonly outbox: ChatOutboxService) {
    super();
  }

  async process(job: Job<ChatOutboxJobData>): Promise<unknown> {
    const outboxId = job.data?.outboxId;
    if (!outboxId) {
      this.logger.warn(`Chat outbox job ${job.id} has no outboxId — skipping`);
      return { status: 'SKIPPED' };
    }

    this.logger.debug(
      `Processing chat outbox ${outboxId} (attempt ${job.attemptsMade + 1})`,
    );
    return this.outbox.process(outboxId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ChatOutboxJobData>, error: Error): Promise<void> {
    const maxAttempts = job?.opts?.attempts ?? 5;
    if (!job?.data?.outboxId) return;

    if (job.attemptsMade >= maxAttempts) {
      await this.outbox.markDead(job.data.outboxId, error?.message);
      return;
    }

    this.logger.warn(
      `Chat outbox ${job.data.outboxId} failed attempt ${job.attemptsMade}/${maxAttempts}: ${error?.message}`,
    );
  }
}
