import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WEBHOOK_DISPATCH_QUEUE, WEBHOOK_DISPATCH_DLQ, WebhookJobData } from '../queue/queue.constants';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Processor(WEBHOOK_DISPATCH_QUEUE)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly dispatcher: WebhookDispatcherService,
    @InjectQueue(WEBHOOK_DISPATCH_DLQ) private readonly dlqQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<any> {
    const { platformIdentifier, event, data } = job.data;
    this.logger.log(
      `Processing webhook job ${job.id} (attempt ${job.attemptsMade + 1}): ${event} to ${platformIdentifier}`,
    );

    const result = await this.dispatcher.dispatch(platformIdentifier, event, data, {
      jobId: job.id,
      retryCount: job.attemptsMade,
    });
    if (!result.dispatched && result.reason !== 'APP_NOT_FOUND' && result.reason !== 'NO_WEBHOOK_URL_CONFIGURED') {
      throw new Error(result.error || `Webhook delivery failed with status ${result.statusCode}`);
    }
    return result;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WebhookJobData>, error: Error) {
    const maxAttempts = job?.opts?.attempts ?? 5;
    this.logger.warn(
      `Job ${job?.id} failed attempt ${job?.attemptsMade}/${maxAttempts}: ${error?.message}`,
    );
    if (job && job.attemptsMade >= maxAttempts) {
      this.logger.error(`Job ${job.id} exhausted all retry attempts. Sending to DLQ.`);
      try {
        await this.dlqQueue.add('dead-letter', {
          originalJobId: job.id,
          failedReason: error?.message,
          data: job.data,
          failedAt: new Date().toISOString(),
        });
      } catch (dlqErr: unknown) {
        const msg = dlqErr instanceof Error ? dlqErr.message : String(dlqErr);
        this.logger.error(`Failed to push job ${job.id} to DLQ: ${msg}`);
      }
    }
  }
}
