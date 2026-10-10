import React, { useState } from 'react';
import { Search, Plus, Users, MessageSquare, BellOff, WifiOff, UserPlus } from 'lucide-react';
import { ConversationSummary } from '../../services/chat';
import { ConnectionState } from '../../services/chat/connection';
import { cn } from '../../lib/utils';

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  connectionState: ConnectionState;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onOpenNewChat: () => void;
  onOpenRequests?: () => void;
  pendingRequestsCount?: number;
}

export default function ConversationList({
  conversations,
  activeConversationId,
  connectionState,
  isLoading,
  onSelect,
  onOpenNewChat,
  onOpenRequests,
  pendingRequestsCount,
}: ConversationListProps) {
  const [filter, setFilter] = useState('');

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase()) ||
    c.lastMessageText?.toLowerCase().includes(filter.toLowerCase()),
  );

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-gray-900 text-base">Messages</h3>
          <p className="text-[11px] text-gray-400">Real-time team & client chat</p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenRequests && (
            <button
              type="button"
              onClick={onOpenRequests}
              className="p-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold relative"
              title="Message Requests & Blocked"
            >
              <UserPlus className="w-4 h-4 text-gray-600" />
              <span className="hidden sm:inline">Requests</span>
              {typeof pendingRequestsCount === 'number' && pendingRequestsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-orange-600 absolute -top-1 -right-1 ring-2 ring-white" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNewChat}
            className="p-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      {/* Connection Notice */}
      {connectionState !== 'CONNECTED' && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-[11px] font-medium text-amber-700 flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 animate-pulse shrink-0" />
          <span>
            {connectionState === 'CONNECTING' || connectionState === 'RECONNECTING'
              ? 'Connecting to real-time server...'
              : connectionState === 'SUSPENDED'
              ? 'Real-time suspended. Tap to resume.'
              : 'Offline. Using cached messages.'}
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
          />
        </div>
      </div>

      {/* Conversation Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 px-2">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-gray-400">Loading inbox...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center px-4">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-gray-700">No conversations</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Start a chat with any user!</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isGroup = conv.type === 'GROUP';
            const isSelected = conv.id === activeConversationId;

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all my-0.5',
                  isSelected
                    ? 'bg-orange-50/80 border border-orange-200/60 shadow-xs'
                    : 'hover:bg-gray-50/80',
                )}
              >
                {/* Avatar with presence */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                    {isGroup ? (
                      <Users className="w-5 h-5 text-orange-600" />
                    ) : (
                      conv.title.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  {!isGroup && conv.isOnline && (
                    <span className="w-3 h-3 bg-green-500 border-2 border-white rounded-full absolute bottom-0 right-0 shadow-xs" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-xs text-gray-900 truncate flex items-center gap-1.5">
                      {conv.title}
                      {conv.isMuted && <BellOff className="w-3 h-3 text-gray-400 shrink-0" />}
                    </h4>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {formatTimestamp(conv.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-gray-500 truncate pr-2">
                      {conv.lastMessageText || 'No messages yet'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 min-w-[18px] text-center rounded-full bg-orange-600 text-white font-bold text-[10px] shrink-0 shadow-xs">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
