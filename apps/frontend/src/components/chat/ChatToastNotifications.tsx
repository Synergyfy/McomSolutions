import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, UserPlus, UserCheck, X, ArrowRight, Sparkles } from 'lucide-react';
import { chatConnection } from '../../services/chat/connection';
import { cn } from '../../lib/utils';

export interface ChatToastItem {
  id: string;
  type: 'NEW_MESSAGE' | 'MESSAGE_REQUEST' | 'REQUEST_ACCEPTED';
  title: string;
  senderName: string;
  content?: string | null;
  message?: string | null;
  conversationId?: string | null;
  requestId?: string | null;
  createdAt: string;
}

export default function ChatToastNotifications() {
  const [toasts, setToasts] = useState<ChatToastItem[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Ensure connection is active
    const unsubscribeConn = chatConnection.subscribe();

    const handleChatNotification = (data: any) => {
      if (!data || !data.type) return;

      // Extract current active conversation from URL if user is currently looking at it
      const currentSearchParams = new URLSearchParams(window.location.search);
      const currentActiveConv = currentSearchParams.get('conversationId');

      // Suppress message toast if user is already looking at this exact conversation
      if (
        data.type === 'NEW_MESSAGE' &&
        location.pathname.startsWith('/dashboard/messages') &&
        currentActiveConv === data.conversationId
      ) {
        return;
      }

      const toastId = `${data.type}-${data.conversationId || data.requestId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      let title = 'New Notification';
      if (data.type === 'NEW_MESSAGE') {
        title = `New message from ${data.senderName}`;
      } else if (data.type === 'MESSAGE_REQUEST') {
        title = `${data.senderName} sent you a message request`;
      } else if (data.type === 'REQUEST_ACCEPTED') {
        title = `${data.responderName || 'Contact'} accepted your chat request!`;
      }

      const newToast: ChatToastItem = {
        id: toastId,
        type: data.type,
        title,
        senderName: data.senderName || data.responderName || 'Someone',
        content: data.content || null,
        message: data.message || null,
        conversationId: data.conversationId || null,
        requestId: data.requestId || null,
        createdAt: data.createdAt || new Date().toISOString(),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep max 4 visible toasts

      // Invalidate relevant queries immediately
      if (data.type === 'NEW_MESSAGE') {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      } else if (data.type === 'MESSAGE_REQUEST' || data.type === 'REQUEST_ACCEPTED') {
        queryClient.invalidateQueries({ queryKey: ['chat-message-requests'] });
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      }

      // Auto dismiss after 7 seconds
      setTimeout(() => {
        removeToast(toastId);
      }, 7000);
    };

    const unsubListener = chatConnection.on('chat_notification', handleChatNotification);

    return () => {
      unsubListener();
      unsubscribeConn();
    };
  }, [location.pathname, removeToast, queryClient]);

  const handleToastClick = (toast: ChatToastItem) => {
    removeToast(toast.id);

    if (toast.type === 'NEW_MESSAGE' || toast.type === 'REQUEST_ACCEPTED') {
      if (toast.conversationId) {
        navigate(`/dashboard/messages?conversationId=${toast.conversationId}`);
        // Dispatch window event in case DashboardMessages is already mounted
        window.dispatchEvent(
          new CustomEvent('mcom_open_chat_conversation', {
            detail: { conversationId: toast.conversationId },
          }),
        );
      } else {
        navigate('/dashboard/messages');
      }
    } else if (toast.type === 'MESSAGE_REQUEST') {
      navigate('/dashboard/messages?openRequests=true');
      window.dispatchEvent(
        new CustomEvent('mcom_open_message_requests', {
          detail: { open: true },
        }),
      );
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((t) => {
          const isRequest = t.type === 'MESSAGE_REQUEST';
          const isAccepted = t.type === 'REQUEST_ACCEPTED';
          const isMsg = t.type === 'NEW_MESSAGE';

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.92, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -15, scale: 0.94, filter: 'blur(4px)' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={() => handleToastClick(t)}
              className={cn(
                'pointer-events-auto rounded-2xl shadow-2xl p-4 cursor-pointer relative overflow-hidden transition-all group',
                'bg-white/95 backdrop-blur-md border border-gray-100 hover:border-orange-300 hover:shadow-orange-500/10 hover:shadow-xl',
              )}
            >
              {/* Top Accent Gradient Bar */}
              <div
                className={cn(
                  'absolute top-0 left-0 right-0 h-1',
                  isRequest
                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500'
                    : isAccepted
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500',
                )}
              />

              <div className="flex items-start gap-3 mt-0.5">
                {/* Icon Badge */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white',
                    isRequest
                      ? 'bg-gradient-to-tr from-violet-600 to-indigo-500'
                      : isAccepted
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                      : 'bg-gradient-to-tr from-orange-500 to-amber-500',
                  )}
                >
                  {isRequest && <UserPlus className="w-5 h-5" />}
                  {isAccepted && <Sparkles className="w-5 h-5" />}
                  {isMsg && <MessageSquare className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={cn(
                        'text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full',
                        isRequest
                          ? 'bg-violet-50 text-violet-700 border border-violet-100'
                          : isAccepted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-orange-50 text-orange-700 border border-orange-100',
                      )}
                    >
                      {isRequest ? 'Message Request' : isAccepted ? 'Request Accepted' : 'Direct Message'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeToast(t.id);
                      }}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="text-xs font-bold text-gray-900 truncate">
                    {t.senderName}
                  </h4>

                  {/* Explanatory Message / Note Preview */}
                  {isRequest && (
                    <div className="mt-1">
                      {t.message ? (
                        <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2 italic line-clamp-2">
                          "{t.message}"
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500">
                          Sent you a message request. Click to review.
                        </p>
                      )}
                    </div>
                  )}

                  {isMsg && t.content && (
                    <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">
                      {t.content}
                    </p>
                  )}

                  {isAccepted && (
                    <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                      Accepted your request. Click to start chatting!
                    </p>
                  )}

                  {/* Call to action prompt */}
                  <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-orange-600 group-hover:translate-x-0.5 transition-transform">
                    <span>
                      {isRequest ? 'View Request' : 'Open Conversation'}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* Auto-dismiss countdown bar */}
              <div className="mt-2.5 h-0.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 7, ease: 'linear' }}
                  className={cn(
                    'h-full',
                    isRequest
                      ? 'bg-violet-400'
                      : isAccepted
                      ? 'bg-emerald-400'
                      : 'bg-orange-400',
                  )}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
