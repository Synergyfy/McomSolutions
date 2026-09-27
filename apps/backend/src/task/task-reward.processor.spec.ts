import { Test, TestingModule } from '@nestjs/testing';
import { TaskRewardProcessor } from './task-reward.processor';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { TransactionCategory } from '@prisma/client';

describe('TaskRewardProcessor', () => {
  let processor: TaskRewardProcessor;

  const mockWalletService = {
    creditWallet: jest.fn(),
  };

  const mockPrisma = {
    userTaskAssignment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskRewardProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    processor = module.get<TaskRewardProcessor>(TaskRewardProcessor);
  });

  it('should credit wallet and emit notification for eligible assignment', async () => {
    const assignmentId = 'assign-1';
    const userId = 'user-1';
    const rewardPoints = 50;
    const taskTitle = 'Upload Business Logo';

    mockPrisma.userTaskAssignment.findUnique.mockResolvedValue({
      id: assignmentId,
      rewardGranted: false,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      businessProfile: { id: 'biz-1' },
    });
    mockWalletService.creditWallet.mockResolvedValue({ transactionId: 'txn-1' });

    const result = await processor.process({
      id: 'job-reward-1',
      data: { assignmentId, userId, rewardPoints, taskTitle },
    } as any);

    expect(result.rewarded).toBe(true);
    expect(mockWalletService.creditWallet).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'task-engine' }),
      expect.objectContaining({
        userId,
        amount: rewardPoints,
        category: TransactionCategory.REWARD,
      }),
      `task-reward-${assignmentId}`,
    );
    expect(mockPrisma.userTaskAssignment.update).toHaveBeenCalledWith({
      where: { id: assignmentId },
      data: { rewardGranted: true },
    });
    expect(mockPrisma.notification.create).toHaveBeenCalled();
  });

  it('should skip if reward was already granted', async () => {
    mockPrisma.userTaskAssignment.findUnique.mockResolvedValue({
      id: 'assign-already',
      rewardGranted: true,
    });

    const result = await processor.process({
      id: 'job-reward-2',
      data: { assignmentId: 'assign-already', userId: 'user-1', rewardPoints: 50, taskTitle: 'Test' },
    } as any);

    expect(result.rewarded).toBe(false);
    expect(mockWalletService.creditWallet).not.toHaveBeenCalled();
  });
});
