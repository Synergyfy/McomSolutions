import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Star, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

const WILDCARD = '*';

export interface PeerAppOption {
  clientId: string;
  name: string;
}

interface AppPeerSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  apps: PeerAppOption[];
  excludeClientId?: string;
  allowWildcard?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyHint?: string;
}

/**
 * Searchable multi-select of registered apps for a peer policy list.
 * Stores canonical clientIds. Supports a mutually-exclusive "Anyone (*)" option.
 */
export default function AppPeerSelect({
  value,
  onChange,
  apps,
  excludeClientId,
  allowWildcard = true,
  disabled,
  placeholder = 'Select apps…',
  emptyHint,
}: AppPeerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const options = useMemo(
    () => apps.filter((a) => a.clientId !== excludeClientId),
    [apps, excludeClientId],
  );
  const byId = useMemo(() => new Map(apps.map((a) => [a.clientId, a])), [apps]);

  const hasWildcard = value.includes(WILDCARD);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (a) => a.name.toLowerCase().includes(q) || a.clientId.toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (clientId: string) => {
    const next = value.includes(clientId)
      ? value.filter((v) => v !== clientId)
      : [...value.filter((v) => v !== WILDCARD), clientId];
    onChange(next);
  };

  const toggleWildcard = () => onChange(hasWildcard ? [] : [WILDCARD]);
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-left min-h-[42px] transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {value.length === 0 ? (
            <span className="text-xs text-gray-400 font-medium px-1">{placeholder}</span>
          ) : (
            value.map((v) => (
              <span
                key={v}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border',
                  v === WILDCARD
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue',
                )}
              >
                {v === WILDCARD ? (
                  <>
                    <Star className="w-3 h-3" /> Anyone
                  </>
                ) : (
                  byId.get(v)?.name ?? v
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(v);
                  }}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 rounded-2xl shadow-2xl p-2 space-y-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps…"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>

          {allowWildcard && (
            <button
              type="button"
              onClick={toggleWildcard}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors',
                hasWildcard ? 'bg-amber-100 text-amber-800' : 'hover:bg-gray-50 text-gray-700',
              )}
            >
              <span className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5" /> Anyone (*)
              </span>
              {hasWildcard && <Check className="w-3.5 h-3.5" />}
            </button>
          )}

          <div className="max-h-56 overflow-y-auto space-y-0.5 pt-1 border-t border-gray-100">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-gray-400 font-medium">
                No matching apps
              </div>
            ) : (
              filtered.map((a) => {
                const selected = value.includes(a.clientId) && !hasWildcard;
                return (
                  <button
                    key={a.clientId}
                    type="button"
                    onClick={() => toggle(a.clientId)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-colors',
                      selected ? 'bg-brand-blue/10' : 'hover:bg-gray-50',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-800 truncate">{a.name}</div>
                      <div className="text-[10px] font-mono text-gray-400 truncate">{a.clientId}</div>
                    </div>
                    <span
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                        selected ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-300',
                      )}
                    >
                      {selected && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {value.length === 0 && emptyHint && (
        <p className="text-[10px] text-gray-400 mt-1">{emptyHint}</p>
      )}
    </div>
  );
}
