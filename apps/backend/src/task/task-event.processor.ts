import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  TASK_EVENT_QUEUE,
  TASK_REWARD_QUEUE,
  TaskEventJobData,
  TaskRewardJobData,
} from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { TaskAssignmentStatus } from '@prisma/client';

@Processor(TASK_EVENT_QUEUE)
export class TaskEventProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskEventProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TASK_REWARD_QUEUE) private readonly rewardQueue: Queue<TaskRewardJobData>,
  ) {
    super();
  }

  async process(job: Job<TaskEventJobData>): Promise<{ matched: number; completed: number; expired: number }> {
    const { userId, featureKey, userType } = job.data;
    this.logger.log(
      `Processing task-event for user=${userId} (${userType}) featureKey=${featureKey} (job=${job.id})`,
    );

    const now = new Date();

    // Find all active assignments for this user matching this feature key
    const assignments = await this.prisma.userTaskAssignment.findMany({
      where: {
        userId,
        task: {
          featureKey,
          isActive: true,
        },
        status: {
          in: [TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS],
        },
      },
      include: {
        task: true,
      },
    });

    if (assignments.length === 0) {
      this.logger.debug(`No matching pending assignments found for user=${userId}, feature=${featureKey}`);
      return { matched: 0, completed: 0, expired: 0 };
    }

    let completedCount = 0;
    let expiredCount = 0;

    for (const assignment of assignments) {
      if (assignment.deadlineAt < now) {
        // Deadline passed
        await this.prisma.userTaskAssignment.update({
          where: { id: assignment.id },
          data: { status: TaskAssignmentStatus.EXPIRED },
        });
        expiredCount++;
        this.logger.warn(`Task "${assignment.task.title}" (assignment=${assignment.id}) marked EXPIRED for user=${userId}`);
      } else {
        // Successfully completed within deadline!
        await this.prisma.userTaskAssignment.update({
          where: { id: assignment.id },
          data: {
            status: TaskAssignmentStatus.COMPLETED,
            completedAt: now,
          },
        });
        completedCount++;

        // Enqueue reward
        if (assignment.rewardPoints > 0 && !assignment.rewardGranted) {
          await this.rewardQueue.add(
            'grant-task-reward',
            {
              assignmentId: assignment.id,
              userId: assignment.userId,
              rewardPoints: assignment.rewardPoints,
              taskTitle: assignment.task.title,
            },
            {
              jobId: `task-reward-${assignment.id}`,
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
            },
          );
        }

        // Cross-sync automated completion into the 90-day BusinessProgramme
        if (userType === 'BUSINESS') {
          await this.syncToBusinessProgramme(userId, featureKey);
        }

        this.logger.log(
          `Task "${assignment.task.title}" marked COMPLETED for user=${userId}. Reward job queued.`,
        );
      }
    }

    return { matched: assignments.length, completed: completedCount, expired: expiredCount };
  }

  private async syncToBusinessProgramme(userId: string, missionIdentifier: string) {
    try {
      const profile = await this.prisma.businessProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!profile) return;
      const prog = await this.prisma.businessProgramme.findFirst({
        where: { businessId: profile.id },
      });
      if (!prog || prog.completedMissions.includes(missionIdentifier)) return;
      await this.prisma.businessProgramme.update({
        where: { id: prog.id },
        data: { completedMissions: { push: missionIdentifier } },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to sync automated task to BusinessProgramme: ${msg}`);
    }
  }
}
