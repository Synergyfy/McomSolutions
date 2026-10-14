import { Test, TestingModule } from '@nestjs/testing';
import { TaskEventProcessor } from './task-event.processor';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { TASK_REWARD_QUEUE } from '../queue/queue.constants';
import { TaskAssignmentStatus } from '@prisma/client';

describe('TaskEventProcessor', () => {
  let processor: TaskEventProcessor;

  const mockRewardQueue = {
    add: jest.fn(),
  };

  const mockPrisma = {
    userTaskAssignment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskEventProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(TASK_REWARD_QUEUE), useValue: mockRewardQueue },
      ],
    }).compile();

    processor = module.get<TaskEventProcessor>(TaskEventProcessor);
  });

  it('should complete task within deadline and queue reward', async () => {
    const futureDeadline = new Date(Date.now() + 86400000 * 5);
    const mockAssignment = {
      id: 'assign-1',
      userId: 'user-1',
      rewardPoints: 50,
      rewardGranted: false,
      deadlineAt: futureDeadline,
      task: { title: 'Upload Business Logo' },
    };

    mockPrisma.userTaskAssignment.findMany.mockResolvedValue([mockAssignment]);
    mockPrisma.userTaskAssignment.update.mockResolvedValue({
      ...mockAssignment,
      status: TaskAssignmentStatus.COMPLETED,
    });

    const result = await processor.process({
      id: 'job-1',
      data: {
        userId: 'user-1',
        userType: 'BUSINESS',
        featureKey: 'business.logo_uploaded',
      },
    } as any);

    expect(result.completed).toBe(1);
    expect(mockPrisma.userTaskAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          task: expect.objectContaining({ featureKey: 'business.logo_uploaded', taskSource: 'INTERNAL' }),
        }),
      }),
    );
    expect(mockPrisma.userTaskAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'assign-1' },
        data: expect.objectContaining({ status: TaskAssignmentStatus.COMPLETED }),
      }),
    );
    expect(mockRewardQueue.add).toHaveBeenCalledWith(
      'grant-task-reward',
      expect.objectContaining({
        assignmentId: 'assign-1',
        userId: 'user-1',
        rewardPoints: 50,
      }),
      expect.any(Object),
    );
  });

  it('should mark task as EXPIRED if deadline passed', async () => {
    const pastDeadline = new Date(Date.now() - 86400000 * 2);
    const mockAssignment = {
      id: 'assign-expired',
      userId: 'user-1',
      rewardPoints: 50,
      rewardGranted: false,
      deadlineAt: pastDeadline,
      task: { title: 'Upload Business Logo' },
    };

    mockPrisma.userTaskAssignment.findMany.mockResolvedValue([mockAssignment]);
    mockPrisma.userTaskAssignment.update.mockResolvedValue({
      ...mockAssignment,
      status: TaskAssignmentStatus.EXPIRED,
    });

    const result = await processor.process({
      id: 'job-2',
      data: {
        userId: 'user-1',
        userType: 'BUSINESS',
        featureKey: 'business.logo_uploaded',
      },
    } as any);

    expect(result.expired).toBe(1);
    expect(result.completed).toBe(0);
    expect(mockRewardQueue.add).not.toHaveBeenCalled();
  });
});
