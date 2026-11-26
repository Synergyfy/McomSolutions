import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Users,
  BellOff,
  Bell,
  LogOut,
  Crown,
  ShieldCheck,
  Shield,
  Trash2,
  Pencil,
  Check,
  Lock,
} from 'lucide-react';
import { ConversationSummary, chatApi } from '../../services/chat';
import { cn } from '../../lib/utils';

interface GroupInfoModalProps {
  conversation: ConversationSummary | null;
  currentUserId?: string | null;
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
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state whenever a different group is opened.
  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft(conversation?.title || '');
    setError(null);
  }, [conversation?.id, conversation?.title]);

  if (!isOpen || !conversation) return null;

  const isGroupAdmin = conversation.role === 'ADMIN';
  const isOwner = Boolean(conversation.isOwner);
  const isAdminOnly = Boolean(conversation.isAdminOnly);

  const handleToggleMute = async () => {
    setIsMuting(true);
    try {
      await chatApi.muteConversation(conversation.id, !conversation.isMuted);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update mute');
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
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to leave group');
    } finally {
      setIsLeaving(false);
    }
  };

  /**
   * Turns the group into a broadcast channel (admins post, members read) or
   * opens it back up to everyone.
   */
  const handleToggleAdminOnly = async () => {
    setIsSavingSettings(true);
    setError(null);
    try {
      await chatApi.updateGroupSettings(conversation.id, { isAdminOnly: !isAdminOnly });
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update group settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveTitle = async () => {
    const title = titleDraft.trim();
    if (!title) {
      setError('Group name cannot be empty');
      return;
    }
    if (title === conversation.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingSettings(true);
    setError(null);
    try {
      await chatApi.updateGroupSettings(conversation.id, { title });
      setIsEditingTitle(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to rename group');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, role: 'ADMIN' | 'MEMBER') => {
    setBusyUserId(targetUserId);
    setError(null);
    try {
      await chatApi.setParticipantRole(conversation.id, targetUserId, role);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update member role');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleTransferOwnership = async (targetUserId: string) => {
    if (!confirm('Transfer group ownership to this member?')) return;
    setBusyUserId(targetUserId);
    setError(null);
    try {
      await chatApi.transferOwnership(conversation.id, targetUserId);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to transfer ownership');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm('Remove this member from the group?')) return;
    setBusyUserId(targetUserId);
    setError(null);
    try {
      await chatApi.removeParticipant(conversation.id, targetUserId);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove member');
    } finally {
      setBusyUserId(null);
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

            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 w-full max-w-[240px]">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  maxLength={100}
                  autoFocus
                  className="flex-1 min-w-0 text-sm font-bold text-gray-900 border border-orange-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={isSavingSettings}
                  className="p-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-base text-gray-900">{conversation.title}</h4>
                {isGroupAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(conversation.title);
                      setIsEditingTitle(true);
                    }}
                    title="Rename group"
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 mt-0.5">
              {conversation.participantsCount} participants
            </p>

            {/* Role + mode badges */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
              {isOwner && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700">
                  <Crown className="w-2.5 h-2.5" /> Owner
                </span>
              )}
              {isGroupAdmin && !isOwner && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700">
                  <ShieldCheck className="w-2.5 h-2.5" /> Admin
                </span>
              )}
              {isAdminOnly && (
                <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                  <Lock className="w-2.5 h-2.5" /> Admins only
                </span>
              )}
            </div>

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

          {/* ─── Admin controls ─────────────────────────────────────────── */}
          {isGroupAdmin && (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">
                Admin Controls
              </p>

              <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900">Only admins can send messages</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                    Members can still read the group and receive notifications.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAdminOnly}
                  aria-label="Only admins can send messages"
                  onClick={handleToggleAdminOnly}
                  disabled={isSavingSettings}
                  className={cn(
                    'relative w-10 h-5 shrink-0 rounded-full transition-colors disabled:opacity-50',
                    isAdminOnly ? 'bg-orange-500' : 'bg-gray-300',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      isAdminOnly ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>

              {error && (
                <p className="mt-2 px-2 text-[11px] font-semibold text-red-600">{error}</p>
              )}
            </div>
          )}

          {error && !isGroupAdmin && (
            <p className="px-6 py-2 text-[11px] font-semibold text-red-600 border-b border-gray-100">
              {error}
            </p>
          )}

          {/* Participants Roster */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1">
              Participants ({conversation.participants.length})
            </p>
            {conversation.participants.map((p) => {
              const isSelf = p.userId === currentUserId;
              const isParticipantOwner = Boolean(p.isOwner);
              const canManage =
                isGroupAdmin && !isSelf && !isParticipantOwner && busyUserId !== p.userId;

              return (
                <div
                  key={p.userId}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center">
                        {p.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      {p.isOnline && (
                        <span className="w-2 h-2 bg-green-500 rounded-full border border-white absolute bottom-0 right-0" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900 flex items-center gap-1 flex-wrap">
                        <span className="truncate">{p.displayName}</span>
                        {isParticipantOwner && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 text-purple-700">
                            <Crown className="w-2 h-2" /> Owner
                          </span>
                        )}
                        {p.role === 'ADMIN' && !isParticipantOwner && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-orange-100 text-orange-700">
                            Admin
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-gray-100 text-gray-600">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">{p.roleTitle}</div>
                    </div>
                  </div>

                  {/* Admin actions */}
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleTransferOwnership(p.userId)}
                          title="Make owner"
                          className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {p.role === 'ADMIN' ? (
                        <button
                          type="button"
                          onClick={() => handleRoleChange(p.userId, 'MEMBER')}
                          title="Remove as admin"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRoleChange(p.userId, 'ADMIN')}
                          title="Make admin"
                          className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(p.userId)}
                        title="Remove from group"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
