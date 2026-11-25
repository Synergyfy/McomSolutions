import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import UserManagementPanel from './UserManagementPanel';

const h = vi.hoisted(() => {
  const calls: Record<string, Array<{ params?: any; options?: any }>> = {
    businesses: [],
    customers: [],
    agents: [],
    consultants: [],
    accountManagers: [],
    deletedUsers: [],
  };

  const rows = [
    {
      id: 'bp-1',
      userId: 'user-1',
      name: 'Business Owner',
      email: 'synergyfyglobal@gmail.com',
      phone: '',
      membership: 'Platinum Normal',
      platformAccess: ['Loyalty'],
      status: 'Active',
      revenue: '£0',
    },
  ];

  const paginated = (page = 1) => ({
    data: {
      success: true,
      data: rows,
      total: 26,
      page,
      limit: 20,
      totalPages: 2,
    },
    isLoading: false,
    isFetching: false,
  });

  return {
    navigate: vi.fn(),
    calls,
    paginated,
    mutation: { mutate: vi.fn(), isPending: false },
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => h.navigate,
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ initial, animate, exit, transition, children, ...rest }: any) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('./WhitelabelAccessModal', () => ({
  default: () => null,
}));

vi.mock('../../services/admin/hooks', () => {
  const list = (name: string) => (params?: any, options?: any) => {
    h.calls[name].push({ params, options });
    return h.paginated();
  };
  return {
    useAdminBusinesses: list('businesses'),
    useAdminCustomers: list('customers'),
    useAdminAgents: list('agents'),
    useAdminConsultants: list('consultants'),
    useAdminAccountManagers: list('accountManagers'),
    useAdminDeletedUsers: list('deletedUsers'),
    useRestoreUser: () => h.mutation,
    useCreateBusiness: () => h.mutation,
    useUpdateBusiness: () => h.mutation,
    useDeleteBusiness: () => h.mutation,
    useCreateCustomer: () => h.mutation,
    useUpdateCustomer: () => h.mutation,
    useDeleteCustomer: () => h.mutation,
    useCreateAgent: () => h.mutation,
    useUpdateAgent: () => h.mutation,
    useDeleteAgent: () => h.mutation,
    useCreateConsultant: () => h.mutation,
    useUpdateConsultant: () => h.mutation,
    useDeleteConsultant: () => h.mutation,
    useCreateAccountManager: () => h.mutation,
    useUpdateAccountManager: () => h.mutation,
    useDeleteAccountManager: () => h.mutation,
  };
});

const lastCall = (name: string) => h.calls[name][h.calls[name].length - 1];

describe('UserManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(h.calls).forEach((list) => list.splice(0, list.length));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the first page of businesses from the API', () => {
    render(<UserManagementPanel />);

    expect(lastCall('businesses').params).toEqual({ page: 1, limit: 20 });
    expect(lastCall('businesses').options).toEqual({ enabled: true });
    expect(screen.getByText(/^Showing/).textContent).toContain('Showing 1–20 of 26');
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('only fetches the active tab', () => {
    render(<UserManagementPanel />);

    expect(lastCall('businesses').options).toEqual({ enabled: true });
    expect(lastCall('customers').options).toEqual({ enabled: false });
    expect(lastCall('deletedUsers').options).toEqual({ enabled: false });
  });

  it('requests the next page when the admin paginates', () => {
    render(<UserManagementPanel />);

    fireEvent.click(screen.getByLabelText('Next page'));

    expect(lastCall('businesses').params).toEqual({ page: 2, limit: 20 });
    expect(screen.getByText(/^Showing/).textContent).toContain('Showing 21–26 of 26');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('switches tabs and resets to page 1', () => {
    render(<UserManagementPanel />);

    fireEvent.click(screen.getByLabelText('Next page'));
    fireEvent.click(screen.getByRole('button', { name: 'Customers' }));

    expect(lastCall('customers').params).toEqual({ page: 1, limit: 20 });
    expect(lastCall('customers').options).toEqual({ enabled: true });
  });

  it('sends the search term to the API after debouncing', () => {
    vi.useFakeTimers();
    render(<UserManagementPanel />);

    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'synergyfyglobal' },
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(lastCall('businesses').params).toEqual({
      page: 1,
      limit: 20,
      search: 'synergyfyglobal',
    });
  });

  it('finds a business that lives beyond the first page', () => {
    vi.useFakeTimers();
    render(<UserManagementPanel />);

    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'synergyfyglobal' },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText('synergyfyglobal@gmail.com')).toBeInTheDocument();
  });
});
