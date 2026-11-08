import { AffiliateBusinessController } from './affiliate-business.controller';

function buildHarness() {
  const directory = { getBusiness: jest.fn() };
  const assignment = {
    getAssignedAccountManager: jest.fn(),
    assignForBusiness: jest.fn(),
  };
  const tasks = {};
  const quota = {};

  const controller = new AffiliateBusinessController(
    directory as never,
    assignment as never,
    tasks as never,
    quota as never,
  );

  return { controller, directory, assignment };
}

const req = { user: { userId: 'user-1', businessId: 'business-1' } };
const business = {
  id: 'business-1',
  membershipStatus: 'active',
  membershipPlanName: 'Gold',
  membershipExpiresAt: new Date('2030-01-01'),
};

describe('AffiliateBusinessController.getAccountManager', () => {
  it('lazily assigns a manager for a paid active business with none', async () => {
    const { controller, directory, assignment } = buildHarness();
    directory.getBusiness.mockResolvedValue(business);
    assignment.getAssignedAccountManager.mockResolvedValue(null);
    assignment.assignForBusiness.mockResolvedValue({ userId: 'manager-1' });

    const result = await controller.getAccountManager(req);

    expect(assignment.assignForBusiness).toHaveBeenCalledWith('business-1', {
      notify: false,
    });
    expect(result).toEqual({
      success: true,
      data: { userId: 'manager-1' },
      meta: {
        assignable: false,
        membershipStatus: 'active',
        membershipPlanName: 'Gold',
      },
    });
  });

  it('returns a clean null response when lazy assignment fails', async () => {
    const { controller, directory, assignment } = buildHarness();
    directory.getBusiness.mockResolvedValue(business);
    assignment.getAssignedAccountManager.mockResolvedValue(null);
    assignment.assignForBusiness.mockRejectedValue(new Error('no managers'));

    const result = await controller.getAccountManager(req);

    expect(result).toEqual({
      success: true,
      data: null,
      meta: {
        assignable: true,
        membershipStatus: 'active',
        membershipPlanName: 'Gold',
      },
    });
  });
});
