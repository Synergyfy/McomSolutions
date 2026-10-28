import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { TASK_REWARD_QUEUE } from '../queue/queue.constants';
import { TaskAssignmentStatus, TaskAccessScope, TaskAudience, Role, TaskSource, TaskSubmissionType } from '@prisma/client';

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
      groupBy: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
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

    it('should require a destination link for internal external-link tasks', async () => {
      await expect(
        service.createTaskDefinition({
          title: 'Read the growth guide',
          description: 'Open the guide and confirm',
          targetAudience: TaskAudience.BUSINESS,
          submissionType: TaskSubmissionType.EXTERNAL_LINK,
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('Add the destination link');
    });

    it('should store the admin link for internal external-link tasks', async () => {
      const created = {
        id: 'task-link-1',
        title: 'Read the growth guide',
        taskSource: TaskSource.INTERNAL,
        submissionType: TaskSubmissionType.EXTERNAL_LINK,
        actionUrl: 'https://example.com/guide',
        featureKey: null,
        platform: 'mcom_central',
      };
      mockPrisma.taskDefinition.create.mockResolvedValue(created);

      const result = await service.createTaskDefinition({
        title: 'Read the growth guide',
        description: 'Open the guide and confirm',
        targetAudience: TaskAudience.BUSINESS,
        submissionType: TaskSubmissionType.EXTERNAL_LINK,
        actionUrl: 'https://example.com/guide',
        actionLabel: 'Open the guide',
        deadlineDays: 7,
        rewardPoints: 10,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.taskDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskSource: TaskSource.INTERNAL,
          submissionType: TaskSubmissionType.EXTERNAL_LINK,
          actionUrl: 'https://example.com/guide',
          actionLabel: 'Open the guide',
          featureKey: null,
          externalClientId: null,
        }),
      });
    });

    it('should reject trial-only access for customer tasks', async () => {
      await expect(
        service.createTaskDefinition({
          title: 'Customer mission',
          description: 'Customer only',
          targetAudience: TaskAudience.CUSTOMER,
          accessScope: TaskAccessScope.TRIAL,
          submissionType: TaskSubmissionType.TEXT_INPUT,
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('Customers never resolve as trial users');
    });

    it('should reject a business trigger for customer tasks', async () => {
      await expect(
        service.createTaskDefinition({
          title: 'Customer mission',
          description: 'Customer only',
          targetAudience: TaskAudience.CUSTOMER,
          featureKey: 'business.logo_uploaded',
          deadlineDays: 7,
          rewardPoints: 10,
        }),
      ).rejects.toThrow('only applies to business users');
    });

    it('should accept a customer trigger for customer tasks', async () => {
      mockPrisma.taskDefinition.create.mockResolvedValue({
        id: 'task-customer-1',
        platform: 'mcom_central',
      });

      const result = await service.createTaskDefinition({
        title: 'Complete your customer profile',
        description: 'Finish your account details',
        targetAudience: TaskAudience.CUSTOMER,
        accessScope: TaskAccessScope.PAID,
        featureKey: 'customer.profile_completed',
        deadlineDays: 7,
        rewardPoints: 10,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.taskDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetAudience: TaskAudience.CUSTOMER,
          accessScope: TaskAccessScope.PAID,
          featureKey: 'customer.profile_completed',
        }),
      });
    });
  });

  describe('updateTaskDefinition (audience capabilities)', () => {
    const buildExistingCustomerTask = () => ({
      id: 'task-1',
      title: 'Customer mission',
      description: 'Customer only',
      targetAudience: TaskAudience.CUSTOMER,
      accessScope: TaskAccessScope.ALL,
      submissionType: TaskSubmissionType.AUTO,
      featureKey: 'customer.profile_completed',
      taskSource: TaskSource.INTERNAL,
      externalClientId: null,
      actionUrl: null,
      actionLabel: null,
      rewardCouponPlans: [],
      rewardCouponAccessPlans: [],
    });

    it('should reject a trigger that does not match the task audience', async () => {
      mockPrisma.taskDefinition.findUnique.mockResolvedValue(buildExistingCustomerTask());

      await expect(
        service.updateTaskDefinition('task-1', { featureKey: 'business.logo_uploaded' }),
      ).rejects.toThrow('only applies to business users');
    });

    it('should reject trial-only access on customer tasks', async () => {
      mockPrisma.taskDefinition.findUnique.mockResolvedValue(buildExistingCustomerTask());

      await expect(
        service.updateTaskDefinition('task-1', { accessScope: TaskAccessScope.TRIAL }),
      ).rejects.toThrow('Customers never resolve as trial users');
    });
  });

  describe('completeMyTask (link tasks)', () => {
    const buildLinkAssignment = (status: TaskAssignmentStatus) => ({
      id: 'assign-link-1',
      userId: 'user-1',
      status,
      deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      rewardPoints: 0,
      rewardGranted: false,
      submissionData: null,
      task: {
        id: 'task-link-1',
        title: 'Read the growth guide',
        submissionType: TaskSubmissionType.EXTERNAL_LINK,
        actionUrl: 'https://example.com/guide',
        featureKey: null,
        rewardCouponEnabled: false,
      },
      user: { businessProfile: null },
    });

    it('should require the user to open the link before completing', async () => {
      mockPrisma.userTaskAssignment.findUnique.mockResolvedValue(
        buildLinkAssignment(TaskAssignmentStatus.PENDING),
      );

      await expect(service.completeMyTask('assign-link-1', 'user-1')).rejects.toThrow(
        'Open the task link',
      );
    });

    it('should complete once the link has been opened', async () => {
      mockPrisma.userTaskAssignment.findUnique.mockResolvedValue(
        buildLinkAssignment(TaskAssignmentStatus.IN_PROGRESS),
      );
      mockPrisma.userTaskAssignment.update.mockResolvedValue({
        id: 'assign-link-1',
        status: TaskAssignmentStatus.COMPLETED,
      });

      const result = await service.completeMyTask('assign-link-1', 'user-1', {
        submissionData: {
          actionUrl: 'https://example.com/guide',
          openedAt: new Date().toISOString(),
        },
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.userTaskAssignment.update).toHaveBeenCalledWith({
        where: { id: 'assign-link-1' },
        data: expect.objectContaining({
          status: TaskAssignmentStatus.COMPLETED,
          submissionData: expect.objectContaining({
            actionUrl: 'https://example.com/guide',
          }),
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

  describe('getProgrammeUsersProgress', () => {
    it('rolls up per-user task counts and treats overdue open tasks as expired', async () => {
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'owner@acme.test',
          firstName: 'Ada',
          lastName: 'Obi',
          role: Role.BUSINESS,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          businessProfile: {
            businessName: 'Acme Ltd',
            logoUrl: null,
            category: 'Retail',
            membershipLevel: 'Bronze',
            membershipTier: 'Normal',
            membershipStatus: 'active',
          },
          customerProfile: null,
        },
      ]);
      mockPrisma.userTaskAssignment.groupBy
        .mockResolvedValueOnce([
          { status: TaskAssignmentStatus.COMPLETED, _count: { _all: 2 } },
          { status: TaskAssignmentStatus.PENDING, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-1', status: TaskAssignmentStatus.COMPLETED, _count: { _all: 2 } },
          { userId: 'user-1', status: TaskAssignmentStatus.PENDING, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([{ userId: 'user-1', _count: { _all: 1 } }]);
      mockPrisma.userTaskAssignment.count.mockResolvedValue(1);

      const result = await service.getProgrammeUsersProgress({ role: 'ALL', page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'user-1',
        name: 'Acme Ltd',
        completed: 2,
        pending: 1,
        expired: 1,
        overdue: 1,
        outstanding: 0,
        totalTasks: 3,
        progress: 67,
      });
      expect(result.summary).toMatchObject({ completed: 2, pending: 1, overdue: 1, outstanding: 0 });
    });
  });

  describe('getProgrammeUserTasks', () => {
    it('returns the task breakdown and marks past-deadline open tasks as expired', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'owner@acme.test',
        firstName: 'Ada',
        lastName: 'Obi',
        role: Role.BUSINESS,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        businessProfile: {
          businessName: 'Acme Ltd',
          logoUrl: null,
          category: 'Retail',
          membershipLevel: 'Bronze',
          membershipTier: 'Normal',
          membershipStatus: 'active',
        },
        customerProfile: null,
      });
      mockPrisma.userTaskAssignment.findMany.mockResolvedValue([
        {
          id: 'assignment-1',
          taskId: 'task-1',
          userId: 'user-1',
          status: TaskAssignmentStatus.PENDING,
          assignedAt: new Date('2026-01-01T00:00:00.000Z'),
          deadlineAt: new Date('2026-01-02T00:00:00.000Z'),
          completedAt: null,
          rewardGranted: false,
          rewardPoints: 50,
          task: {
            title: 'Upload logo',
            description: 'Add your logo',
            featureKey: 'business.logo_uploaded',
            taskSource: TaskSource.INTERNAL,
            platform: 'mcom_central',
            externalAppName: null,
            submissionType: TaskSubmissionType.AUTO,
            actionUrl: null,
            actionLabel: null,
            deadlineDays: 7,
            rewardCouponEnabled: false,
          },
          rewardCoupon: null,
        },
        {
          id: 'assignment-2',
          taskId: 'task-2',
          userId: 'user-1',
          status: TaskAssignmentStatus.COMPLETED,
          assignedAt: new Date('2026-01-01T00:00:00.000Z'),
          deadlineAt: new Date('2026-01-05T00:00:00.000Z'),
          completedAt: new Date('2026-01-03T00:00:00.000Z'),
          rewardGranted: true,
          rewardPoints: 30,
          task: {
            title: 'Link socials',
            description: 'Connect social accounts',
            featureKey: 'business.social_linked',
            taskSource: TaskSource.INTERNAL,
            platform: 'mcom_central',
            externalAppName: null,
            submissionType: TaskSubmissionType.AUTO,
            actionUrl: null,
            actionLabel: null,
            deadlineDays: 7,
            rewardCouponEnabled: false,
          },
          rewardCoupon: null,
        },
      ]);

      const result = await service.getProgrammeUserTasks('user-1');

      expect(result.user).toMatchObject({ id: 'user-1', name: 'Acme Ltd' });
      expect(result.data[0].status).toBe(TaskAssignmentStatus.EXPIRED);
      expect(result.data[1].status).toBe(TaskAssignmentStatus.COMPLETED);
      expect(result.summary).toMatchObject({
        total: 2,
        completed: 1,
        expired: 1,
        pending: 0,
        outstanding: 0,
        progress: 50,
      });
    });

    it('throws when the user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProgrammeUserTasks('missing')).rejects.toThrow('User not found');
    });
  });
});
