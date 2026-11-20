import React, { useState, useEffect, useRef } from 'react';
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
  const [directChatStatus, setDirectChatStatus] = useState<'idle' | 'opening' | 'error'>('idle');
  const [directChatRetry, setDirectChatRetry] = useState(0);
  const openingRecipientRef = useRef<string | null>(null);

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

  // Find Affiliates links here with the selected CHS user ID. Resolve the
  // existing direct-chat endpoint, then replace recipientId with the resulting
  // conversationId so refreshes do not create another conversation.
  useEffect(() => {
    const recipientId = searchParams.get('recipientId');
    if (!recipientId) {
      openingRecipientRef.current = null;
      setDirectChatStatus('idle');
      return;
    }
    if (isLoadingConversations || openingRecipientRef.current === recipientId) return;

    openingRecipientRef.current = recipientId;
    let cancelled = false;
    setDirectChatStatus('opening');

    chatApi.getOrCreateDirect(recipientId)
      .then((conversation) => {
        if (cancelled) return;
        setActiveConversationId(conversation.id);
        setSearchParams({ conversationId: conversation.id }, { replace: true });
        void refetchConversations();
        setDirectChatStatus('idle');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Could not open the requested direct conversation', error);
        openingRecipientRef.current = null;
        setDirectChatStatus('error');
      });

    return () => {
      cancelled = true;
      if (openingRecipientRef.current === recipientId) openingRecipientRef.current = null;
    };
  }, [searchParams, isLoadingConversations, directChatRetry, setActiveConversationId, setSearchParams, refetchConversations]);

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
    <div className="relative bg-white rounded-xl md:rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-[calc(100dvh-15rem)] min-h-[320px] max-h-[720px] md:min-h-[420px] lg:h-[calc(100dvh-13rem)] lg:min-h-[460px] flex">
      {directChatStatus !== 'idle' && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-md" role={directChatStatus === 'error' ? 'alert' : 'status'}>
          {directChatStatus === 'opening' ? 'Opening conversation…' : (
            <span className="flex items-center gap-3">
              Could not open this conversation. Please try again.
              <button type="button" className="font-semibold text-blue-700 underline" onClick={() => setDirectChatRetry((attempt) => attempt + 1)}>Retry</button>
            </span>
          )}
        </div>
      )}
      {/* Sidebar List - responsive: hides on small screens when conversation active */}
      <div
        className={`w-full lg:w-80 xl:w-96 shrink-0 h-full border-r border-gray-100 ${
          activeConversation ? 'hidden lg:block' : 'block'
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
          !activeConversation ? 'hidden lg:flex flex-col' : 'flex flex-col'
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
            <div className="mb-3 text-orange-600">
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
