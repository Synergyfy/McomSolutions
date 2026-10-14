import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { TASK_REWARD_QUEUE } from '../queue/queue.constants';
import { TaskAssignmentStatus, TaskAudience, Role, TaskSource } from '@prisma/client';

describe('TaskService', () => {
  let service: TaskService;

  const mockRewardQueue = {
    add: jest.fn(),
  };

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
    },
    taskDefinition: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userTaskAssignment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    ssoClient: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback(mockPrisma);
      }
      return Promise.all(callback);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(TASK_REWARD_QUEUE), useValue: mockRewardQueue },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFeatures', () => {
    it('should return available feature keys', () => {
      const result = service.getFeatures();
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((f) => f.key === 'business.logo_uploaded')).toBe(true);
    });
  });

  describe('createTaskDefinition', () => {
    it('should create a task definition and log audit', async () => {
      const dto = {
        title: 'Upload Business Logo',
        description: 'Upload your company logo',
        targetAudience: TaskAudience.BUSINESS,
        featureKey: 'business.logo_uploaded',
        deadlineDays: 7,
        rewardPoints: 50,
      };

      const created = { id: 'task-1', ...dto, isActive: true, platform: 'mcom_central' };
      mockPrisma.taskDefinition.create.mockResolvedValue(created);

      const result = await service.createTaskDefinition(dto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should reject internal tasks without a feature key', async () => {
      await expect(
        service.createTaskDefinition({
          title: 'No trigger',
          description: 'Missing feature key',
          targetAudience: TaskAudience.BUSINESS,
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('Select a platform trigger feature');
    });

    it('should reject internal tasks with an unknown feature key', async () => {
      await expect(
        service.createTaskDefinition({
          title: 'Bad trigger',
          description: 'Unknown key',
          targetAudience: TaskAudience.BUSINESS,
          featureKey: 'made.up_key',
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('Unknown feature key');
    });

    it('should reject external tasks without a console app', async () => {
      await expect(
        service.createTaskDefinition({
          title: 'External thing',
          description: 'Do it over there',
          targetAudience: TaskAudience.BUSINESS,
          taskSource: TaskSource.EXTERNAL,
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('Select an external app');
    });

    it('should reject external tasks that still carry a feature key', async () => {
      await expect(
        service.createTaskDefinition({
          title: 'External thing',
          description: 'Do it over there',
          targetAudience: TaskAudience.BUSINESS,
          taskSource: TaskSource.EXTERNAL,
          featureKey: 'business.logo_uploaded',
          externalClientId: 'mcom-mall',
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('omit the feature key');
    });

    it('should reject external tasks for unregistered apps', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue(null);
      await expect(
        service.createTaskDefinition({
          title: 'External thing',
          description: 'Do it over there',
          targetAudience: TaskAudience.BUSINESS,
          taskSource: TaskSource.EXTERNAL,
          externalClientId: 'ghost-app',
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('not registered in the console');
    });

    it('should create external tasks with a console app snapshot and manual completion', async () => {
      mockPrisma.ssoClient.findUnique.mockResolvedValue({
        clientId: 'mcom-mall',
        name: 'MCOM Mall',
        platformSlug: 'mall',
        appUrl: 'https://mall.example.com',
        isActive: true,
      });
      const created = {
        id: 'task-ext-1',
        title: 'Create your storefront',
        taskSource: TaskSource.EXTERNAL,
        featureKey: null,
        externalClientId: 'mcom-mall',
        platform: 'mall',
      };
      mockPrisma.taskDefinition.create.mockResolvedValue(created);

      const result = await service.createTaskDefinition({
        title: 'Create your storefront',
        description: 'Open MCOM Mall and create your storefront, then mark done here.',
        targetAudience: TaskAudience.BUSINESS,
        taskSource: TaskSource.EXTERNAL,
        externalClientId: 'mcom-mall',
        deadlineDays: 14,
        rewardPoints: 100,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.taskDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskSource: TaskSource.EXTERNAL,
          featureKey: null,
          externalClientId: 'mcom-mall',
          externalAppName: 'MCOM Mall',
          platform: 'mall',
        }),
      });
    });
  });

  describe('assignTask', () => {
    it('should assign a task to eligible users', async () => {
      const taskId = 'task-1';
      const task = {
        id: taskId,
        title: 'Upload Logo',
        targetAudience: TaskAudience.BUSINESS,
        deadlineDays: 7,
        rewardPoints: 50,
      };

      mockPrisma.taskDefinition.findUnique.mockResolvedValue(task);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', role: Role.BUSINESS },
        { id: 'user-2', role: Role.BUSINESS },
      ]);
      mockPrisma.userTaskAssignment.findMany.mockResolvedValue([]);
      mockPrisma.userTaskAssignment.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: `assign-${data.userId}`, ...data }),
      );

      const result = await service.assignTask(taskId, {});
      expect(result.success).toBe(true);
      expect(result.assignedCount).toBe(2);
    });
  });

  describe('updateAssignmentStatus', () => {
    it('should update status and enqueue reward when completed', async () => {
      const assignmentId = 'assign-1';
      const assignment = {
        id: assignmentId,
        userId: 'user-1',
        status: TaskAssignmentStatus.PENDING,
        rewardPoints: 50,
        rewardGranted: false,
        task: { id: 'task-1', title: 'Upload Logo' },
        user: { email: 'test@business.com' },
      };

      mockPrisma.userTaskAssignment.findUnique.mockResolvedValue(assignment);
      mockPrisma.userTaskAssignment.update.mockResolvedValue({
        ...assignment,
        status: TaskAssignmentStatus.COMPLETED,
      });

      const result = await service.updateAssignmentStatus(assignmentId, {
        status: TaskAssignmentStatus.COMPLETED,
        grantReward: true,
      });

      expect(result.success).toBe(true);
      expect(mockRewardQueue.add).toHaveBeenCalledWith(
        'grant-task-reward',
        expect.objectContaining({
          assignmentId,
          userId: 'user-1',
          rewardPoints: 50,
        }),
        expect.any(Object),
      );
    });
  });

  describe('handleNightlyExpiryCheck', () => {
    it('should mark past deadline assignments as EXPIRED', async () => {
      mockPrisma.userTaskAssignment.updateMany.mockResolvedValue({ count: 3 });

      await service.handleNightlyExpiryCheck();
      expect(mockPrisma.userTaskAssignment.updateMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: [TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS],
          },
          deadlineAt: {
            lt: expect.any(Date),
          },
        },
        data: {
          status: TaskAssignmentStatus.EXPIRED,
        },
      });
    });
  });
});
