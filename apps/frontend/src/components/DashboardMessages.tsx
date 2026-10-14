import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useChat, useChatConnection } from '../services/chat/hooks';
import { chatApi } from '../services/chat';
import ConversationList from './chat/ConversationList';
import ConversationView from './chat/ConversationView';
import NewChatModal from './chat/NewChatModal';
import GroupInfoModal from './chat/GroupInfoModal';
import ReadReceiptsModal from './chat/ReadReceiptsModal';
import MessageRequestsModal from './chat/MessageRequestsModal';
import { MessageSquare } from 'lucide-react';

export default function DashboardMessages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);

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
    refetchInterval: 15000,
  });

  const pendingRequestsCount = requestsData?.incoming?.length || 0;

  // Sync with URL query parameters (?conversationId=... or ?openRequests=true)
  useEffect(() => {
    const convId = searchParams.get('conversationId');
    const openReq = searchParams.get('openRequests');

    if (convId && convId !== activeConversationId) {
      setActiveConversationId(convId);
    }
    if (openReq === 'true') {
      setIsRequestsOpen(true);
    }
  }, [searchParams, activeConversationId, setActiveConversationId]);

  // Support real-time window events emitted when toast notifications are clicked
  useEffect(() => {
    const handleOpenConv = (e: any) => {
      if (e.detail?.conversationId) {
        setActiveConversationId(e.detail.conversationId);
        setSearchParams({ conversationId: e.detail.conversationId });
      }
    };
    const handleOpenReqs = () => {
      setIsRequestsOpen(true);
    };

    window.addEventListener('mcom_open_chat_conversation', handleOpenConv);
    window.addEventListener('mcom_open_message_requests', handleOpenReqs);

    return () => {
      window.removeEventListener('mcom_open_chat_conversation', handleOpenConv);
      window.removeEventListener('mcom_open_message_requests', handleOpenReqs);
    };
  }, [setActiveConversationId, setSearchParams]);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-[calc(100vh-140px)] min-h-[580px] flex">
      {/* Sidebar List - responsive: hides on small screens when conversation active */}
      <div
        className={`w-full md:w-80 lg:w-96 shrink-0 h-full border-r border-gray-100 ${
          activeConversation ? 'hidden md:block' : 'block'
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          connectionState={connectionState}
          isLoading={isLoadingConversations}
          onSelect={(id) => {
            setActiveConversationId(id);
            setSearchParams({ conversationId: id });
          }}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenRequests={() => {
            setIsRequestsOpen(true);
            setSearchParams({ openRequests: 'true' });
          }}
          pendingRequestsCount={pendingRequestsCount}
        />
      </div>

      {/* Main Conversation Area */}
      <div
        className={`flex-1 h-full bg-[#FAFAFA] ${
          !activeConversation ? 'hidden md:flex flex-col' : 'flex flex-col'
        }`}
      >
        {activeConversation ? (
          <ConversationView
            conversation={activeConversation}
            messages={messages}
            isLoading={isLoadingMessages}
            typingUsers={typingUsers}
            onBack={() => {
              setActiveConversationId(null);
              setSearchParams({});
            }}
            onSend={sendMessage}
            onTyping={handleTypingKeystroke}
            onOpenReceipts={openReceipts}
            onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3 shadow-inner">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-gray-900 text-base">Select a Conversation</h3>
            <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
              Choose an existing chat from the left or click "New" to message any business owner, customer, agent, or administrator in the network.
            </p>
            <button
              type="button"
              onClick={() => setIsNewChatOpen(true)}
              className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Start New Chat
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setSearchParams({ conversationId: id });
          refetchConversations();
        }}
      />

      {/* Group Info Modal */}
      <GroupInfoModal
        isOpen={isGroupInfoOpen}
        conversation={activeConversation || null}
        onClose={() => setIsGroupInfoOpen(false)}
        onRefresh={refetchConversations}
      />

      {/* Read Receipts Inspector */}
      <ReadReceiptsModal
        data={receiptsModalData}
        onClose={closeReceipts}
      />

      {/* Message Requests Modal */}
      <MessageRequestsModal
        isOpen={isRequestsOpen}
        onClose={() => {
          setIsRequestsOpen(false);
          if (searchParams.get('openRequests')) {
            setSearchParams({});
          }
        }}
        onOpenConversation={(id) => {
          setActiveConversationId(id);
          setSearchParams({ conversationId: id });
          refetchConversations();
          refetchRequests();
        }}
      />
    </div>
  );
}
