import React from 'react';
import { Clock, Check, CheckCheck, AlertCircle } from 'lucide-react';
import { ChatMessage } from '../../services/chat';
import { cn } from '../../lib/utils';

interface MessageBubbleProps {
  key?: React.Key;
  message: ChatMessage;
  isGroup: boolean;
  onOpenReceipts: (messageId: string) => void;
}

export default function MessageBubble({
  message,
  isGroup,
  onOpenReceipts,
}: MessageBubbleProps) {
  const isMe = message.isSender;
  const isSystem = message.type === 'SYSTEM';

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] italic font-medium text-gray-500 bg-gray-100/90 px-3 py-1 rounded-full border border-gray-200/50">
          {message.content}
        </span>
      </div>
    );
  }

  const renderStatus = () => {
    if (!isMe) return null;

    if (message.status === 'failed') {
      return <AlertCircle className="w-3 h-3 text-red-300 ml-1 inline" />;
    }

    if (message.status === 'pending') {
      return <Clock className="w-3 h-3 text-orange-200 ml-1 inline animate-spin" />;
    }

    const hasBeenRead = message.readCount > 1;

    return (
      <button
        type="button"
        onClick={() => onOpenReceipts(message.id)}
        title="View read receipts"
        className="inline-flex items-center gap-0.5 ml-1 text-orange-200 hover:text-white transition-colors cursor-pointer"
      >
        {hasBeenRead ? (
          <>
            <CheckCheck className="w-3.5 h-3.5 text-white" />
            {isGroup && (
              <span className="text-[9px] font-bold underline decoration-white/40">
                {message.readCount - 1}
              </span>
            )}
          </>
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </button>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col mb-3 max-w-[82%]',
        isMe ? 'ml-auto items-end' : 'mr-auto items-start',
      )}
    >
      {/* Sender Name in Group Chat */}
      {isGroup && !isMe && (
        <span className="text-[10px] font-bold text-gray-500 mb-1 ml-1 flex items-center gap-1">
          {message.senderName}
          <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-gray-100 text-gray-500 uppercase">
            {message.senderRole}
          </span>
        </span>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm break-words',
          isMe
            ? 'bg-orange-600 text-white rounded-br-xs'
            : 'bg-white text-gray-900 border border-gray-100 rounded-bl-xs',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div
          className={cn(
            'flex items-center justify-end gap-1 mt-1 text-[10px]',
            isMe ? 'text-orange-100' : 'text-gray-400',
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}
