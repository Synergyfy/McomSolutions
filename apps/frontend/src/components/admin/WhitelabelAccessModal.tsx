import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  Check,
  Info,
  Layers,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useBusinessWhitelabelAccess,
  useSetBusinessWhitelabelAccess,
} from '../../services/admin/hooks';

interface WhitelabelAccessModalProps {
  business: { id: string; name: string };
  onClose: () => void;
}

/**
 * Business-only white-label grant editor.
 *
 * Lists every platform that opted into white-label mode in the Console and
 * lets an admin grant/revoke this business's access. Grants bypass membership
 * and access-pass checks entirely — a granted business enters the platform
 * dashboard directly.
 */
export default function WhitelabelAccessModal({ business, onClose }: WhitelabelAccessModalProps) {
  const { data, isLoading } = useBusinessWhitelabelAccess(business.id);
  const setAccess = useSetBusinessWhitelabelAccess();
  const access = data?.data;

  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (access) setSelected(access.grantedClientIds);
  }, [access]);

  const toggle = (clientId: string) =>
    setSelected((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );

  const handleSave = async () => {
    setError(null);
    try {
      await setAccess.mutateAsync({ businessId: business.id, clientIds: selected });
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) setError('This business or platform could not be found.');
      else if (status === 400) setError(err?.response?.data?.message || 'Some platforms are not white-label enabled.');
      else if (status === 403) setError('You need ADMIN access to grant white-label access.');
      else setError('Failed to save white-label access. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-3xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Give White-Label Access</h4>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {business.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-start gap-2.5 p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl">
            <Info className="w-4 h-4 text-brand-blue flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-600 leading-relaxed">
              White-label platforms do <b>not</b> check membership or access passes. A granted
              business can sign in via SSO and go straight to the platform dashboard. Only
              businesses can receive this access.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
            </div>
          ) : access && access.platforms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-gray-200 rounded-2xl">
              <Layers className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-xs font-bold text-gray-600">No white-label platforms yet</p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                Register a platform in <b>/admin/console</b> and enable “Allow white-label” on it
                first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(access?.platforms ?? []).map((platform) => {
                const isSelected = selected.includes(platform.clientId);
                return (
                  <button
                    key={platform.clientId}
                    type="button"
                    onClick={() => toggle(platform.clientId)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all',
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0',
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {platform.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {platform.name}
                        </span>
                        {platform.platformSlug && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] font-mono font-bold text-gray-500">
                            {platform.platformSlug}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono truncate">
                        {platform.clientId}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0',
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-gray-300 text-transparent',
                      )}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] font-bold text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-bold text-gray-400">
            {selected.length} platform{selected.length === 1 ? '' : 's'} granted
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-50 rounded-xl font-bold text-xs text-gray-500 hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={setAccess.isPending || isLoading}
              className="px-5 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow disabled:opacity-50 flex items-center gap-2"
            >
              {setAccess.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Access
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
