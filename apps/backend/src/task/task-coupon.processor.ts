import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { TASK_COUPON_QUEUE, TaskCouponJobData } from '../queue/queue.constants';
import { CouponService } from '../coupon/coupon.service';

@Processor(TASK_COUPON_QUEUE)
export class TaskCouponProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskCouponProcessor.name);

  constructor(private readonly couponService: CouponService) {
    super();
  }

  async process(job: Job<TaskCouponJobData>): Promise<{ issued: boolean; code?: string }> {
    const { assignmentId } = job.data;
    this.logger.log(`Processing task coupon for assignment=${assignmentId} (job=${job.id})`);
    const result = await this.couponService.issueTaskRewardCoupon(assignmentId);
    if (!result) return { issued: false };
    this.logger.log(
      `Task coupon ${result.code} issued for assignment=${assignmentId} (emailed=${result.emailed})`,
    );
    return { issued: true, code: result.code };
  }
}
