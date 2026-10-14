import { apiClient } from '../api';

export interface ChatParticipant {
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  displayName: string;
  email: string;
  roleTitle: string;
  isOnline: boolean;
  lastReadAt?: string | null;
}

export interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string;
  avatarUrl?: string | null;
  directKey?: string | null;
  isMuted: boolean;
  role: 'ADMIN' | 'MEMBER';
  lastMessageAt: string;
  lastMessageText?: string | null;
  lastMessageSenderId?: string | null;
  unreadCount: number;
  isOnline: boolean;
  participantsCount: number;
  participants: ChatParticipant[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string | null;
  content: string;
  type: string;
  metadata?: any;
  idempotencyKey?: string | null;
  createdAt: string;
  isSender: boolean;
  readCount: number;
  totalRecipients?: number;
  isReadByMe: boolean;
  readReceiptsPreview?: string[];
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  clientTempId?: string;
}

export interface MessageReceiptsResponse {
  messageId: string;
  conversationId: string;
  senderId: string;
  readersCount: number;
  totalRecipients: number;
  readers: Array<{
    userId: string;
    displayName: string;
    role: string;
    avatarUrl?: string | null;
    readAt: string;
  }>;
  allRecipients: Array<{
    userId: string;
    displayName: string;
    role: string;
    avatarUrl?: string | null;
    hasRead: boolean;
  }>;
}

export interface UserDirectoryItem {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  businessName?: string | null;
  isOnline: boolean;
}

export const chatApi = {
  getConversations: async (): Promise<ConversationSummary[]> => {
    const res = await apiClient.get('/chat/conversations');
    return res.data;
  },

  getOrCreateDirect: async (targetUserId: string): Promise<ConversationSummary> => {
    const res = await apiClient.post('/chat/conversations/direct', { targetUserId });
    return res.data;
  },

  createGroup: async (data: {
    title: string;
    participantIds: string[];
    avatarUrl?: string;
  }): Promise<ConversationSummary> => {
    const res = await apiClient.post('/chat/conversations/group', data);
    return res.data;
  },

  getConversation: async (id: string): Promise<ConversationSummary> => {
    const res = await apiClient.get(`/chat/conversations/${id}`);
    return res.data;
  },

  getMessages: async (
    conversationId: string,
    cursor?: string,
    limit = 50,
  ): Promise<ChatMessage[]> => {
    const res = await apiClient.get(`/chat/conversations/${conversationId}/messages`, {
      params: { cursor, limit },
    });
    return res.data;
  },

  sendMessage: async (
    conversationId: string,
    data: {
      content: string;
      type?: string;
      idempotencyKey?: string;
      metadata?: any;
    },
  ): Promise<ChatMessage> => {
    const res = await apiClient.post(`/chat/conversations/${conversationId}/messages`, data);
    return res.data;
  },

  markAsRead: async (
    conversationId: string,
    messageIds?: string[],
  ): Promise<{ success: boolean; count: number }> => {
    const res = await apiClient.post(`/chat/conversations/${conversationId}/read`, { messageIds });
    return res.data;
  },

  getMessageReceipts: async (messageId: string): Promise<MessageReceiptsResponse> => {
    const res = await apiClient.get(`/chat/messages/${messageId}/receipts`);
    return res.data;
  },

  addParticipant: async (
    conversationId: string,
    userId: string,
  ): Promise<ConversationSummary> => {
    const res = await apiClient.post(`/chat/conversations/${conversationId}/participants`, { userId });
    return res.data;
  },

  removeParticipant: async (
    conversationId: string,
    targetUserId: string,
  ): Promise<{ success: boolean }> => {
    const res = await apiClient.delete(
      `/chat/conversations/${conversationId}/participants/${targetUserId}`,
    );
    return res.data;
  },

  muteConversation: async (
    conversationId: string,
    isMuted: boolean,
  ): Promise<{ success: boolean }> => {
    const res = await apiClient.post(`/chat/conversations/${conversationId}/mute`, { isMuted });
    return res.data;
  },

  searchUsers: async (q: string): Promise<UserDirectoryItem[]> => {
    const res = await apiClient.get('/chat/users', { params: { q } });
    return res.data;
  },

  getVapidPublicKey: async (): Promise<string> => {
    const res = await apiClient.get('/chat/push/vapid-key');
    return res.data.publicKey;
  },

  subscribePush: async (subscription: any): Promise<{ success: boolean }> => {
    const subJson = subscription.toJSON ? subscription.toJSON() : subscription;
    const res = await apiClient.post('/chat/push/subscribe', {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      userAgent: navigator.userAgent,
    });
    return res.data;
  },

  unsubscribePush: async (endpoint: string): Promise<{ success: boolean }> => {
    const res = await apiClient.delete('/chat/push/unsubscribe', { data: { endpoint } });
    return res.data;
  },

  isPushSupported: (): boolean => {
    if (typeof window === 'undefined') return false;
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  getPushPermissionState: (): NotificationPermission | 'unsupported' => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  // Message Requests & Blocking
  getMessageRequests: async (): Promise<MessageRequestsData> => {
    const res = await apiClient.get('/chat/requests');
    return res.data;
  },

  sendMessageRequest: async (
    receiverId: string,
    message?: string,
  ): Promise<{ id: string; status: string; rejectionCount: number; canRetry: boolean; conversationId?: string }> => {
    const res = await apiClient.post('/chat/requests', { receiverId, message });
    return res.data;
  },

  respondMessageRequest: async (
    requestId: string,
    action: 'ACCEPT' | 'REJECT',
  ): Promise<{ success: boolean; status: string; conversationId?: string; rejectionCount?: number; canRetry?: boolean }> => {
    const res = await apiClient.post(`/chat/requests/${requestId}/respond`, { action });
    return res.data;
  },

  resetRejectedRequest: async (senderId: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post(`/chat/requests/reset/${senderId}`);
    return res.data;
  },

  blockUser: async (targetUserId: string): Promise<{ success: boolean; isBlocked: boolean }> => {
    const res = await apiClient.post('/chat/block', { targetUserId });
    return res.data;
  },

  unblockUser: async (targetUserId: string): Promise<{ success: boolean; isBlocked: boolean }> => {
    const res = await apiClient.post('/chat/unblock', { targetUserId });
    return res.data;
  },

  getBlockedUsers: async (): Promise<BlockedUserItem[]> => {
    const res = await apiClient.get('/chat/blocked');
    return res.data;
  },
};

export interface IncomingMessageRequest {
  id: string;
  senderId: string;
  displayName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  message?: string | null;
  createdAt: string;
  rejectionCount: number;
}

export interface OutgoingMessageRequest {
  id: string;
  receiverId: string;
  displayName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  message?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  rejectionCount: number;
  canRetry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RejectedMessageRequest {
  id: string;
  senderId: string;
  displayName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  rejectionCount: number;
  respondedAt: string;
}

export interface MessageRequestsData {
  incoming: IncomingMessageRequest[];
  outgoing: OutgoingMessageRequest[];
  rejected: RejectedMessageRequest[];
}

export interface BlockedUserItem {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
  blockedAt: string;
}

