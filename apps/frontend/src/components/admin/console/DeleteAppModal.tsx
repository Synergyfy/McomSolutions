import { useState } from 'react';
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Radio,
  ShieldAlert,
  Trash2,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import { useDeleteApp } from './hooks/useConsoleApps';

interface DeleteAppModalProps {
  app: {
    clientId: string;
    name: string;
  };
  onClose: () => void;
  onDeleted?: () => void;
}

export default function DeleteAppModal({ app, onClose, onDeleted }: DeleteAppModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deleteApp = useDeleteApp();

  const isConfirmed = confirmInput.trim() === app.clientId;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setErrorMsg(null);

    try {
      await deleteApp.mutateAsync(app.clientId);
      if (onDeleted) {
        onDeleted();
      }
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;

      if (status === 403) {
        setErrorMsg(serverMsg || 'You need ADMIN role access to delete applications.');
      } else if (status === 404) {
        setErrorMsg('Application was not found or has already been deleted.');
      } else {
        setErrorMsg(serverMsg || 'Failed to delete application. Please try again.');
      }
    }
  };

  const purgeItems = [
    { icon: KeyRound, label: 'OAuth Credentials & Encrypted Secrets (API Keys, HMAC, Webhook)' },
    { icon: Users, label: 'All active user SSO sessions and authorization codes' },
    { icon: Webhook, label: 'Webhook delivery logs and diagnostic event history' },
    { icon: Radio, label: 'CORS whitelist registrations and fast Redis cache entries' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={deleteApp.isPending ? undefined : onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-7 border border-red-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={deleteApp.isPending}
          className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Danger Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100/80 border border-red-200 text-red-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-lg font-display">Delete Application</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                Irreversible
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Permanently remove <strong className="text-gray-900 font-semibold">{app.name}</strong> ({app.clientId}) from MCOM.
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-red-50/80 border border-red-200/80 rounded-2xl p-3.5 mb-4 text-xs text-red-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold">Warning:</strong> This action cannot be undone. All traces of this application will be completely purged from our databases, caches, and authentication services.
          </div>
        </div>

        {/* Purge Breakdown */}
        <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 mb-5 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            The following traces will be wiped:
          </span>
          {purgeItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                <Icon className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <span className="text-[11px] leading-tight">{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Confirmation Input Gate */}
        <div className="mb-5 space-y-1.5">
          <label className="block text-xs font-bold text-gray-700">
            To confirm, type <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 select-all">{app.clientId}</span> below:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={deleteApp.isPending}
            placeholder={app.clientId}
            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
            autoFocus
          />
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteApp.isPending}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || deleteApp.isPending}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {deleteApp.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting Traces...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
