import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

const { profileMock } = vi.hoisted(() => ({ profileMock: vi.fn() }));

vi.mock('../services/business/hooks', () => ({
  useProfile: () => profileMock(),
}));

vi.mock('../services/auth/hooks', () => ({
  useLogout: () => vi.fn(),
}));

vi.mock('../services/api', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: { data: {} } }) },
}));

vi.mock('../components/CHSLogo', () => ({ default: () => null }));
vi.mock('../components/DashboardOverview', () => ({ default: () => <div>overview-page</div> }));
vi.mock('../components/DashboardAllProducts', () => ({ default: () => <div>products-page</div> }));
vi.mock('../components/DashboardAccess', () => ({ default: () => <div>access-page</div> }));
vi.mock('../components/DashboardAccessPasses', () => ({ default: () => <div>access-passes-page</div> }));
vi.mock('../components/DashboardNotifications', () => ({ default: () => <div>notifications-page</div> }));
vi.mock('../components/DashboardMessages', () => ({ default: () => <div>messages-page</div> }));
vi.mock('../components/DashboardMemberships', () => ({ default: () => <div>memberships-page</div> }));
vi.mock('../components/DashboardCoupons', () => ({ default: () => <div>coupons-page</div> }));
vi.mock('../components/DashboardBilling', () => ({ default: () => <div>billing-page</div> }));
vi.mock('../components/DashboardWallet', () => ({ default: () => <div>wallet-page</div> }));
vi.mock('../components/DashboardBusinessProfile', () => ({ default: () => <div>business-profile-page</div> }));
vi.mock('../components/DashboardReferrals', () => ({ default: () => <div>referrals-page</div> }));
vi.mock('../components/DashboardSupport', () => ({ default: () => <div>support-page</div> }));
vi.mock('../components/DashboardSettings', () => ({ default: () => <div>settings-page</div> }));
vi.mock('../components/FirstDashboardWelcome', () => ({ default: () => <div>first-welcome</div> }));
vi.mock('../components/payment/VerificationPaymentModal', () => ({ default: () => null }));

const dayMs = 24 * 60 * 60 * 1000;

const expiredProfile = {
  businessName: 'Acme Ltd',
  email: 'owner@acme.test',
  membershipLevel: 'Bronze',
  membershipStatus: 'expired',
  membershipExpiresAt: null,
  hasPaidVerificationFee: true,
  trialAccessExpiresAt: new Date(Date.now() - dayMs).toISOString(),
  createdAt: new Date(Date.now() - 30 * dayMs).toISOString(),
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard trial-expired gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('auth_token', 'test-token');
    profileMock.mockReturnValue({ data: expiredProfile, refetch: vi.fn() });
  });

  it('blocks regular dashboard pages when the access period has expired', async () => {
    renderAt('/dashboard');
    expect(await screen.findByText('Your Access Has Expired')).toBeInTheDocument();
  });

  it('gates businesses that never had an active trial, membership, or access pass', async () => {
    profileMock.mockReturnValue({
      data: { ...expiredProfile, trialAccessExpiresAt: null, packages: [] },
      refetch: vi.fn(),
    });
    renderAt('/dashboard');
    expect(await screen.findByText('Your Access Has Expired')).toBeInTheDocument();
  });

  it('lets expired businesses open the memberships page without the blocking modal', async () => {
    renderAt('/dashboard/memberships');
    expect(
      await screen.findByText(/You don't have an active trial, membership, or access pass/i)
    ).toBeInTheDocument();
    expect(screen.getByText('memberships-page')).toBeInTheDocument();
    expect(screen.queryByText('Your Access Has Expired')).not.toBeInTheDocument();
  });

  it('lets expired businesses open the access passes page without the blocking modal', async () => {
    renderAt('/dashboard/access-passes');
    expect(
      await screen.findByText(/You don't have an active trial, membership, or access pass/i)
    ).toBeInTheDocument();
    expect(screen.getByText('access-passes-page')).toBeInTheDocument();
    expect(screen.queryByText('Your Access Has Expired')).not.toBeInTheDocument();
  });

  it('does not gate businesses holding an active access pass', () => {
    profileMock.mockReturnValue({
      data: {
        ...expiredProfile,
        packages: [
          {
            id: 'pkg-1',
            platform: 'MCOM Mall',
            planType: 'ACCESS',
            status: 'active',
            expiresAt: new Date(Date.now() + 7 * dayMs).toISOString(),
          },
        ],
      },
      refetch: vi.fn(),
    });
    renderAt('/dashboard');
    expect(screen.queryByText('Your Access Has Expired')).not.toBeInTheDocument();
    expect(screen.getByText('overview-page')).toBeInTheDocument();
  });

  it('gates businesses whose access pass has also expired', async () => {
    profileMock.mockReturnValue({
      data: {
        ...expiredProfile,
        packages: [
          {
            id: 'pkg-1',
            platform: 'MCOM Mall',
            planType: 'ACCESS',
            status: 'active',
            expiresAt: new Date(Date.now() - dayMs).toISOString(),
          },
        ],
      },
      refetch: vi.fn(),
    });
    renderAt('/dashboard');
    expect(await screen.findByText('Your Access Has Expired')).toBeInTheDocument();
  });

  it('does not gate businesses with an active membership', () => {
    profileMock.mockReturnValue({
      data: {
        ...expiredProfile,
        membershipLevel: 'Gold',
        membershipStatus: 'active',
        membershipExpiresAt: new Date(Date.now() + 30 * dayMs).toISOString(),
      },
      refetch: vi.fn(),
    });
    renderAt('/dashboard');
    expect(screen.queryByText('Your Access Has Expired')).not.toBeInTheDocument();
  });

  it('does not gate businesses that are still inside their trial window', () => {
    profileMock.mockReturnValue({
      data: {
        ...expiredProfile,
        trialAccessExpiresAt: new Date(Date.now() + 3 * dayMs).toISOString(),
      },
      refetch: vi.fn(),
    });
    renderAt('/dashboard');
    expect(screen.queryByText('Your Access Has Expired')).not.toBeInTheDocument();
  });
});
