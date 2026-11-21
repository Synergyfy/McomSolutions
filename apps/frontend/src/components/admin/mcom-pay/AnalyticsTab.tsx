import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLedgerByIntent, useLedgerByPlatform, useLedgerTrend } from './hooks/useMcomPayAdmin';
import { formatDay, formatMinor, intentLabel, intentStyle } from './format';

const PERIODS = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
] as const;

const GROUPINGS = ['day', 'week', 'month'] as const;

function rangeFor(days: number) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

export function AnalyticsTab() {
  const [days, setDays] = useState<number>(30);
  const [groupBy, setGroupBy] = useState<(typeof GROUPINGS)[number]>('day');

  const range = useMemo(() => rangeFor(days), [days]);
  const params = useMemo(() => ({ ...range, groupBy }), [range, groupBy]);

  const trend = useLedgerTrend(params);
  const byPlatform = useLedgerByPlatform(range);
  const byIntent = useLedgerByIntent(range);

  const points = trend.data?.data ?? [];
  const maxVolume = Math.max(1, ...points.map((p) => Number(p.volumeMinor)));

  if (trend.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <button
              key={period.label}
              onClick={() => setDays(period.days)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold border',
                days === period.days
                  ? 'bg-brand-blue text-white border-brand-blue'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {period.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {GROUPINGS.map((grouping) => (
            <button
              key={grouping}
              onClick={() => setGroupBy(grouping)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold border capitalize',
                groupBy === grouping
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {grouping}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest">Ledger volume</h3>
          <span className="text-[11px] text-gray-400">
            {points.length} {groupBy} bucket{points.length === 1 ? '' : 's'}
          </span>
        </div>

        {points.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No activity in this period.</div>
        ) : (
          <div className="flex items-end gap-1.5 h-48 overflow-x-auto">
            {points.map((point) => {
              const height = Math.max(2, (Number(point.volumeMinor) / maxVolume) * 100);
              return (
                <div key={point.bucket} className="flex-1 min-w-[8px] flex flex-col items-center gap-1 group">
                  <div className="relative w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t bg-brand-blue/80 group-hover:bg-brand-blue transition-colors"
                      style={{ height: `${height}%` }}
                      title={`${point.bucket} · ${formatMinor(point.volumeMinor)} · ${point.transfers} transfers`}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 whitespace-nowrap">{formatDay(point.bucket)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-3">By platform</h3>
          {byPlatform.isLoading ? (
            <div className="py-10 flex justify-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="py-2">Platform</th>
                  <th className="py-2 text-right">Volume</th>
                  <th className="py-2 text-right">In</th>
                  <th className="py-2 text-right">Out</th>
                </tr>
              </thead>
              <tbody>
                {(byPlatform.data?.data ?? []).map((row) => (
                  <tr key={row.platformId} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-mono text-[11px] text-gray-700">{row.platformId}</td>
                    <td className="py-2 text-right font-bold text-gray-900">{formatMinor(row.volumeMinor)}</td>
                    <td className="py-2 text-right text-emerald-600">{formatMinor(row.platformInflowMinor)}</td>
                    <td className="py-2 text-right text-rose-600">{formatMinor(row.platformOutflowMinor)}</td>
                  </tr>
                ))}
                {(byPlatform.data?.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      No platform activity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-3">By intent</h3>
          {byIntent.isLoading ? (
            <div className="py-10 flex justify-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {(byIntent.data?.data ?? []).map((row) => (
                <div key={row.intent}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold border', intentStyle(row.intent))}>
                      {intentLabel(row.intent)}
                    </span>
                    <span className="text-gray-500">
                      {formatMinor(row.volumeMinor)} · {row.share.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-blue/70"
                      style={{ width: `${Math.min(100, row.share)}%` }}
                    />
                  </div>
                </div>
              ))}
              {(byIntent.data?.data ?? []).length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">No intent activity.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Volume is the value of each transfer counted once (the first step). Platform in/out is money moving
        through the platform wallet, so card sales appear as both an inflow and an outflow.
      </p>
    </div>
  );
}
