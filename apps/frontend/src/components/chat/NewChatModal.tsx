import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Users,
  User,
  Check,
  Plus,
  MessageSquare,
  Mail,
  Send,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { chatApi, UserDirectoryItem } from '../../services/chat';
import { cn } from '../../lib/utils';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}

const QUICK_NOTES = [
  { label: '💼 Partnership', text: "Hi, I'd like to discuss a potential business partnership." },
  { label: '📦 Order Inquiry', text: 'Hello, I have an inquiry regarding a product or listing.' },
  { label: '🤝 Connect', text: "Hi, I'd like to connect with your business on the platform." },
  { label: '❓ Quick Question', text: 'Hi, I have a quick question and would appreciate a quick chat.' },
];

export default function NewChatModal({
  isOpen,
  onClose,
  onSelectConversation,
}: NewChatModalProps) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserDirectoryItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedDirectUser, setSelectedDirectUser] = useState<UserDirectoryItem | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedUserIds([]);
      setGroupTitle('');
      setSelectedDirectUser(null);
      setRequestNote('');
      setError(null);
      setSuccessMessage(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(() => {
      chatApi
        .searchUsers(searchQuery)
        .then((res) => {
          if (isMounted) {
            setUsers(res);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoading(false);
        });
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  const handleSendDirectRequest = async () => {
    if (!selectedDirectUser) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const targetName = formatUserName(selectedDirectUser);
      const res = await chatApi.sendMessageRequest(
        selectedDirectUser.id,
        requestNote.trim() || undefined,
      );

      if (res.status === 'ACCEPTED' && res.conversationId) {
        onSelectConversation(res.conversationId);
        onClose();
      } else {
        setSuccessMessage(
          `Message request sent to ${targetName}! Your introduction note was delivered.`,
        );
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to start conversation or send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      setError('Please provide a group name');
      return;
    }
    if (selectedUserIds.length < 1) {
      setError('Select at least one participant');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const conv = await chatApi.createGroup({
        title: groupTitle.trim(),
        participantIds: selectedUserIds,
      });
      onSelectConversation(conv.id);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const formatUserName = (u: UserDirectoryItem) => {
    if (u.businessName) return u.businessName;
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return full || u.email.split('@')[0];
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {selectedDirectUser && mode === 'direct' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDirectUser(null);
                    setError(null);
                  }}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 mr-1 transition-colors"
                  title="Back to user list"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="font-bold text-gray-900 text-base">
                {selectedDirectUser && mode === 'direct'
                  ? 'Send Message Request'
                  : 'New Conversation'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher - only when not in direct message composer */}
          {(!selectedDirectUser || mode === 'group') && (
            <div className="flex p-1.5 mx-6 mt-4 bg-gray-100 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setMode('direct');
                  setSelectedDirectUser(null);
                }}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5',
                  mode === 'direct' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                <User className="w-3.5 h-3.5" />
                Direct Message
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('group');
                  setSelectedDirectUser(null);
                }}
                className={cn(
                  'flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5',
                  mode === 'group' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Group Chat
              </button>
            </div>
          )}

          {/* Group Title Input */}
          {mode === 'group' && (
            <div className="px-6 pt-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Group Name</label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="e.g. Project Delivery Team"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          )}

          {/* DIRECT MODE: WHEN A TARGET USER IS SELECTED -> COMPOSER VIEW */}
          {mode === 'direct' && selectedDirectUser ? (
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Recipient Profile Card */}
              <div className="p-3.5 rounded-2xl bg-orange-50/50 border border-orange-100 flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                    {formatUserName(selectedDirectUser).slice(0, 2).toUpperCase()}
                  </div>
                  {selectedDirectUser.isOnline && (
                    <span className="w-3 h-3 bg-green-500 border-2 border-white rounded-full absolute bottom-0 right-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 text-xs truncate">
                      {formatUserName(selectedDirectUser)}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-800 uppercase shrink-0">
                      {selectedDirectUser.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {selectedDirectUser.email}
                  </p>
                  {selectedDirectUser.businessName && selectedDirectUser.firstName && (
                    <p className="text-[10px] text-gray-400 truncate">
                      Contact: {selectedDirectUser.firstName} {selectedDirectUser.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* Guidance Notice */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-600 text-xs">
                {selectedDirectUser.role === 'ADMIN' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Admins are automatically available for instant communication without pending approvals.
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <span>
                      Attach a brief message so {formatUserName(selectedDirectUser)} understands why you want to connect.
                    </span>
                  </>
                )}
              </div>

              {/* Quick Note Presets */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Quick Introduction Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_NOTES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setRequestNote(preset.text)}
                      className={cn(
                        'text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left font-medium',
                        requestNote === preset.text
                          ? 'bg-orange-100 border-orange-300 text-orange-800 font-bold'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-orange-200 hover:bg-orange-50/50',
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Note Textarea */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">
                    Your Message / Reason for Connecting
                  </label>
                  <span className="text-[10px] text-gray-400">
                    {requestNote.length} / 500
                  </span>
                </div>
                <textarea
                  value={requestNote}
                  maxLength={500}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="e.g. Hello! I saw your store items and would like to ask a few questions before placing an order..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none placeholder:text-gray-400"
                />
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-medium">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDirectUser(null)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  Choose Other
                </button>
                <button
                  type="button"
                  onClick={handleSendDirectRequest}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {selectedDirectUser.role === 'ADMIN'
                          ? 'Start Conversation'
                          : 'Send Message Request'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* DIRECT OR GROUP USER DIRECTORY SEARCH LIST */
            <>
              {/* Search bar */}
              <div className="px-6 py-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email address, business, or role..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {error && (
                <div className="mx-6 p-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-medium">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="mx-6 p-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Users List */}
              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                  Platform Directory (All User Roles)
                </p>

                {isLoading ? (
                  <div className="py-8 text-center text-xs text-gray-400">Loading directory...</div>
                ) : users.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No users found matching "{searchQuery}"
                  </div>
                ) : (
                  users.map((u) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    const name = formatUserName(u);
                    const isEmailMatch =
                      searchQuery.trim().length > 0 &&
                      u.email.toLowerCase().includes(searchQuery.trim().toLowerCase());

                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (mode === 'direct') {
                            setSelectedDirectUser(u);
                            setRequestNote('');
                            setError(null);
                          } else {
                            toggleUserSelection(u.id);
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all border group',
                          isSelected && mode === 'group'
                            ? 'bg-orange-50/70 border-orange-200'
                            : 'border-transparent hover:bg-orange-50/40 hover:border-orange-100',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {name.slice(0, 2).toUpperCase()}
                            </div>
                            {u.isOnline && (
                              <span className="w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full absolute bottom-0 right-0" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                              {name}
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-600 uppercase">
                                {u.role}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                              <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className={cn(isEmailMatch ? 'text-orange-600 font-semibold' : '')}>
                                {u.email}
                              </span>
                              {u.businessName && (
                                <span className="text-[10px] text-gray-400 hidden sm:inline">
                                  • {u.firstName} {u.lastName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {mode === 'group' ? (
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full border flex items-center justify-center transition-all',
                              isSelected
                                ? 'bg-orange-600 border-orange-600 text-white'
                                : 'border-gray-300',
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[11px] text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                            <span>Select</span>
                            <MessageSquare className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Group Submit Button */}
              {mode === 'group' && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    {selectedUserIds.length} participant{selectedUserIds.length === 1 ? '' : 's'} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={isSubmitting || selectedUserIds.length === 0 || !groupTitle.trim()}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isSubmitting ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
