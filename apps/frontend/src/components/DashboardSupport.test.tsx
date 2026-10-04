import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardSupport from './DashboardSupport';

const { profileMock, ticketsMock, createMock } = vi.hoisted(() => ({
  profileMock: vi.fn(),
  ticketsMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock('../services/business/hooks', () => ({
  useProfile: () => profileMock(),
  useSupportTickets: () => ticketsMock(),
  useCreateSupportTicket: () => ({ mutateAsync: createMock, isPending: false }),
}));

describe('DashboardSupport empty + validation states (Phase 7 frontend smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMock.mockReturnValue({ data: { membershipLevel: 'Bronze' } });
    ticketsMock.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows the empty state when there are no tickets', () => {
    render(<DashboardSupport />);
    expect(screen.getByText('No support tickets found.')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Ticket')).toBeInTheDocument();
  });

  it('rejects an empty ticket submit with a validation message', () => {
    render(<DashboardSupport />);
    fireEvent.click(screen.getByText('New Ticket'));
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(screen.getByText('Please enter both a subject and message.')).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('lists tickets when present', () => {
    ticketsMock.mockReturnValue({
      data: [{ id: 'abc123', subject: 'Billing question', status: 'Open', priority: 'High' }],
      isLoading: false,
    });
    render(<DashboardSupport />);
    expect(screen.getByText('Billing question')).toBeInTheDocument();
    expect(screen.queryByText('No support tickets found.')).not.toBeInTheDocument();
  });
});
