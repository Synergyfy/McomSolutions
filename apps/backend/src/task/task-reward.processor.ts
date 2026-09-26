import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { TASK_REWARD_QUEUE, TaskRewardJobData } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { TransactionCategory } from '@prisma/client';

@Processor(TASK_REWARD_QUEUE)
export class TaskRewardProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskRewardProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {
    super();
  }

  async process(job: Job<TaskRewardJobData>): Promise<{ rewarded: boolean; amount: number }> {
    const { assignmentId, userId, rewardPoints, taskTitle } = job.data;
    this.logger.log(
      `Processing task-reward for assignment=${assignmentId} user=${userId} points=${rewardPoints} (job=${job.id})`,
    );

    const assignment = await this.prisma.userTaskAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      this.logger.warn(`Assignment ${assignmentId} not found. Skipping reward.`);
      return { rewarded: false, amount: 0 };
    }

    if (assignment.rewardGranted) {
      this.logger.log(`Reward already granted for assignment=${assignmentId}. Skipping.`);
      return { rewarded: false, amount: rewardPoints };
    }

    if (rewardPoints <= 0) {
      await this.prisma.userTaskAssignment.update({
        where: { id: assignmentId },
        data: { rewardGranted: true },
      });
      return { rewarded: true, amount: 0 };
    }

    // Process wallet credit
    const partnerContext = {
      clientId: 'task-engine',
      name: 'Task Engine',
      platformSlug: 'mcom-central',
    };

    try {
      await this.walletService.creditWallet(
        partnerContext,
        {
          userId,
          amount: rewardPoints,
          category: TransactionCategory.REWARD,
          reference: `TASK_${assignmentId}`,
          description: `Reward for task: ${taskTitle}`,
          metadata: { assignmentId, taskTitle },
        },
        `task-reward-${assignmentId}`,
      );

      // Mark assignment as rewardGranted
      await this.prisma.userTaskAssignment.update({
        where: { id: assignmentId },
        data: { rewardGranted: true },
      });

      // Emit Notification if user has business profile
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { businessProfile: { select: { id: true } } },
      });

      if (user?.businessProfile?.id) {
        await this.prisma.notification.create({
          data: {
            businessId: user.businessProfile.id,
            type: 'reward',
            title: 'Task Reward Credited! 🎉',
            message: `You earned ${rewardPoints} MCOM points for completing "${taskTitle}".`,
            read: false,
          },
        });
      }

      this.logger.log(
        `Successfully credited ${rewardPoints} points to user=${userId} for task="${taskTitle}".`,
      );
      return { rewarded: true, amount: rewardPoints };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to credit wallet for assignment=${assignmentId}: ${msg}`, err as any);
      throw err; // Trigger BullMQ retry
    }
  }
}
