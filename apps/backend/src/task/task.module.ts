import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { QueueModule } from '../queue/queue.module';
import { TASK_EVENT_QUEUE, TASK_REWARD_QUEUE } from '../queue/queue.constants';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskEventProcessor } from './task-event.processor';
import { TaskRewardProcessor } from './task-reward.processor';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    QueueModule,
    BullModule.registerQueue(
      { name: TASK_EVENT_QUEUE },
      { name: TASK_REWARD_QUEUE },
    ),
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskEventProcessor,
    TaskRewardProcessor,
  ],
  exports: [TaskService],
})
export class TaskModule {}
