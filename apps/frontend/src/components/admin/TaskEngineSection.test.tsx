import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TaskEngineSection from './TaskEngineSection';

const { featuresMock } = vi.hoisted(() => ({
  featuresMock: vi.fn(),
}));

vi.mock('../../services/admin/hooks', () => ({
  useTaskFeatures: () => featuresMock(),
  useTaskOverviewStats: () => ({
    data: {
      totalTasks: 0,
      activeTasks: 0,
      totalAssignments: 0,
      completedAssignments: 0,
      pendingAssignments: 0,
      expiredAssignments: 0,
      totalPointsAwarded: 0,
      completionRate: 0,
    },
    refetch: vi.fn(),
  }),
  useTaskDefinitions: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useCreateTaskDefinition: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTaskDefinition: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTaskDefinition: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAssignTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTaskAssignments: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useUpdateTaskAssignmentStatus: () => ({ mutateAsync: vi.fn() }),
  useAdminPlans: () => ({ data: [] }),
  useAdminAccessPlans: () => ({ data: [] }),
}));

vi.mock('./console/hooks/useConsoleApps', () => ({
  useConsoleApps: () => ({ data: [], isLoading: false }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const openCreateModal = () => {
  renderWithClient(<TaskEngineSection />);
  fireEvent.click(screen.getByRole('button', { name: /Create New Task/i }));
};

describe('TaskEngineSection audience-first task creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featuresMock.mockReturnValue({
      data: {
        success: true,
        data: [
          {
            key: 'business.logo_uploaded',
            label: 'Upload Business Logo',
            targetAudience: 'BUSINESS',
          },
          {
            key: 'customer.profile_completed',
            label: 'Complete Customer Profile',
            targetAudience: 'CUSTOMER',
          },
        ],
      },
      isLoading: false,
    });
  });

  it('shows only the three audience options before any form fields', () => {
    openCreateModal();

    expect(screen.getByText('Who is this task for?')).toBeInTheDocument();
    expect(screen.getByText('Businesses')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Businesses & Customers')).toBeInTheDocument();
    expect(screen.queryByText('Task Title *')).not.toBeInTheDocument();
  });

  it('adapts a customer task to customer capabilities', () => {
    openCreateModal();
    fireEvent.click(screen.getByRole('button', { name: /^Customers/ }));

    expect(screen.getByText('Task Title *')).toBeInTheDocument();
    expect(screen.getByText('All customers')).toBeInTheDocument();
    expect(screen.getByText('Members only')).toBeInTheDocument();
    expect(screen.queryByText('Trial only')).not.toBeInTheDocument();
    expect(screen.getByText('Auto Event')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Complete Customer Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Upload Business Logo' })).not.toBeInTheDocument();
  });

  it('falls back to manual task types for the shared audience', () => {
    openCreateModal();
    fireEvent.click(screen.getByRole('button', { name: /Businesses & Customers/ }));

    expect(screen.queryByText('Auto Event')).not.toBeInTheDocument();
    expect(
      screen.getByText(/no automatic trigger shared by businesses and customers/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Paid & Trial')).toBeInTheDocument();
    expect(screen.getByText('Trial only')).toBeInTheDocument();
  });
});
