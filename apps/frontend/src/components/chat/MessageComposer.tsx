import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface MessageComposerProps {
  onSend: (content: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}

export default function MessageComposer({
  onSend,
  onTyping,
  disabled,
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!content.trim() || disabled) return;
    onSend(content);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping();

    // Auto-grow
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="p-3 border-t border-gray-100 bg-white/80 backdrop-blur-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/10 transition-all"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send)"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none max-h-28 min-h-[24px]"
        />
        <button
          type="submit"
          disabled={!content.trim() || disabled}
          className="p-2 rounded-xl bg-orange-600 text-white disabled:opacity-40 hover:bg-orange-700 transition-colors shrink-0 shadow-sm cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
