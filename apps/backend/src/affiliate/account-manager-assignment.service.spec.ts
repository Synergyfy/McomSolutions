import { AccountManagerAssignmentService } from './account-manager-assignment.service';

function buildHarness() {
  const tx = {
    businessProfile: { update: jest.fn().mockResolvedValue({}) },
    accountManagerProfile: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    affiliateServiceRequest: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    affiliateProject: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    businessProfile: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    accountManagerProfile: { findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) =>
      callback(tx),
    ),
  };

  const directory = {};
  const reputation = { getSummary: jest.fn() };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const chat = {
    getOrCreateDirectConversation: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
  };
  const config = { get: jest.fn() };
  const acquisition = {
    recordAccountManagerChange: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AccountManagerAssignmentService(
    prisma as never,
    directory as never,
    reputation as never,
    mail as never,
    chat as never,
    config as never,
    acquisition as never,
  );

  return { service, prisma, tx, chat, acquisition };
}

describe('AccountManagerAssignmentService.assignForBusiness', () => {
  it('moves open requests and projects to the newly assigned manager', async () => {
    const { service, prisma, tx } = buildHarness();
    prisma.businessProfile.findFirst.mockResolvedValue({
      id: 'business-1',
      accountManagerId: 'manager-1',
      accountManagerAssignedAt: new Date('2026-01-01'),
      businessName: 'Acme Ltd',
      email: 'owner@acme.test',
      userId: 'business-user-1',
      cityId: null,
      boroughId: null,
      highStreetId: null,
      localMallId: null,
      postcode: 'SW1A 1AA',
      user: {
        id: 'business-user-1',
        email: 'owner@acme.test',
        firstName: 'Acme',
        lastName: 'Owner',
      },
    });
    prisma.accountManagerProfile.findMany.mockResolvedValue([
      {
        id: 'profile-2',
        userId: 'manager-2',
        cityId: null,
        boroughId: null,
        highStreetId: null,
        localMallId: null,
        postcode: null,
        reputationScore: 10,
        experienceScore: 5,
        completedTasksCount: 2,
        assignedBusinesses: 1,
        status: 'Active',
        user: {
          id: 'manager-2',
          email: 'manager@acme.test',
          firstName: 'New',
          lastName: 'Manager',
        },
      },
    ]);
    jest
      .spyOn(service, 'getAssignedAccountManager')
      .mockResolvedValue({ userId: 'manager-2' } as never);

    await service.assignForBusiness('business-1', {
      force: true,
      notify: false,
    });

    expect(tx.affiliateServiceRequest.updateMany).toHaveBeenCalledWith({
      where: {
        businessId: 'business-1',
        status: {
          in: [
            'SUBMITTED',
            'CLARIFICATION_REQUIRED',
            'QUOTED',
            'APPROVED',
            'CONVERTED',
          ],
        },
      },
      data: { accountManagerId: 'manager-2' },
    });
    expect(tx.affiliateProject.updateMany).toHaveBeenCalledWith({
      where: {
        businessId: 'business-1',
        status: {
          in: ['ACTIVE', 'ON_HOLD', 'AWAITING_BUSINESS_APPROVAL'],
        },
      },
      data: { accountManagerId: 'manager-2' },
    });
  });
});
