import React from 'react';
import { motion } from 'motion/react';

interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>;
}

export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (!typingUsers || typingUsers.length === 0) return null;

  let label = '';
  if (typingUsers.length === 1) {
    label = `${typingUsers[0].userName} is typing...`;
  } else if (typingUsers.length === 2) {
    label = `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
  } else {
    label = `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing...`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-gray-500 animate-fade-in">
      <div className="flex items-center gap-1 bg-gray-100/80 px-2.5 py-1 rounded-full">
        <motion.span
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
          className="w-1.5 h-1.5 bg-orange-500 rounded-full inline-block"
        />
        <motion.span
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
          className="w-1.5 h-1.5 bg-orange-500 rounded-full inline-block"
        />
        <motion.span
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
          className="w-1.5 h-1.5 bg-orange-500 rounded-full inline-block"
        />
      </div>
      <span className="italic font-medium text-[11px] text-gray-500">{label}</span>
    </div>
  );
}
