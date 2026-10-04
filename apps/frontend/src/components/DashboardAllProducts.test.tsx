import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardAllProducts from './DashboardAllProducts';

const { appsMock, refetchMock } = vi.hoisted(() => ({
  appsMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock('../services/business/hooks', () => ({
  useEcosystemApps: () => appsMock(),
}));

vi.mock('../services/auth/hooks', () => ({
  useCurrentUser: () => ({ data: null }),
  useGetSsoToken: () => ({ mutateAsync: vi.fn() }),
  usePostSsoAuthorize: () => ({ mutateAsync: vi.fn() }),
}));

function renderDirectory() {
  return render(
    <MemoryRouter>
      <DashboardAllProducts />
    </MemoryRouter>,
  );
}

describe('DashboardAllProducts error state (Phase 7 frontend smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the error state with a retry action when the directory fails', () => {
    appsMock.mockReturnValue({ data: [], isLoading: false, isError: true, refetch: refetchMock, isFetching: false });
    renderDirectory();
    expect(screen.getByText('Failed to load platform directory')).toBeInTheDocument();
    expect(
      screen.getByText('Could not communicate with the application directory service.'),
    ).toBeInTheDocument();
  });

  it('retry calls refetch', () => {
    appsMock.mockReturnValue({ data: [], isLoading: false, isError: true, refetch: refetchMock, isFetching: false });
    renderDirectory();
    screen.getByRole('button', { name: /try again|retry|refresh/i }).click();
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
