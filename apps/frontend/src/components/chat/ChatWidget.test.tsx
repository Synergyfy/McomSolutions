import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ChatWidget from './ChatWidget';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock connection manager
vi.mock('../../services/chat/connection', () => ({
  chatConnection: {
    getState: vi.fn().mockReturnValue('CONNECTED'),
    onStateChange: vi.fn().mockReturnValue(() => {}),
    getSocket: vi.fn().mockReturnValue({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      connected: true,
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    broadcastTabEvent: vi.fn(),
    onTabEvent: vi.fn().mockReturnValue(() => {}),
  },
}));

// Mock chatApi
vi.mock('../../services/chat', () => ({
  chatApi: {
    getConversations: vi.fn().mockResolvedValue([
      {
        id: 'conv-1',
        type: 'DIRECT',
        title: 'Alice Business',
        unreadCount: 2,
        isOnline: true,
        participantsCount: 2,
        lastMessageText: 'Hello from Alice',
        lastMessageAt: new Date().toISOString(),
        participants: [],
      },
    ]),
    getMessages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    markAsRead: vi.fn().mockResolvedValue({ success: true }),
    searchUsers: vi.fn().mockResolvedValue([]),
    getMessageRequests: vi.fn().mockResolvedValue({
      incoming: [
        {
          id: 'req-1',
          senderId: 'user-2',
          displayName: 'Bob Builder',
          email: 'bob@example.com',
          role: 'BUSINESS',
          createdAt: new Date().toISOString(),
          rejectionCount: 0,
        },
      ],
      outgoing: [],
      rejected: [],
    }),
    getBlockedUsers: vi.fn().mockResolvedValue([]),
  },
}));

describe('ChatWidget component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    localStorage.setItem('auth_token', 'mock-token-xyz');
  });

  it('renders chat floating launcher button when authenticated', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ChatWidget />
      </QueryClientProvider>,
    );

    const button = screen.getByLabelText('Open Chat');
    expect(button).toBeInTheDocument();
  });

  it('opens conversation list when launcher button is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ChatWidget />
      </QueryClientProvider>,
    );

    const button = screen.getByLabelText('Open Chat');
    fireEvent.click(button);

    expect(screen.getByText('MCOM Messaging')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
  });

  it('opens message requests modal when Requests button is clicked', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ChatWidget />
      </QueryClientProvider>,
    );

    const openBtn = screen.getByLabelText('Open Chat');
    fireEvent.click(openBtn);

    const requestsBtn = screen.getByTitle('Message Requests & Blocked');
    expect(requestsBtn).toBeInTheDocument();
    fireEvent.click(requestsBtn);

    expect(screen.getByText('Manage chat requests and blocked contacts')).toBeInTheDocument();
  });
});
