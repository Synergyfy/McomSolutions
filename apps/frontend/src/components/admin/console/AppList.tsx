import { useState, useMemo, type MouseEvent } from 'react';
import {
  Ban,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Filter,
  Grid,
  KeyRound,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  Plus,
  Radio,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useConsoleApps, useDeactivateApp } from './hooks/useConsoleApps';
import AppHealthBadge from './AppHealthBadge';
import type { SsoClientListItem } from '../../../services/admin/types';

interface AppListProps {
  onManage: (clientId: string) => void;
  onRegisterClick?: () => void;
}

type FilterType = 'all' | 'active' | 'inactive' | 'system' | 'custom';
type ViewMode = 'grid' | 'table';

export default function AppList({ onManage, onRegisterClick }: AppListProps) {
  const { data, isLoading, isError, refetch } = useConsoleApps();
  const deactivateApp = useDeactivateApp();
  const [confirmDisable, setConfirmDisable] = useState<SsoClientListItem | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const apps = data ?? [];

  const handleCopyClientId = (clientId: string, e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(clientId);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      // Filter tab check
      if (activeFilter === 'active' && !app.isActive) return false;
      if (activeFilter === 'inactive' && app.isActive) return false;
      if (activeFilter === 'system' && !app.isSystemApp) return false;
      if (activeFilter === 'custom' && app.isSystemApp) return false;

      // Search query check
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.clientId.toLowerCase().includes(q) ||
        (app.platformSlug && app.platformSlug.toLowerCase().includes(q))
      );
    });
  }, [apps, activeFilter, searchQuery]);

  const filterCounts = useMemo(() => {
    return {
      all: apps.length,
      active: apps.filter((a) => a.isActive).length,
      inactive: apps.filter((a) => !a.isActive).length,
      system: apps.filter((a) => a.isSystemApp).length,
      custom: apps.filter((a) => !a.isSystemApp).length,
    };
  }, [apps]);

  return (
    <div className="space-y-4">
      {/* Search, Filter & View Mode Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps by name, client ID, or platform slug..."
            className="w-full pl-9.5 pr-4 py-2 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills & View Mode */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 bg-gray-50/80 p-1 rounded-xl border border-gray-200/60">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'system', label: 'System' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                  activeFilter === f.id
                    ? 'bg-white text-gray-900 shadow-xs border border-gray-200/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/60',
                )}
              >
                <span>{f.label}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                    activeFilter === f.id ? 'bg-brand-blue/10 text-brand-blue' : 'bg-gray-200/60 text-gray-500',
                  )}
                >
                  {filterCounts[f.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Grid vs Table Toggle */}
          <div className="flex items-center gap-0.5 bg-gray-50/80 p-1 rounded-xl border border-gray-200/60 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              className={cn(
                'p-1.5 rounded-lg text-xs transition-colors',
                viewMode === 'grid' ? 'bg-white text-brand-blue shadow-xs' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={cn(
                'p-1.5 rounded-lg text-xs transition-colors',
                viewMode === 'table' ? 'bg-white text-brand-blue shadow-xs' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-brand-blue mb-3" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Ecosystem Apps...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl bg-white border border-gray-100 text-center">
          <ShieldAlert className="w-10 h-10 text-red-500 mb-3" />
          <h4 className="font-bold text-gray-900 text-sm">Failed to Load Applications</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            Could not fetch registered SSO client applications from the server.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 rounded-3xl bg-white border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-brand-blue mb-4 shadow-sm">
            <Sparkles className="w-8 h-8 text-brand-blue" />
          </div>
          <h4 className="font-bold text-gray-900 text-base font-display">No Applications Registered Yet</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-md leading-relaxed">
            The Mcom Console allows you to register tenant applications (e.g. Mcom vCard, Spin, Loyalty) to dynamically connect them to MCOM authentication, permissions, and billing.
          </p>
          {onRegisterClick && (
            <button
              onClick={onRegisterClick}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all shadow-glow"
            >
              <Plus className="w-4 h-4" /> Register First Application
            </button>
          )}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl bg-white border border-gray-100 text-center">
          <Search className="w-8 h-8 text-gray-300 mb-2" />
          <h4 className="font-bold text-gray-900 text-sm">No Applications Match Your Filter</h4>
          <p className="text-xs text-gray-400 mt-1">Try refining your search term or selecting another filter pill.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
            className="mt-4 px-3.5 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <AppCard
              key={app.clientId}
              app={app}
              copiedId={copiedId}
              onCopyId={handleCopyClientId}
              onManage={() => onManage(app.clientId)}
              onDisable={() => setConfirmDisable(app)}
            />
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Application
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Client ID
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Platform Slug
                  </th>
                  <th className="px-5 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredApps.map((app) => (
                  <tr
                    key={app.clientId}
                    onClick={() => onManage(app.clientId)}
                    className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200/60 flex items-center justify-center font-bold text-xs text-gray-700 font-display flex-shrink-0 group-hover:border-brand-blue/40 transition-colors">
                          {app.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm group-hover:text-brand-blue transition-colors">
                              {app.name}
                            </span>
                            {app.isSystemApp && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" /> System
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 font-mono">
                            Created {new Date(app.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200/70 rounded-lg text-xs font-mono font-bold text-gray-700">
                        <span>{app.clientId}</span>
                        <button
                          onClick={(e) => handleCopyClientId(app.clientId, e)}
                          title="Copy Client ID"
                          className="text-gray-400 hover:text-brand-blue transition-colors"
                        >
                          {copiedId === app.clientId ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 border',
                          app.isActive
                            ? 'bg-green-50 text-green-700 border-green-200/60'
                            : 'bg-gray-100 text-gray-500 border-gray-200',
                        )}
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            app.isActive ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-gray-400',
                          )}
                        />
                        {app.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {app.platformSlug ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-brand-blue border border-blue-100 rounded text-[11px] font-mono font-bold">
                            {app.platformSlug}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            canAccess_{app.platformSlug}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 font-mono">—</span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onManage(app.clientId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-brand-blue hover:text-white rounded-xl text-xs font-bold text-gray-600 transition-all border border-gray-200/60"
                        >
                          <Settings2 className="w-3.5 h-3.5" /> Manage
                        </button>
                        {!app.isSystemApp && (
                          <button
                            onClick={() => setConfirmDisable(app)}
                            disabled={!app.isActive}
                            title={app.isActive ? 'Deactivate application' : 'Already deactivated'}
                            className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-transparent hover:border-red-100"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {confirmDisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDisable(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Ban className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1 font-display">
              Deactivate "{confirmDisable.name}"?
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              This will disable SSO authentication for <b>{confirmDisable.clientId}</b> and immediately invalidate all active user sessions for this application.
            </p>
            {disableError && (
              <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
                {disableError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmDisable(null);
                  setDisableError(null);
                }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDisableError(null);
                  try {
                    await deactivateApp.mutateAsync(confirmDisable.clientId);
                    setConfirmDisable(null);
                  } catch (err: any) {
                    const status = err?.response?.status;
                    if (status === 403) setDisableError('You need ADMIN role access to deactivate applications.');
                    else setDisableError('Failed to deactivate application. Please try again.');
                  }
                }}
                disabled={deactivateApp.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {deactivateApp.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppCard({
  app,
  copiedId,
  onCopyId,
  onManage,
  onDisable,
}: {
  key?: string;
  app: SsoClientListItem;
  copiedId: string | null;
  onCopyId: (clientId: string, e: MouseEvent) => void;
  onManage: () => void;
  onDisable: () => void;
}) {
  return (
    <div
      onClick={onManage}
      className="group relative bg-white rounded-3xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-brand-blue/30 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Top Badges & Status */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-100 flex items-center justify-center font-black text-sm text-brand-blue font-display flex-shrink-0 group-hover:scale-105 transition-transform">
              {app.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm group-hover:text-brand-blue transition-colors line-clamp-1">
                {app.name}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={cn(
                    'px-2 py-0.2 rounded-full text-[9px] font-bold inline-flex items-center gap-1 border',
                    app.isActive
                      ? 'bg-green-50 text-green-700 border-green-200/60'
                      : 'bg-gray-100 text-gray-500 border-gray-200',
                  )}
                >
                  <span
                    className={cn(
                      'w-1.2 h-1.2 rounded-full',
                      app.isActive ? 'bg-green-500' : 'bg-gray-400',
                    )}
                  />
                  {app.isActive ? 'Active' : 'Inactive'}
                </span>
                {app.isSystemApp && (
                  <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200/60 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                    <Shield className="w-2 h-2" /> System
                  </span>
                )}
              </div>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Client ID Pill */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50/80 rounded-xl border border-gray-200/60 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
                ID
              </span>
              <span className="font-mono text-xs font-bold text-gray-800 truncate">{app.clientId}</span>
            </div>
            <button
              onClick={(e) => onCopyId(app.clientId, e)}
              title="Copy Client ID"
              className="text-gray-400 hover:text-brand-blue transition-colors p-1"
            >
              {copiedId === app.clientId ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Platform Slug / Dynamic Permission Tag */}
        {app.platformSlug && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100/80 mb-3">
            <Zap className="w-3 h-3 text-brand-blue flex-shrink-0" />
            <span className="text-[10px] font-bold text-gray-500">Permission:</span>
            <code className="text-[10px] font-mono font-bold text-brand-blue">
              canAccess_{app.platformSlug}
            </code>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-gray-400">
          Updated {new Date(app.updatedAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onManage}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-brand-blue hover:text-white rounded-xl text-[11px] font-bold text-gray-700 transition-all border border-gray-200/60"
          >
            <Settings2 className="w-3 h-3" /> Manage & Keys
          </button>
          {!app.isSystemApp && (
            <button
              onClick={onDisable}
              disabled={!app.isActive}
              title={app.isActive ? 'Deactivate application' : 'Already deactivated'}
              className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}