import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AffiliateTaskService } from './affiliate-task.service';

function buildHarness() {
  const prisma = {
    affiliateProject: { findFirst: jest.fn() },
    affiliateTask: { findUnique: jest.fn() },
  };
  const directory = { getBusinessById: jest.fn() };

  const service = new AffiliateTaskService(
    prisma as never,
    directory as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { get: jest.fn() } as never,
    {} as never,
    undefined,
  );

  return { service, prisma, directory };
}

describe('AffiliateTaskService.createProjectTaskForManager', () => {
  it('rejects a project that is not managed by the caller', async () => {
    const { service, prisma } = buildHarness();
    prisma.affiliateProject.findFirst.mockResolvedValue(null);

    await expect(
      service.createProjectTaskForManager('manager-1', 'project-1', {
        title: 'Design Flyer',
        description: 'Create the campaign flyer.',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.affiliateProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'project-1',
          accountManagerId: 'manager-1',
        }),
      }),
    );
  });

  it('rejects a project whose business is no longer assigned to the caller', async () => {
    const { service, prisma, directory } = buildHarness();
    prisma.affiliateProject.findFirst.mockResolvedValue({
      id: 'project-1',
      businessId: 'business-1',
    });
    directory.getBusinessById.mockResolvedValue({
      id: 'business-1',
      accountManagerId: 'manager-2',
    });

    await expect(
      service.createProjectTaskForManager('manager-1', 'project-1', {
        title: 'Design Flyer',
        description: 'Create the campaign flyer.',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates the task through the standard path and returns the manager view', async () => {
    const { service, prisma, directory } = buildHarness();
    const business = {
      id: 'business-1',
      accountManagerId: 'manager-1',
      businessName: 'Acme Ltd',
    };
    prisma.affiliateProject.findFirst.mockResolvedValue({
      id: 'project-1',
      businessId: 'business-1',
    });
    directory.getBusinessById.mockResolvedValue(business);
    prisma.affiliateTask.findUnique.mockResolvedValue({
      id: 'task-1',
      business: { accountManagerId: 'manager-1' },
    });

    const createTaskForBusiness = jest
      .spyOn(service as never as { createTaskForBusiness: Function }, 'createTaskForBusiness')
      .mockResolvedValue({ id: 'task-1' } as never);

    const result = await service.createProjectTaskForManager(
      'manager-1',
      'project-1',
      {
        title: 'Design Flyer',
        description: 'Create the campaign flyer.',
        assigneeUserId: 'agent-1',
      } as never,
    );

    expect(createTaskForBusiness).toHaveBeenCalledWith(
      business,
      'manager-1',
      expect.objectContaining({
        projectId: 'project-1',
        title: 'Design Flyer',
        assigneeUserId: 'agent-1',
      }),
      'ACCOUNT_MANAGER',
    );
    expect(result).toEqual({ id: 'task-1', business: { accountManagerId: 'manager-1' } });
  });
});
