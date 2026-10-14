import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  UserPlus,
  ShieldAlert,
  Check,
  Ban,
  RotateCcw,
  Clock,
  Send,
  UserCheck,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import {
  chatApi,
  MessageRequestsData,
  BlockedUserItem,
} from '../../services/chat';
import { cn } from '../../lib/utils';

interface MessageRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConversation?: (conversationId: string) => void;
}

type TabType = 'incoming' | 'outgoing' | 'blocked' | 'rejected';

export default function MessageRequestsModal({
  isOpen,
  onClose,
  onOpenConversation,
}: MessageRequestsModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Requests
  const requestsQuery = useQuery({
    queryKey: ['chat-message-requests'],
    queryFn: () => chatApi.getMessageRequests(),
    enabled: isOpen,
    refetchInterval: 15000,
  });

  // Fetch Blocked Users
  const blockedQuery = useQuery({
    queryKey: ['chat-blocked-users'],
    queryFn: () => chatApi.getBlockedUsers(),
    enabled: isOpen && activeTab === 'blocked',
  });

  // Respond Mutation
  const respondMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'ACCEPT' | 'REJECT' }) =>
      chatApi.respondMessageRequest(requestId, action),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chat-message-requests'] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      if (data.status === 'ACCEPTED' && data.conversationId && onOpenConversation) {
        onOpenConversation(data.conversationId);
        onClose();
      }
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Action failed');
    },
  });

  // Reset Rejection Mutation
  const resetMutation = useMutation({
    mutationFn: (senderId: string) => chatApi.resetRejectedRequest(senderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-message-requests'] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Reset failed');
    },
  });

  // Unblock Mutation
  const unblockMutation = useMutation({
    mutationFn: (targetUserId: string) => chatApi.unblockUser(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Unblock failed');
    },
  });

  // Retry Request Mutation
  const retryMutation = useMutation({
    mutationFn: ({ receiverId, message }: { receiverId: string; message?: string }) =>
      chatApi.sendMessageRequest(receiverId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-message-requests'] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Retry request failed');
    },
  });

  if (!isOpen) return null;

  const data: MessageRequestsData = requestsQuery.data || { incoming: [], outgoing: [], rejected: [] };
  const blockedList: BlockedUserItem[] = blockedQuery.data || [];

  const incomingCount = data.incoming.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden max-h-[85vh] border border-gray-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base">Message Requests</h3>
              <p className="text-xs text-gray-400">Manage chat requests and blocked contacts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-gray-100 px-5 gap-1 bg-white">
          <button
            type="button"
            onClick={() => { setActiveTab('incoming'); setActionError(null); }}
            className={cn(
              'px-3 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'incoming'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            <Inbox className="w-3.5 h-3.5" />
            Incoming
            {incomingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-orange-600 text-white">
                {incomingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('outgoing'); setActionError(null); }}
            className={cn(
              'px-3 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'outgoing'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            <Send className="w-3.5 h-3.5" />
            Outgoing ({data.outgoing.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('rejected'); setActionError(null); }}
            className={cn(
              'px-3 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'rejected'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Declined ({data.rejected.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('blocked'); setActionError(null); }}
            className={cn(
              'px-3 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer',
              activeTab === 'blocked'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            <Ban className="w-3.5 h-3.5" />
            Blocked ({blockedList.length})
          </button>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-700 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* TAB 1: INCOMING REQUESTS */}
          {activeTab === 'incoming' && (
            <>
              {data.incoming.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <UserCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-semibold">No pending message requests</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    When someone wants to initiate a chat with you, it will appear here.
                  </p>
                </div>
              ) : (
                data.incoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs hover:border-gray-200 transition-all flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          {req.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{req.displayName}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                              {req.role}
                            </span>
                            <span className="text-[10px] text-gray-400">•</span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {req.message ? (
                      <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-100/80 text-xs text-gray-800">
                        <span className="text-[10px] font-extrabold text-orange-700 uppercase tracking-wider block mb-0.5">
                          Note from Sender
                        </span>
                        <p className="italic font-medium leading-relaxed">"{req.message}"</p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 italic">
                        No introductory note was attached with this request.
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-50">
                      <button
                        type="button"
                        disabled={respondMutation.isPending}
                        onClick={() => respondMutation.mutate({ requestId: req.id, action: 'REJECT' })}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>

                      <button
                        type="button"
                        disabled={respondMutation.isPending}
                        onClick={() => respondMutation.mutate({ requestId: req.id, action: 'ACCEPT' })}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept & Chat
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 2: OUTGOING REQUESTS */}
          {activeTab === 'outgoing' && (
            <>
              {data.outgoing.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Send className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-semibold">No outgoing message requests</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Requests you send to other users will show their current status here.
                  </p>
                </div>
              ) : (
                data.outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs">
                          {req.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{req.displayName}</h4>
                          <span className="text-[10px] text-gray-400">{req.email}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {req.status === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                      {req.status === 'ACCEPTED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Accepted
                        </span>
                      )}
                      {req.status === 'REJECTED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Declined ({req.rejectionCount}/3)
                        </span>
                      )}
                    </div>

                    {req.message && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg italic">
                        "{req.message}"
                      </p>
                    )}

                    {/* Retry action if rejected and rejectionCount < 3 */}
                    {req.status === 'REJECTED' && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
                        <span className="text-[11px] text-gray-400">
                          {req.canRetry
                            ? `You can try again (${3 - req.rejectionCount} attempts remaining)`
                            : 'Maximum attempts reached (3/3 declined)'}
                        </span>

                        {req.canRetry && (
                          <button
                            type="button"
                            disabled={retryMutation.isPending}
                            onClick={() =>
                              retryMutation.mutate({
                                receiverId: req.receiverId,
                                message: 'Following up on my previous message request',
                              })
                            }
                            className="px-3 py-1 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Try Again
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 3: DECLINED BY YOU (CHANGE YOUR MIND) */}
          {activeTab === 'rejected' && (
            <>
              {data.rejected.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <RotateCcw className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-semibold">No declined requests</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Users whose requests you previously declined will show here if you wish to allow them to request again.
                  </p>
                </div>
              ) : (
                data.rejected.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-xs">
                        {req.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{req.displayName}</h4>
                        <span className="text-[10px] text-gray-400">
                          Declined {req.rejectionCount} {req.rejectionCount === 1 ? 'time' : 'times'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={resetMutation.isPending}
                      onClick={() => resetMutation.mutate(req.senderId)}
                      className="px-3 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Allow Requests
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 4: BLOCKED USERS */}
          {activeTab === 'blocked' && (
            <>
              {blockedList.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Ban className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-semibold">No blocked users</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Users you block will not be able to message you or send message requests.
                  </p>
                </div>
              ) : (
                blockedList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-gray-100 bg-white shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                        <Ban className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{item.displayName}</h4>
                        <span className="text-[10px] text-gray-400">
                          Blocked on {new Date(item.blockedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={unblockMutation.isPending}
                      onClick={() => unblockMutation.mutate(item.userId)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
