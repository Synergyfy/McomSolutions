import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AFFILIATE_TASK_QUEUE, AffiliateTaskJobData } from '../queue/queue.constants';
import { AffiliateTaskService } from './affiliate-task.service';

/**
 * Background worker for delegated-task side effects.
 *
 * Delegation already wrote the task row before this job is queued, so the API
 * response is fast. The worker mirrors the task to 247GBS Affiliates, then
 * sends the assignee + business emails and in-app notifications. Failures are
 * retried with exponential backoff and surface on the task (`lastSyncError`)
 * plus an admin notification.
 */
@Processor(AFFILIATE_TASK_QUEUE)
export class AffiliateTaskProcessor extends WorkerHost {
  private readonly logger = new Logger(AffiliateTaskProcessor.name);

  constructor(private readonly tasks: AffiliateTaskService) {
    super();
  }

  async process(job: Job<AffiliateTaskJobData>): Promise<void> {
    const action = job.data?.action || job.name;
    this.logger.log(`Processing ${action} for task ${job.data?.taskId} (job ${job.id})`);

    try {
      if (action === 'delegate-task') {
        await this.tasks.processDelegationJob(job.data.taskId);
        return;
      }
      if (action === 'push-review') {
        await this.tasks.processReviewJob(job.data.taskId);
        return;
      }
      this.logger.warn(`Unknown affiliate task job: ${action}`);
    } catch (error: any) {
      this.logger.error(
        `Affiliate task job ${action} failed for ${job.data?.taskId}: ${error?.message}`,
      );
      throw error;
    }
  }
}
