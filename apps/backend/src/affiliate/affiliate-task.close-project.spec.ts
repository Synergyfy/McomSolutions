import { ConflictException } from '@nestjs/common';
import { AffiliateTaskService } from './affiliate-task.service';

function buildHarness() {
  const prisma = {
    affiliateProject: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    businessProfile: { findUnique: jest.fn() },
    affiliateServiceRequest: { update: jest.fn() },
  };

  const service = new AffiliateTaskService(
    prisma as never,
    {} as never,
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

  return { service, prisma };
}

const closeDto = {
  outcomeSummary: 'Delivered the agreed outcome.',
  followUpNotes: 'Check in next month.',
};

describe('AffiliateTaskService.closeProject', () => {
  it('refuses to close while any task is still open', async () => {
    const { service, prisma } = buildHarness();
    prisma.affiliateProject.findFirst.mockResolvedValue({
      id: 'project-1',
      businessId: 'business-1',
      serviceRequestId: null,
      tasks: [{ id: 'task-1', title: 'Deliver flyers', status: 'ASSIGNED' }],
    });
    prisma.businessProfile.findUnique.mockResolvedValue({
      accountManagerId: 'manager-1',
    });

    await expect(
      service.closeProject('manager-1', 'business-1', 'project-1', closeDto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.affiliateProject.update).not.toHaveBeenCalled();
  });

  it('closes when every task is completed or cancelled', async () => {
    const { service, prisma } = buildHarness();
    prisma.affiliateProject.findFirst.mockResolvedValue({
      id: 'project-1',
      businessId: 'business-1',
      serviceRequestId: null,
      tasks: [
        { id: 'task-1', title: 'Deliver flyers', status: 'COMPLETED' },
        { id: 'task-2', title: 'Abandoned route', status: 'CANCELLED' },
      ],
    });
    prisma.businessProfile.findUnique.mockResolvedValue({
      accountManagerId: 'manager-1',
    });
    prisma.affiliateProject.update.mockResolvedValue({
      id: 'project-1',
      status: 'COMPLETED',
    });

    await expect(
      service.closeProject('manager-1', 'business-1', 'project-1', closeDto),
    ).resolves.toEqual({
      project: { id: 'project-1', status: 'COMPLETED' },
      openTasks: 0,
    });
    expect(prisma.affiliateProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('allows an explicit admin force close', async () => {
    const { service, prisma } = buildHarness();
    prisma.affiliateProject.findFirst.mockResolvedValue({
      id: 'project-1',
      businessId: 'business-1',
      serviceRequestId: null,
      tasks: [{ id: 'task-1', title: 'Deliver flyers', status: 'ASSIGNED' }],
    });
    prisma.affiliateProject.update.mockResolvedValue({
      id: 'project-1',
      status: 'COMPLETED',
    });

    await expect(
      service.closeProject('admin-1', 'business-1', 'project-1', closeDto, {
        asAdmin: true,
        force: true,
      }),
    ).resolves.toEqual({
      project: { id: 'project-1', status: 'COMPLETED' },
      openTasks: 1,
    });
  });
});
