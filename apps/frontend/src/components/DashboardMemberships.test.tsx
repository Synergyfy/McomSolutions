import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardMemberships from './DashboardMemberships';

const { profileMock, transactionsMock, pricingMock } = vi.hoisted(() => ({
  profileMock: vi.fn(),
  transactionsMock: vi.fn(),
  pricingMock: vi.fn(),
}));

vi.mock('../services/business/hooks', () => ({
  useProfile: () => profileMock(),
}));

vi.mock('../services/pricing/hooks', () => ({
  useTransactions: () => transactionsMock(),
  useSubscribeMembership: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../context/PricingContext', () => ({
  usePricing: () => pricingMock(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('DashboardMemberships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMock.mockReturnValue({ data: null, isLoading: false });
    transactionsMock.mockReturnValue({ data: [], isLoading: false });
    pricingMock.mockReturnValue({ plans: [], loading: false, updatePlan: vi.fn(), resetToDefaults: vi.fn() });
  });

  it('shows the empty history state when there are no transactions', () => {
    renderWithClient(<DashboardMemberships />);
    expect(screen.getByText('Membership History')).toBeInTheDocument();
    expect(screen.getByText('No subscription transactions found.')).toBeInTheDocument();
  });

  it('lists transactions when present', () => {
    transactionsMock.mockReturnValue({
      data: [{ description: 'Gold monthly', createdAt: new Date().toISOString() }],
      isLoading: false,
    });
    renderWithClient(<DashboardMemberships />);
    expect(screen.getByText('Gold monthly')).toBeInTheDocument();
    expect(screen.queryByText('No subscription transactions found.')).not.toBeInTheDocument();
  });

  it('renders admin configured membership plans', () => {
    pricingMock.mockReturnValue({
      plans: [
        {
          id: 'starter-plan-id',
          name: 'Starter Tier',
          description: 'Great for new shops',
          whoItIsFor: 'Solo businesses',
          badge: 'BEST VALUE',
          price: 49,
          monthlyPrice: 49,
          features: ['Storefront Access', '90-Day Roadmap'],
          tiers: [
            {
              tier: 'Standard',
              durationDays: 90,
              fullPrice: 49,
              features: ['Storefront Access'],
              entitlements: [],
              paymentOptions: [],
            },
          ],
        },
      ],
      loading: false,
    });

    renderWithClient(<DashboardMemberships />);
    expect(screen.getByText('Starter Tier')).toBeInTheDocument();
    expect(screen.getByText('Solo businesses')).toBeInTheDocument();
    expect(screen.getByText('BEST VALUE')).toBeInTheDocument();
    expect(screen.getByText('Select & Pay for Starter Tier')).toBeInTheDocument();
  });
});

