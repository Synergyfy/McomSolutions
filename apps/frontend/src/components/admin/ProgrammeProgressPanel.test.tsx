import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProgrammeProgressPanel from './ProgrammeProgressPanel';

const { listMock, detailMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  detailMock: vi.fn(),
}));

vi.mock('../../services/admin/hooks', () => ({
  useProgrammeUsersProgress: () => listMock(),
  useProgrammeUserTasks: (userId?: string) => detailMock(userId),
}));

const users = [
  {
    id: 'user-1',
    userId: 'user-1',
    name: 'Acme Ltd',
    email: 'owner@acme.test',
    role: 'BUSINESS',
    membership: 'Bronze Normal',
    totalTasks: 4,
    completed: 2,
    expired: 1,
    inProgress: 0,
    pending: 1,
    outstanding: 1,
    progress: 50,
  },
  {
    id: 'user-2',
    userId: 'user-2',
    name: 'Ada Obi',
    email: 'ada@example.test',
    role: 'CUSTOMER',
    membership: 'None',
    totalTasks: 0,
    completed: 0,
    expired: 0,
    inProgress: 0,
    pending: 0,
    outstanding: 0,
    progress: 0,
  },
];

const tasks = [
  {
    id: 'a1',
    taskId: 't1',
    title: 'Upload your business logo',
    status: 'PENDING',
    deadlineAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: 2,
    rewardPoints: 50,
  },
  {
    id: 'a2',
    taskId: 't2',
    title: 'Link your social accounts',
    status: 'EXPIRED',
    deadlineAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: 0,
    rewardPoints: 30,
  },
  {
    id: 'a3',
    taskId: 't3',
    title: 'Complete your profile',
    status: 'COMPLETED',
    deadlineAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    daysRemaining: 0,
    rewardPoints: 20,
    rewardGranted: true,
  },
];

describe('ProgrammeProgressPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockReturnValue({
      data: {
        data: users,
        total: users.length,
        page: 1,
        limit: 20,
        totalPages: 1,
        summary: { users: 2, completed: 2, expired: 1, inProgress: 0, pending: 1, overdue: 1, outstanding: 1 },
      },
      isLoading: false,
    });
    detailMock.mockReturnValue({
      data: {
        data: tasks,
        user: users[0],
        summary: { total: 3, completed: 1, expired: 1, inProgress: 0, pending: 1, outstanding: 1, progress: 33 },
      },
      isLoading: false,
    });
  });

  it('lists businesses and customers with their programme roll-up', () => {
    render(<ProgrammeProgressPanel />);

    expect(screen.getByText('Acme Ltd')).toBeInTheDocument();
    expect(screen.getByText('Ada Obi')).toBeInTheDocument();
    expect(screen.getByText('2 done')).toBeInTheDocument();
    expect(screen.getByText('· 1 expired')).toBeInTheDocument();
  });

  it('drills into a user and shows outstanding, expired, and completed tasks', () => {
    render(<ProgrammeProgressPanel />);

    fireEvent.click(screen.getByText('Acme Ltd'));

    expect(detailMock).toHaveBeenCalledWith('user-1');
    // Outstanding task is visible straight away.
    expect(screen.getByText('Upload your business logo')).toBeInTheDocument();
    // Expired/completed are tucked behind collapsible sections.
    expect(screen.queryByText('Link your social accounts')).not.toBeInTheDocument();
    expect(screen.queryByText('Complete your profile')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Expired tasks/i }));
    expect(screen.getByText('Link your social accounts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Completed tasks/i }));
    expect(screen.getByText('Complete your profile')).toBeInTheDocument();
  });
});
