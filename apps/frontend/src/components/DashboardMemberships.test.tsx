import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardMemberships from './DashboardMemberships';

const { profileMock, transactionsMock, subscribeMock } = vi.hoisted(() => ({
  profileMock: vi.fn(),
  transactionsMock: vi.fn(),
  subscribeMock: vi.fn(),
}));

vi.mock('../services/business/hooks', () => ({
  useProfile: () => profileMock(),
}));

vi.mock('../services/pricing/hooks', () => ({
  useTransactions: () => transactionsMock(),
  useSubscribeMembership: () => ({ mutateAsync: subscribeMock }),
}));

vi.mock('../context/PricingContext', () => ({
  usePricing: () => ({ plans: [], loading: false, updatePlan: vi.fn(), resetToDefaults: vi.fn() }),
}));

describe('DashboardMemberships empty state (Phase 7 frontend smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMock.mockReturnValue({ data: null, isLoading: false });
    transactionsMock.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows the empty history state when there are no transactions', () => {
    render(<DashboardMemberships />);
    expect(screen.getByText('Membership History')).toBeInTheDocument();
    expect(screen.getByText('No subscription transactions found.')).toBeInTheDocument();
  });

  it('lists transactions when present', () => {
    transactionsMock.mockReturnValue({
      data: [{ description: 'Gold monthly', createdAt: new Date().toISOString() }],
      isLoading: false,
    });
    render(<DashboardMemberships />);
    expect(screen.getByText('Gold monthly')).toBeInTheDocument();
    expect(screen.queryByText('No subscription transactions found.')).not.toBeInTheDocument();
  });
});
