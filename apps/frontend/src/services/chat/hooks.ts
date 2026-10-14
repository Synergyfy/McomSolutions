import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatConnection, ConnectionState } from './connection';
import {
  chatApi,
  ConversationSummary,
  ChatMessage,
  MessageReceiptsResponse,
} from './index';

export function useChatConnection() {
  const [state, setState] = useState<ConnectionState>(chatConnection.getState());

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
      chatConnection.connect();
    }

    return chatConnection.onStateChange((newState) => {
      setState(newState);
    });
  }, []);

  return {
    state,
    isConnected: state === 'CONNECTED',
    reconnect: () => chatConnection.connect(),
  };
}

export function useChat() {
  const queryClient = useQueryClient();
  const { isConnected } = useChatConnection();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [receiptsModalData, setReceiptsModalData] = useState<MessageReceiptsResponse | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef = useRef(false);

  // Auto-connect on mount if authenticated
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('auth_token')) {
      chatConnection.connect();
    }
  }, []);

  // Load conversations
  const conversationsQuery = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => chatApi.getConversations(),
    refetchInterval: 30000, // background refresh safety net
  });

  const activeConversation = conversationsQuery.data?.find((c) => c.id === activeConversationId);

  // Load messages when activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    let isSubscribed = true;
    setIsLoadingMessages(true);

    chatApi
      .getMessages(activeConversationId, undefined, 50)
      .then((data) => {
        if (isSubscribed) {
          setMessages(data);
          setIsLoadingMessages(false);
          // Automatically mark conversation as read
          chatApi.markAsRead(activeConversationId).catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Failed to load messages:', err);
        if (isSubscribed) setIsLoadingMessages(false);
      });

    // Helper to join room and setup viewer lease
    const joinRoom = () => {
      const s = chatConnection.getSocket();
      if (s && s.connected) {
        s.emit('join_conversation', { conversationId: activeConversationId });
        s.emit('mark_read', { conversationId: activeConversationId });
        if (typeof document !== 'undefined' && document.hasFocus()) {
          s.emit('viewing_conversation', { conversationId: activeConversationId });
        }
      }
    };

    const socket = chatConnection.getSocket();
    if (socket) {
      if (socket.connected) {
        joinRoom();
      }
      socket.on('connect', joinRoom);
      socket.on('connected', joinRoom);
    }

    const viewingInterval = setInterval(() => {
      const s = chatConnection.getSocket();
      if (typeof document !== 'undefined' && document.hasFocus() && s && s.connected) {
        s.emit('viewing_conversation', { conversationId: activeConversationId });
      }
    }, 25000);

    const handleBlurOrHidden = () => {
      const s = chatConnection.getSocket();
      if (s && s.connected) {
        s.emit('stop_viewing_conversation', { conversationId: activeConversationId });
      }
    };

    const handleFocusOrVisible = () => {
      const s = chatConnection.getSocket();
      if (s && s.connected && typeof document !== 'undefined' && document.hasFocus() && document.visibilityState === 'visible') {
        s.emit('viewing_conversation', { conversationId: activeConversationId });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', handleBlurOrHidden);
      window.addEventListener('focus', handleFocusOrVisible);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) handleBlurOrHidden();
        else handleFocusOrVisible();
      });
    }

    return () => {
      isSubscribed = false;
      clearInterval(viewingInterval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', handleBlurOrHidden);
        window.removeEventListener('focus', handleFocusOrVisible);
      }
      if (socket) {
        socket.off('connect', joinRoom);
        socket.off('connected', joinRoom);
        if (socket.connected) {
          socket.emit('stop_viewing_conversation', { conversationId: activeConversationId });
          socket.emit('leave_conversation', { conversationId: activeConversationId });
        }
      }
    };
  }, [activeConversationId]);

  // Setup real-time socket events
  useEffect(() => {
    const socket = chatConnection.getSocket();
    if (!socket) return;

    const currentUserId = (() => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          return payload.sub || payload.id || null;
        }
      } catch {}
      return null;
    })();

    const handleNewMessage = (rawMsg: ChatMessage) => {
      const isSender = Boolean(currentUserId && rawMsg.senderId === currentUserId);
      const newMsg: ChatMessage = {
        ...rawMsg,
        isSender: isSender || rawMsg.isSender,
      };

      if (newMsg.conversationId === activeConversationId) {
        setMessages((prev) => {
          // If message was optimistically added, reconcile it
          if (newMsg.clientTempId) {
            const index = prev.findIndex(
              (m) => m.clientTempId === newMsg.clientTempId || m.id === newMsg.id,
            );
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...newMsg, status: 'sent' };
              return updated;
            }
          }
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, { ...newMsg, status: 'sent' }];
        });

        // Mark read immediately since user is actively viewing this room
        if (!isSender && socket.connected) {
          socket.emit('mark_read', {
            conversationId: activeConversationId,
            messageIds: [newMsg.id],
          });
        }
      }

      // Update conversations query cache
      queryClient.setQueryData<ConversationSummary[]>(['chat-conversations'], (old) => {
        if (!old) return old;
        return old.map((c) => {
          if (c.id === newMsg.conversationId) {
            return {
              ...c,
              lastMessageText: newMsg.content,
              lastMessageAt: newMsg.createdAt,
              lastMessageSenderId: newMsg.senderId,
              unreadCount:
                newMsg.conversationId === activeConversationId || isSender
                  ? 0
                  : c.unreadCount + 1,
            };
          }
          return c;
        });
      });
    };

    const handleMessagesRead = (data: {
      conversationId: string;
      readerUserId: string;
      readMessageIds: string[];
    }) => {
      if (data.conversationId === activeConversationId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (data.readMessageIds.includes(msg.id)) {
              const previews = msg.readReceiptsPreview || [];
              const updatedPreviews = previews.includes(data.readerUserId)
                ? previews
                : [...previews, data.readerUserId];
              return {
                ...msg,
                readCount: updatedPreviews.length,
                readReceiptsPreview: updatedPreviews,
              };
            }
            return msg;
          }),
        );
      }
    };

    const handleTypingUpdate = (data: {
      conversationId: string;
      typingUsers: Array<{ userId: string; userName: string }>;
    }) => {
      if (data.conversationId === activeConversationId) {
        setTypingUsers(data.typingUsers || []);
      }
    };

    const handlePresenceUpdate = (data: { userId: string; isOnline: boolean }) => {
      queryClient.setQueryData<ConversationSummary[]>(['chat-conversations'], (old) => {
        if (!old) return old;
        return old.map((conv) => {
          const updatedParts = conv.participants.map((p) =>
            p.userId === data.userId ? { ...p, isOnline: data.isOnline } : p,
          );
          return {
            ...conv,
            isOnline:
              conv.type === 'DIRECT'
                ? updatedParts.find((p) => p.userId === data.userId)?.isOnline ?? conv.isOnline
                : conv.isOnline,
            participants: updatedParts,
          };
        });
      });
    };

    const handleInboxUpdate = (data: {
      conversationId: string;
      lastMessageText: string;
      lastMessageAt: string;
      lastMessageSenderId: string;
    }) => {
      // Invalidate queries directly from the server event without tab-bus duplication
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    };

    const handleSocketException = (exc: any) => {
      console.warn('[Chat] Socket exception received from server:', exc);
      setMessages((prev) =>
        prev.map((m) => (m.status === 'pending' ? { ...m, status: 'failed' } : m)),
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('typing_update', handleTypingUpdate);
    socket.on('presence_update', handlePresenceUpdate);
    socket.on('inbox_update', handleInboxUpdate);
    socket.on('exception', handleSocketException);

    // Cross-tab synchronization via BroadcastChannel for tab-local actions
    const unsubscribeTabBus = chatConnection.onTabEvent
      ? chatConnection.onTabEvent((evt) => {
          if (evt.type === 'LOCAL_MARK_READ') {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
          }
        })
      : () => {};

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('typing_update', handleTypingUpdate);
      socket.off('presence_update', handlePresenceUpdate);
      socket.off('inbox_update', handleInboxUpdate);
      socket.off('exception', handleSocketException);
      unsubscribeTabBus();
    };
  }, [activeConversationId, queryClient, isConnected]);

  // Send message with optimistic update & ACK reconciliation
  const sendMessage = useCallback(
    async (content: string, type = 'TEXT') => {
      if (!activeConversationId || !content.trim()) return;

      const clientTempId = `tmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const optimisticMsg: ChatMessage = {
        id: clientTempId,
        conversationId: activeConversationId,
        senderId: 'me',
        senderName: 'You',
        senderRole: 'USER',
        content: content.trim(),
        type,
        createdAt: new Date().toISOString(),
        isSender: true,
        readCount: 1,
        isReadByMe: true,
        status: 'pending',
        clientTempId,
      };

      // 1. Optimistic render in UI
      setMessages((prev) => [...prev, optimisticMsg]);

      // Stop typing
      const socket = chatConnection.getSocket();
      if (socket) {
        socket.emit('typing_stop', { conversationId: activeConversationId });
      }

      // 2. Transmit through WebSocket (with durable timeout & HTTP fallback)
      if (socket && socket.connected) {
        let ackSettled = false;

        const fallbackTimer = setTimeout(async () => {
          if (ackSettled) return;
          console.warn('[Chat] WebSocket send_message ACK timed out, falling back to HTTP...');
          try {
            const canonical = await chatApi.sendMessage(activeConversationId, {
              content: content.trim(),
              type,
              idempotencyKey: clientTempId,
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.clientTempId === clientTempId ? { ...canonical, isSender: true, status: 'sent' } : m,
              ),
            );
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
          } catch {
            setMessages((prev) =>
              prev.map((m) =>
                m.clientTempId === clientTempId ? { ...m, status: 'failed' } : m,
              ),
            );
          }
        }, 5000);

        socket.emit(
          'send_message',
          {
            conversationId: activeConversationId,
            content: content.trim(),
            type,
            idempotencyKey: clientTempId,
          },
          (ack: any) => {
            ackSettled = true;
            clearTimeout(fallbackTimer);
            if (ack && ack.success && ack.message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.clientTempId === clientTempId ? { ...ack.message, isSender: true, status: 'sent' } : m,
                ),
              );
              queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.clientTempId === clientTempId ? { ...m, status: 'failed' } : m,
                ),
              );
            }
          },
        );
      } else {
        // HTTP Fallback
        try {
          const canonical = await chatApi.sendMessage(activeConversationId, {
            content: content.trim(),
            type,
            idempotencyKey: clientTempId,
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.clientTempId === clientTempId ? { ...canonical, isSender: true, status: 'sent' } : m,
            ),
          );
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.clientTempId === clientTempId ? { ...m, status: 'failed' } : m,
            ),
          );
        }
      }
    },
    [activeConversationId, queryClient],
  );

  // Throttled typing indicator emitter
  const handleTypingKeystroke = useCallback(() => {
    if (!activeConversationId) return;
    const socket = chatConnection.getSocket();
    if (!socket || !socket.connected) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { conversationId: activeConversationId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing_stop', { conversationId: activeConversationId });
    }, 3000);
  }, [activeConversationId]);

  // Read receipts inspector
  const openReceipts = useCallback(async (messageId: string) => {
    try {
      const data = await chatApi.getMessageReceipts(messageId);
      setReceiptsModalData(data);
    } catch (err) {
      console.error('Failed to load message receipts:', err);
    }
  }, []);

  const closeReceipts = useCallback(() => {
    setReceiptsModalData(null);
  }, []);

  // Compute total unread across all conversations
  const totalUnreadCount =
    conversationsQuery.data?.reduce((sum, c) => sum + (c.unreadCount || 0), 0) || 0;

  return {
    conversations: conversationsQuery.data || [],
    isLoadingConversations: conversationsQuery.isLoading,
    refetchConversations: conversationsQuery.refetch,
    activeConversationId,
    setActiveConversationId,
    activeConversation,
    messages,
    isLoadingMessages,
    typingUsers,
    totalUnreadCount,
    sendMessage,
    handleTypingKeystroke,
    openReceipts,
    closeReceipts,
    receiptsModalData,
  };
}
