import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Minimize2, Maximize2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useChat, useChatConnection } from '../../services/chat/hooks';
import { chatApi } from '../../services/chat';
import ConversationList from './ConversationList';
import ConversationView from './ConversationView';
import NewChatModal from './NewChatModal';
import GroupInfoModal from './GroupInfoModal';
import ReadReceiptsModal from './ReadReceiptsModal';
import MessageRequestsModal from './MessageRequestsModal';
import { cn } from '../../lib/utils';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const {
    conversations,
    isLoadingConversations,
    refetchConversations,
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
  } = useChat();

  const { state: connectionState } = useChatConnection();

  const { data: requestsData, refetch: refetchRequests } = useQuery({
    queryKey: ['chat-message-requests'],
    queryFn: () => chatApi.getMessageRequests(),
    enabled: isLoggedIn,
    refetchInterval: 15000,
  });

  const pendingRequestsCount = requestsData?.incoming?.length || 0;

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    setIsLoggedIn(!!token);

    const handleStorage = () => {
      setIsLoggedIn(!!localStorage.getItem('auth_token'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!isLoggedIn) return null;

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-2xl shadow-orange-500/40 flex items-center justify-center cursor-pointer transition-colors"
          aria-label="Open Chat"
        >
          <MessageSquare className="w-6 h-6" />
          {totalUnreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 px-2 py-0.5 min-w-[20px] text-center rounded-full bg-red-600 text-white font-extrabold text-[11px] shadow-lg border-2 border-white"
            >
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </motion.span>
          )}
        </motion.button>
      )}

      {/* Main Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className={cn(
              'fixed z-50 bg-white shadow-2xl flex flex-col overflow-hidden border border-gray-100',
              // Desktop: Floating window
              'sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[620px] sm:rounded-3xl',
              // Mobile: Full screen / bottom sheet
              'inset-0 sm:inset-auto',
            )}
          >
            {/* Top Window Bar on Desktop */}
            <div className="hidden sm:flex items-center justify-between px-4 py-2 bg-gray-50/80 border-b border-gray-100 select-none">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                MCOM Messaging
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
              {activeConversation ? (
                <ConversationView
                  conversation={activeConversation}
                  messages={messages}
                  isLoading={isLoadingMessages}
                  typingUsers={typingUsers}
                  onBack={() => setActiveConversationId(null)}
                  onSend={sendMessage}
                  onTyping={handleTypingKeystroke}
                  onOpenReceipts={openReceipts}
                  onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
                />
              ) : (
                <ConversationList
                  conversations={conversations}
                  activeConversationId={activeConversationId}
                  connectionState={connectionState}
                  isLoading={isLoadingConversations}
                  onSelect={(id) => setActiveConversationId(id)}
                  onOpenNewChat={() => setIsNewChatOpen(true)}
                  onOpenRequests={() => setIsRequestsOpen(true)}
                  pendingRequestsCount={pendingRequestsCount}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          refetchConversations();
        }}
      />

      {/* Message Requests Modal */}
      <MessageRequestsModal
        isOpen={isRequestsOpen}
        onClose={() => setIsRequestsOpen(false)}
        onOpenConversation={(id) => {
          setActiveConversationId(id);
          refetchConversations();
          refetchRequests();
        }}
      />

      {/* Group Info Modal */}
      <GroupInfoModal
        isOpen={isGroupInfoOpen}
        conversation={activeConversation || null}
        onClose={() => setIsGroupInfoOpen(false)}
        onRefresh={refetchConversations}
      />

      {/* Read Receipts Inspector Modal */}
      <ReadReceiptsModal
        data={receiptsModalData}
        onClose={closeReceipts}
      />
    </>
  );
}
