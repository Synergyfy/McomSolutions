import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAppHealth } from './hooks/useAppHealth';

interface AppHealthBadgeProps {
  clientId: string;
  enabled: boolean;
  compact?: boolean;
  onRefresh?: () => void;
}

export default function AppHealthBadge({ clientId, enabled, compact = false }: AppHealthBadgeProps) {
  const { data, isLoading, isError, refetch, isFetching } = useAppHealth(clientId, enabled);

  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        No billing API
      </span>
    );
  }

  if (isLoading || (isFetching && !data)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-brand-blue border border-blue-100">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Pinging...
      </span>
    );
  }

  if (isError || !data) {
    return (
      <div className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          Offline
        </span>
        {!compact && (
          <button
            onClick={() => refetch()}
            title="Retry health ping"
            className="p-1 text-gray-400 hover:text-brand-blue hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all',
          data.reachable
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : 'bg-red-50 text-red-600 border-red-100',
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            data.reachable ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500',
          )}
        />
        {data.reachable ? (
          compact ? (
            `${data.latencyMs}ms`
          ) : (
            <>
              <span>Online</span>
              <span className="opacity-60 font-mono text-[9px]">· {data.latencyMs}ms</span>
            </>
          )
        ) : (
          'Unreachable'
        )}
      </span>
      {!compact && (
        <button
          onClick={() => refetch()}
          title="Re-ping endpoint"
          disabled={isFetching}
          className="p-1 text-gray-400 hover:text-brand-blue hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={cn('w-2.5 h-2.5', isFetching && 'animate-spin text-brand-blue')} />
        </button>
      )}
    </div>
  );
}