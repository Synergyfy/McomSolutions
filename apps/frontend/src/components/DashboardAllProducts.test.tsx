import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardAllProducts from './DashboardAllProducts';

const {
  appsMock,
  refetchMock,
  profileMock,
  currentUserMock,
  accessPlansMock,
  purchasesMock,
  membershipPlansMock,
  policyMock,
} = vi.hoisted(() => ({
  appsMock: vi.fn(),
  refetchMock: vi.fn(),
  profileMock: vi.fn(),
  currentUserMock: vi.fn(),
  accessPlansMock: vi.fn(),
  purchasesMock: vi.fn(),
  membershipPlansMock: vi.fn(),
  policyMock: vi.fn(),
}));

vi.mock('../services/business/hooks', () => ({
  useEcosystemApps: () => appsMock(),
  useProfile: () => profileMock(),
  useProgrammeAccessPolicy: () => policyMock(),
}));

vi.mock('../services/auth/hooks', () => ({
  useCurrentUser: () => currentUserMock(),
  useGetSsoToken: () => ({ mutateAsync: vi.fn() }),
  usePostSsoAuthorize: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../services/access/hooks', () => ({
  useAccessPlans: () => accessPlansMock(),
  useAccessPurchases: () => purchasesMock(),
}));

vi.mock('../services/pricing/hooks', () => ({
  usePlans: () => membershipPlansMock(),
}));

const mallApp = {
  id: '1',
  clientId: 'mcom-mall',
  name: 'MCOM Mall',
  description: 'Marketplace for local businesses.',
  appUrl: 'https://mall.example.test',
  platformSlug: 'mall',
  isActive: true,
  isSystemApp: false,
  serviceScopes: [],
  redirectUris: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const rewardsApp = {
  ...mallApp,
  id: '2',
  clientId: 'mcom-rewards',
  name: 'MCOM Rewards',
  description: 'Loyalty and rewards campaigns.',
  appUrl: 'https://rewards.example.test',
  platformSlug: 'rewards',
};

const dayMs = 24 * 60 * 60 * 1000;
const future = new Date(Date.now() + 30 * dayMs).toISOString();

function renderDirectory() {
  return render(
    <MemoryRouter>
      <DashboardAllProducts />
    </MemoryRouter>,
  );
}

function useDirectoryResults(apps: unknown[] = [mallApp, rewardsApp]) {
  appsMock.mockReturnValue({
    data: apps,
    isLoading: false,
    isError: false,
    refetch: refetchMock,
    isFetching: false,
  });
  accessPlansMock.mockReturnValue({ data: { data: [] }, isLoading: false });
  purchasesMock.mockReturnValue({ data: { data: [] }, isLoading: false });
  membershipPlansMock.mockReturnValue({ data: [], isLoading: false });
  policyMock.mockReturnValue({ data: {}, isLoading: false });
  profileMock.mockReturnValue({ data: null, isLoading: false });
  currentUserMock.mockReturnValue({ data: null, isLoading: false });
}

describe('DashboardAllProducts directory states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows the error state with a retry action when the directory fails', () => {
    useDirectoryResults([]);
    appsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      isFetching: false,
    });

    renderDirectory();

    expect(screen.getByText('Failed to load platform directory')).toBeInTheDocument();
    expect(
      screen.getByText('Could not communicate with the application directory service.'),
    ).toBeInTheDocument();
  });

  it('retry calls refetch', () => {
    useDirectoryResults([]);
    appsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchMock,
      isFetching: false,
    });

    renderDirectory();
    screen.getByRole('button', { name: /try again|retry|refresh/i }).click();

    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardAllProducts access-aware sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('business_user', JSON.stringify({ role: 'BUSINESS' }));
  });

  it('shows only products covered by the active membership and suggests options for the rest', () => {
    useDirectoryResults();
    currentUserMock.mockReturnValue({ data: { role: 'BUSINESS' }, isLoading: false });
    profileMock.mockReturnValue({
      data: {
        businessName: 'Acme Ltd',
        membershipLevel: 'Gold',
        membershipPlanName: 'Gold',
        membershipStatus: 'active',
        membershipExpiresAt: future,
        createdAt: '2026-01-01T00:00:00.000Z',
        packages: [],
      },
      isLoading: false,
    });
    membershipPlansMock.mockReturnValue({
      data: [
        {
          id: 'gold',
          planId: 'gold',
          name: 'Gold',
          monthlyPrice: 99,
          platformAccess: ['Mall'],
        },
      ],
      isLoading: false,
    });
    accessPlansMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'pass-rewards',
            name: 'Rewards Booster',
            description: 'Unlock rewards tools',
            price: 39,
            durationDays: 90,
            features: [],
            archived: false,
            appBundles: [{ platform: 'MCOM Rewards', packageName: 'Rewards Standard' }],
          },
        ],
      },
      isLoading: false,
    });

    renderDirectory();

    expect(screen.getByRole('heading', { name: 'Your products' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Unlock more products' })).toBeInTheDocument();
    expect(screen.getByText('MCOM Mall')).toBeInTheDocument();
    expect(screen.getByText('MCOM Rewards')).toBeInTheDocument();
    expect(screen.getByText('Gold membership')).toBeInTheDocument();
    expect(screen.getByText('Rewards Booster')).toBeInTheDocument();
    expect(screen.getByText('Access pass · £39 · 90 days')).toBeInTheDocument();
  });

  it('treats an active programme trial as access to MCOM products', () => {
    useDirectoryResults();
    currentUserMock.mockReturnValue({ data: { role: 'BUSINESS' }, isLoading: false });
    profileMock.mockReturnValue({
      data: {
        businessName: 'Acme Ltd',
        membershipLevel: 'Bronze',
        membershipStatus: 'active',
        membershipPlanName: null,
        hasPaidVerificationFee: true,
        trialAccessExpiresAt: future,
        createdAt: '2026-01-01T00:00:00.000Z',
        packages: [],
      },
      isLoading: false,
    });

    renderDirectory();

    expect(screen.queryAllByText('MCOM Mall').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('MCOM Rewards').length).toBeGreaterThan(0);
    expect(screen.getByText(/already have access to every product/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Programme trial active/i).length).toBeGreaterThan(0);
  });

  it('unlocks products covered by an active access pass', () => {
    useDirectoryResults();
    currentUserMock.mockReturnValue({ data: { role: 'BUSINESS' }, isLoading: false });
    profileMock.mockReturnValue({
      data: {
        businessName: 'Acme Ltd',
        membershipLevel: 'Bronze',
        membershipStatus: 'active',
        membershipPlanName: null,
        packages: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
    });
    purchasesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'purchase-1',
            accessPlanId: 'pass-rewards',
            accessPlanName: 'Rewards Booster',
            durationDays: 90,
            amount: 39,
            currency: 'GBP',
            status: 'ACTIVE',
            startsAt: new Date().toISOString(),
            expiresAt: future,
            accessPlan: {
              id: 'pass-rewards',
              name: 'Rewards Booster',
              description: 'Unlock rewards tools',
              price: 39,
              durationDays: 90,
              features: [],
              archived: false,
              appBundles: [{ platform: 'MCOM Rewards', packageName: 'Rewards Standard' }],
            },
          },
        ],
      },
      isLoading: false,
    });

    renderDirectory();

    expect(screen.getByText('Access pass: Rewards Booster')).toBeInTheDocument();
    expect(
      screen.getAllByText(/1 active access pass covering your products/i).length,
    ).toBeGreaterThan(0);
    // Mall has no membership/pass, so it remains in the unlock section.
    expect(screen.getByText('Unlock more products')).toBeInTheDocument();
  });
});
