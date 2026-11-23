import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardOverview from './DashboardOverview';

const { profileMock } = vi.hoisted(() => ({ profileMock: vi.fn() }));

vi.mock('../services/business/hooks', () => ({
  useProfile: () => profileMock(),
  useMyTasks: () => ({ data: { data: [], meta: {} }, isLoading: false }),
  useStartMyTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCompleteMyTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMyProgramme: () => ({ data: { data: {} } }),
  useCompleteMission: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProgrammePhases: () => ({ data: { data: [] } }),
  useUploadBusinessFile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAccountManager: () => ({ data: null }),
  usePlatformAccess: () => ({ data: null }),
  useCreateAffiliateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePauseMyProgramme: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResumeMyProgramme: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('./ProgrammeCountdown', () => ({
  default: () => <span data-testid="programme-countdown" />,
}));

describe('DashboardOverview membership badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the live profile membership instead of the stale cached session', () => {
    localStorage.setItem(
      'business_user',
      JSON.stringify({ membership: 'Bronze Standard', businessName: 'Cached Co' }),
    );
    profileMock.mockReturnValue({
      data: {
        businessName: 'Acme Ltd',
        membershipLevel: 'Platinum',
        membershipTier: 'ProPlus',
        membershipStatus: 'active',
      },
    });

    render(<DashboardOverview />);

    expect(screen.getByText('Platinum ProPlus')).toBeInTheDocument();
    expect(screen.queryByText('Bronze Standard')).not.toBeInTheDocument();
  });

  it('falls back to the cached session only when the profile has no membership', () => {
    localStorage.setItem(
      'business_user',
      JSON.stringify({ membershipLevel: 'Silver', membershipTier: 'Pro', businessName: 'Cached Co' }),
    );
    profileMock.mockReturnValue({ data: { businessName: 'Cached Co' } });

    render(<DashboardOverview />);

    expect(screen.getByText('Silver Pro')).toBeInTheDocument();
  });
});
