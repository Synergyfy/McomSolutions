import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ConversationView from './ConversationView';
import GroupInfoModal from './GroupInfoModal';
import { chatApi } from '../../services/chat';

vi.mock('../../services/chat', () => ({
  chatApi: {
    blockUser: vi.fn().mockResolvedValue({ success: true }),
    muteConversation: vi.fn().mockResolvedValue({ success: true }),
    removeParticipant: vi.fn().mockResolvedValue({ success: true }),
    updateGroupSettings: vi.fn().mockResolvedValue({}),
    setParticipantRole: vi.fn().mockResolvedValue({}),
    transferOwnership: vi.fn().mockResolvedValue({}),
  },
  getCurrentUserId: vi.fn().mockReturnValue('member-1'),
}));

const memberConversation = {
  id: 'conv-1',
  type: 'GROUP' as const,
  title: 'Acme Weekly',
  isMuted: false,
  role: 'MEMBER' as const,
  isAdminOnly: true,
  isOwner: false,
  lastMessageAt: new Date().toISOString(),
  unreadCount: 0,
  isOnline: true,
  participantsCount: 2,
  participants: [
    {
      userId: 'owner-1',
      role: 'ADMIN' as const,
      isOwner: true,
      displayName: 'Olivia Owner',
      email: 'olivia@example.com',
      roleTitle: 'Business',
      isOnline: true,
    },
    {
      userId: 'member-1',
      role: 'MEMBER' as const,
      isOwner: false,
      displayName: 'Me Myself',
      email: 'me@example.com',
      roleTitle: 'Customer',
      isOnline: true,
    },
  ],
};

const adminConversation = {
  ...memberConversation,
  role: 'ADMIN' as const,
  isOwner: true,
};

const noop = () => {};

describe('Group read-only (admin-only) mode', () => {
  beforeAll(() => {
    // jsdom does not implement scrollIntoView, which the message list calls.
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ConversationView', () => {
    it('disables the composer and explains why for a member of an admin-only group', () => {
      render(
        <ConversationView
          conversation={memberConversation}
          messages={[]}
          isLoading={false}
          typingUsers={[]}
          onBack={noop}
          onSend={noop}
          onTyping={noop}
          onOpenReceipts={noop}
          onOpenGroupInfo={noop}
        />,
      );

      expect(screen.getByText('Read-only group.')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Only group admins can send messages in this group'),
      ).toBeDisabled();
    });

    it('leaves the composer usable for an admin of an admin-only group', () => {
      render(
        <ConversationView
          conversation={adminConversation}
          messages={[]}
          isLoading={false}
          typingUsers={[]}
          onBack={noop}
          onSend={noop}
          onTyping={noop}
          onOpenReceipts={noop}
          onOpenGroupInfo={noop}
        />,
      );

      expect(screen.queryByText('Read-only group.')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Type a message/)).not.toBeDisabled();
    });

    it('leaves the composer usable for a member of a normal group', () => {
      render(
        <ConversationView
          conversation={{ ...memberConversation, isAdminOnly: false }}
          messages={[]}
          isLoading={false}
          typingUsers={[]}
          onBack={noop}
          onSend={noop}
          onTyping={noop}
          onOpenReceipts={noop}
          onOpenGroupInfo={noop}
        />,
      );

      expect(screen.getByPlaceholderText(/Type a message/)).not.toBeDisabled();
    });
  });

  describe('GroupInfoModal', () => {
    it('hides the admin-only toggle from a plain member', () => {
      render(
        <GroupInfoModal
          isOpen
          conversation={memberConversation}
          currentUserId="member-1"
          onClose={noop}
          onRefresh={noop}
        />,
      );

      expect(screen.queryByLabelText('Only admins can send messages')).not.toBeInTheDocument();
    });

    it('shows the admin-only toggle to an admin and reflects the current mode', () => {
      render(
        <GroupInfoModal
          isOpen
          conversation={adminConversation}
          currentUserId="owner-1"
          onClose={noop}
          onRefresh={noop}
        />,
      );

      const toggle = screen.getByLabelText('Only admins can send messages');
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('turns the admin-only mode off when an admin flips the toggle', async () => {
      render(
        <GroupInfoModal
          isOpen
          conversation={adminConversation}
          currentUserId="owner-1"
          onClose={noop}
          onRefresh={noop}
        />,
      );

      fireEvent.click(screen.getByLabelText('Only admins can send messages'));

      await waitFor(() =>
        expect(chatApi.updateGroupSettings).toHaveBeenCalledWith('conv-1', {
          isAdminOnly: false,
        }),
      );
    });

    it('promotes a member to admin', async () => {
      render(
        <GroupInfoModal
          isOpen
          conversation={adminConversation}
          currentUserId="owner-1"
          onClose={noop}
          onRefresh={noop}
        />,
      );

      fireEvent.click(screen.getByTitle('Make admin'));

      await waitFor(() =>
        expect(chatApi.setParticipantRole).toHaveBeenCalledWith('conv-1', 'member-1', 'ADMIN'),
      );
    });

    it('never offers to demote or remove the group owner', () => {
      render(
        <GroupInfoModal
          isOpen
          conversation={adminConversation}
          currentUserId="owner-1"
          onClose={noop}
          onRefresh={noop}
        />,
      );

      // The owner row is the signed-in user, so it carries no management buttons.
      expect(screen.queryByTitle('Remove as admin')).not.toBeInTheDocument();
    });
  });
});
