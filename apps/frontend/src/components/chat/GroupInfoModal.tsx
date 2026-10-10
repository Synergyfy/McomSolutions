import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Shield, BellOff, Bell, LogOut, UserPlus } from 'lucide-react';
import { ConversationSummary, chatApi } from '../../services/chat';
import { cn } from '../../lib/utils';

interface GroupInfoModalProps {
  conversation: ConversationSummary | null;
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function GroupInfoModal({
  conversation,
  currentUserId,
  isOpen,
  onClose,
  onRefresh,
}: GroupInfoModalProps) {
  const [isMuting, setIsMuting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  if (!isOpen || !conversation) return null;

  const isAdmin = conversation.role === 'ADMIN';

  const handleToggleMute = async () => {
    setIsMuting(true);
    try {
      await chatApi.muteConversation(conversation.id, !conversation.isMuted);
      onRefresh();
    } catch (err) {
      console.error('Failed to update mute:', err);
    } finally {
      setIsMuting(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentUserId || !confirm('Are you sure you want to leave this group?')) return;
    setIsLeaving(true);
    try {
      await chatApi.removeParticipant(conversation.id, currentUserId);
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to leave group:', err);
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-gray-100 flex flex-col max-h-[80vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Group Info</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Group Profile */}
          <div className="p-6 text-center border-b border-gray-100 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg mb-2 shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-base text-gray-900">{conversation.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {conversation.participantsCount} participants
            </p>

            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={handleToggleMute}
                disabled={isMuting}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer',
                  conversation.isMuted
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
                )}
              >
                {conversation.isMuted ? (
                  <>
                    <BellOff className="w-3.5 h-3.5" /> Muted
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" /> Mute
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleLeaveGroup}
                disabled={isLeaving}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Leave
              </button>
            </div>
          </div>

          {/* Participants Roster */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1">
              Participants ({conversation.participants.length})
            </p>
            {conversation.participants.map((p) => (
              <div
                key={p.userId}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                      {p.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    {p.isOnline && (
                      <span className="w-2 h-2 bg-green-500 rounded-full border border-white absolute bottom-0 right-0" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900 flex items-center gap-1">
                      {p.displayName}
                      {p.role === 'ADMIN' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-orange-100 text-orange-700">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400">{p.roleTitle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
