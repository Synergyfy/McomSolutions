import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AffiliateProjectStatus,
  AffiliateTaskCategory,
  AffiliateTaskStatus,
  Role,
} from '@prisma/client';
import { AffiliateTaskService } from './affiliate-task.service';

describe('AffiliateTaskService — createProjectTaskForManager', () => {
  function buildHarness() {
    const prisma = {
      affiliateProject: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      affiliateTask: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      affiliateTaskEvent: {
        create: jest.fn(),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const directory = {
      getBusiness: jest.fn(),
      assertAffiliateUser: jest.fn(),
      assertPlatformsAllowed: jest.fn().mockResolvedValue([]),
    };
    const accountManagers = {
      assignForBusiness: jest.fn(),
    };
    const reputation = {};
    const affiliateClient = {
      createTask: jest.fn().mockResolvedValue({ ok: true, affiliateTaskId: 'aff-task-1' }),
    };
    const settlement = {
      ensureForTask: jest.fn().mockResolvedValue({}),
    };
    const quota = {
      resolve: jest.fn().mockResolvedValue({
        source: 'MEMBERSHIP',
        isFree: true,
        unlimited: true,
        freeLimit: null,
        used: 0,
        periodStart: new Date(),
      }),
    };
    const programmeTasks = {};
    const mail = {
      send: jest.fn().mockResolvedValue({}),
    };
    const config = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    const queue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const service = new AffiliateTaskService(
      prisma as never,
      directory as never,
      accountManagers as never,
      reputation as never,
      affiliateClient as never,
      settlement as never,
      quota as never,
      programmeTasks as never,
      mail as never,
      config as never,
      queue as never,
    );

    return { service, prisma, directory, settlement, quota, queue };
  }

  it('creates a task linked to the managed project and assigns it to the chosen eligible affiliate', async () => {
    const { service, prisma, directory, queue } = buildHarness();

    prisma.affiliateProject.findUnique.mockResolvedValue({
      id: 'proj-1',
      title: 'Storefront Launch',
      status: AffiliateProjectStatus.ACTIVE,
      accountManagerId: 'am-user-1',
      dueAt: new Date('2026-12-15T00:00:00.000Z'),
      requiresBusinessApproval: true,
      business: {
        id: 'biz-1',
        userId: 'biz-owner-1',
        accountManagerId: 'am-user-1',
        deletedAt: null,
      },
    });
    prisma.affiliateProject.findFirst.mockResolvedValue({
      id: 'proj-1',
      accountManagerId: 'am-user-1',
    });

    directory.getBusiness.mockResolvedValue({
      id: 'biz-1',
      userId: 'biz-owner-1',
      businessName: 'Acme Retail',
      email: 'owner@acme.test',
      accountManagerId: 'am-user-1',
      membershipStatus: 'active',
      membershipPlanName: 'Gold',
      membershipExpiresAt: new Date(Date.now() + 86400000),
    });

    directory.assertAffiliateUser.mockResolvedValue({
      id: 'agent-central-1',
      email: 'agent@247gbs.test',
      role: Role.AGENT,
      firstName: 'Ada',
      lastName: 'Agent',
    });

    const createdTask = {
      id: 'task-1',
      businessId: 'biz-1',
      createdByUserId: 'am-user-1',
      projectId: 'proj-1',
      title: 'Upload initial 20 products',
      description: 'Configure categories and upload 20 product listings.',
      category: AffiliateTaskCategory.EXTERNAL,
      status: AffiliateTaskStatus.ASSIGNED,
      assigneeId: 'agent-central-1',
      assigneeRole: Role.AGENT,
      requiresBusinessApproval: true,
    };

    prisma.affiliateTask.create.mockResolvedValue(createdTask);
    prisma.affiliateTask.findFirst.mockResolvedValue(createdTask);

    const result = await service.createProjectTaskForManager('am-user-1', 'proj-1', {
      title: 'Upload initial 20 products',
      description: 'Configure categories and upload 20 product listings.',
      assigneeUserId: 'agent-central-1',
      requiredSkills: ['Catalog', 'Copywriting'],
    });

    expect(directory.assertAffiliateUser).toHaveBeenCalledWith('agent-central-1');
    expect(prisma.affiliateTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          createdByUserId: 'am-user-1',
          projectId: 'proj-1',
          title: 'Upload initial 20 products',
          assigneeId: 'agent-central-1',
          assigneeRole: Role.AGENT,
          status: AffiliateTaskStatus.ASSIGNED,
          requiresBusinessApproval: true,
        }),
      }),
    );
    expect(prisma.affiliateTaskEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: 'task-1',
          actorUserId: 'am-user-1',
          actorRole: 'ACCOUNT_MANAGER',
          type: 'TASK_CREATED',
        }),
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'delegate-task',
      { taskId: 'task-1', action: 'delegate-task' },
      expect.any(Object),
    );
    expect(result.id).toBe('task-1');
  });

  it('keeps the project task unassigned (PENDING_ASSIGNMENT) when the Account Manager does not pick an affiliate yet', async () => {
    const { service, prisma, directory } = buildHarness();

    prisma.affiliateProject.findUnique.mockResolvedValue({
      id: 'proj-1',
      title: 'Storefront Launch',
      status: AffiliateProjectStatus.ACTIVE,
      accountManagerId: 'am-user-1',
      dueAt: null,
      requiresBusinessApproval: false,
      business: {
        id: 'biz-1',
        userId: 'biz-owner-1',
        accountManagerId: 'am-user-1',
        deletedAt: null,
      },
    });
    prisma.affiliateProject.findFirst.mockResolvedValue({
      id: 'proj-1',
      accountManagerId: 'am-user-1',
    });

    directory.getBusiness.mockResolvedValue({
      id: 'biz-1',
      userId: 'biz-owner-1',
      businessName: 'Acme Retail',
      email: 'owner@acme.test',
      accountManagerId: 'am-user-1',
      membershipStatus: 'active',
      membershipPlanName: 'Gold',
      membershipExpiresAt: new Date(Date.now() + 86400000),
    });

    const createdTask = {
      id: 'task-unassigned',
      businessId: 'biz-1',
      createdByUserId: 'am-user-1',
      projectId: 'proj-1',
      title: 'Draft banner copy',
      description: 'Write headline and subheadline for the hero banner.',
      category: AffiliateTaskCategory.EXTERNAL,
      status: AffiliateTaskStatus.PENDING_ASSIGNMENT,
      assigneeId: null,
      assigneeRole: null,
    };

    prisma.affiliateTask.create.mockResolvedValue(createdTask);
    prisma.affiliateTask.findFirst.mockResolvedValue(createdTask);

    await service.createProjectTaskForManager('am-user-1', 'proj-1', {
      title: 'Draft banner copy',
      description: 'Write headline and subheadline for the hero banner.',
    });

    expect(directory.assertAffiliateUser).not.toHaveBeenCalled();
    expect(prisma.affiliateTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          assigneeId: null,
          status: AffiliateTaskStatus.PENDING_ASSIGNMENT,
        }),
      }),
    );
  });

  it('rejects task creation when the caller is not the Account Manager for the project', async () => {
    const { service, prisma } = buildHarness();

    prisma.affiliateProject.findUnique.mockResolvedValue({
      id: 'proj-1',
      status: AffiliateProjectStatus.ACTIVE,
      accountManagerId: 'am-user-1',
      business: {
        id: 'biz-1',
        userId: 'biz-owner-1',
        accountManagerId: 'am-user-1',
        deletedAt: null,
      },
    });

    await expect(
      service.createProjectTaskForManager('other-am-user', 'proj-1', {
        title: 'Unauthorized task',
        description: 'Should not be permitted.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects task creation on a closed project or missing project', async () => {
    const { service, prisma } = buildHarness();

    prisma.affiliateProject.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createProjectTaskForManager('am-user-1', 'missing-proj', {
        title: 'Task',
        description: 'Task description',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.affiliateProject.findUnique.mockResolvedValueOnce({
      id: 'proj-closed',
      status: AffiliateProjectStatus.COMPLETED,
      accountManagerId: 'am-user-1',
      business: {
        id: 'biz-1',
        userId: 'biz-owner-1',
        accountManagerId: 'am-user-1',
        deletedAt: null,
      },
    });
    await expect(
      service.createProjectTaskForManager('am-user-1', 'proj-closed', {
        title: 'Task on closed project',
        description: 'Should fail because project is completed.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

