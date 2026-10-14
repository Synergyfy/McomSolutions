import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCheck, Clock, ShieldCheck, User } from 'lucide-react';
import { MessageReceiptsResponse } from '../../services/chat';

interface ReadReceiptsModalProps {
  data: MessageReceiptsResponse | null;
  onClose: () => void;
}

export default function ReadReceiptsModal({ data, onClose }: ReadReceiptsModalProps) {
  if (!data) return null;

  const formatReadTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
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
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
                <CheckCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Read Receipts</h3>
                <p className="text-xs text-gray-500">
                  Seen by {data.readersCount} of {data.totalRecipients} recipients
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Readers List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">
                Read By ({data.readers.length})
              </p>
              {data.readers.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  No one has read this message yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.readers.map((reader) => (
                    <div
                      key={reader.userId}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {reader.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                            {reader.displayName}
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-gray-100 text-gray-600 uppercase">
                              {reader.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            Read at {formatReadTime(reader.readAt)}
                          </div>
                        </div>
                      </div>
                      <CheckCheck className="w-4 h-4 text-orange-500 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unread Recipients */}
            {data.allRecipients.some((r) => !r.hasRead) && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">
                  Delivered / Unread ({data.allRecipients.filter((r) => !r.hasRead).length})
                </p>
                <div className="space-y-1.5 opacity-70">
                  {data.allRecipients
                    .filter((r) => !r.hasRead)
                    .map((unseen) => (
                      <div
                        key={unseen.userId}
                        className="flex items-center justify-between p-2 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 font-bold text-[10px] flex items-center justify-center">
                            {unseen.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs text-gray-700">{unseen.displayName}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">Delivered</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
