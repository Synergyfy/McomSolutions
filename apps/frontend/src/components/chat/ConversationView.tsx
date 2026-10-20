import React, { useRef, useEffect, useState } from 'react';
import { ArrowLeft, MoreVertical, Users, Shield, Circle, UserX, AlertTriangle } from 'lucide-react';
import { ConversationSummary, ChatMessage, chatApi } from '../../services/chat';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';

interface ConversationViewProps {
  conversation: ConversationSummary;
  messages: ChatMessage[];
  isLoading: boolean;
  typingUsers: Array<{ userId: string; userName: string }>;
  onBack: () => void;
  onSend: (content: string) => void;
  onTyping: () => void;
  onOpenReceipts: (messageId: string) => void;
  onOpenGroupInfo: () => void;
}

export default function ConversationView({
  conversation,
  messages,
  isLoading,
  typingUsers,
  onBack,
  onSend,
  onTyping,
  onOpenReceipts,
  onOpenGroupInfo,
}: ConversationViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const isGroup = conversation.type === 'GROUP';

  const currentUserId = (() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.sub || payload.id || null;
      }
    } catch {}
    return null;
  })();

  const otherParticipant =
    conversation.participants.find((p) => p.userId !== currentUserId) ||
    conversation.participants[0];
  const isOtherAdmin = otherParticipant?.roleTitle === 'ADMIN';

  const handleBlockUser = async () => {
    if (!otherParticipant) return;
    setIsBlocking(true);
    try {
      await chatApi.blockUser(otherParticipant.userId);
      setIsBlockConfirmOpen(false);
      onBack();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to block user');
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-xs shrink-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center shrink-0">
              {isGroup ? (
                <Users className="w-4 h-4 text-orange-600" />
              ) : (
                conversation.title.slice(0, 2).toUpperCase()
              )}
            </div>
            {!isGroup && conversation.isOnline && (
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white absolute bottom-0 right-0" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs sm:text-sm text-gray-900 line-clamp-1">
              {conversation.title}
            </h4>
            <div className="text-[10px] text-gray-400 flex items-center gap-1">
              {isGroup ? (
                <span>{conversation.participantsCount} participants</span>
              ) : conversation.isOnline ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" /> Active now
                </span>
              ) : (
                <span>Offline</span>
              )}
            </div>
          </div>
        </div>

        {isGroup ? (
          <button
            type="button"
            onClick={onOpenGroupInfo}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                {isOtherAdmin ? (
                  <div className="px-3.5 py-2 text-[11px] text-gray-400 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Administrator (Cannot be blocked)</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsBlockConfirmOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50/80 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Block User</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block Confirmation Modal */}
      {isBlockConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setIsBlockConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              Block {conversation.title}?
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              They will not be able to send you messages or message requests. You will not receive any notifications from them. You can unblock them at any time in Message Requests.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBlockConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlockUser}
                disabled={isBlocking}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isBlocking ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-gray-400 py-12">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-2">
              👋
            </div>
            <p className="text-xs font-semibold text-gray-700">No messages yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Send a message to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id || msg.clientTempId}
              message={msg}
              isGroup={isGroup}
              onOpenReceipts={onOpenReceipts}
            />
          ))
        )}

        <TypingIndicator typingUsers={typingUsers} />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <MessageComposer onSend={onSend} onTyping={onTyping} />
    </div>
  );
}
