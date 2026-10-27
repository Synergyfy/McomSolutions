import { memo } from 'react';
import { cn } from '../lib/utils';
import { useNow } from '../hooks/useNow';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (value: number) => (value < 10 ? `0${value}` : String(value));

function splitRemaining(remainingMs: number) {
  const total = Math.max(0, remainingMs);
  return {
    days: Math.floor(total / DAY),
    hours: Math.floor((total % DAY) / HOUR),
    minutes: Math.floor((total % HOUR) / MINUTE),
    seconds: Math.floor((total % MINUTE) / SECOND),
  };
}

export interface ProgrammeCountdownProps {
  /** End of the whole programme (start date + programme length). */
  endsAt?: string | Date | null;
  className?: string;
}

/**
 * Big overall programme countdown: days / hours / minutes / seconds.
 * Shares the app-wide ticker via `useNow`, so the dashboard never re-renders
 * when the seconds tick — only this block does.
 */
function ProgrammeCountdown({ endsAt, className }: ProgrammeCountdownProps) {
  const end = endsAt ? new Date(endsAt) : null;
  const endMs = end && !isNaN(end.getTime()) ? end.getTime() : null;

  const now = useNow(endMs !== null, endMs);

  if (endMs === null) return null;

  const remaining = endMs - now;

  if (remaining <= 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500',
          className
        )}
      >
        Programme time is up
      </span>
    );
  }

  const { days, hours, minutes, seconds } = splitRemaining(remaining);

  const units = [
    { label: 'Days', value: days },
    { label: 'Hours', value: hours },
    { label: 'Minutes', value: minutes },
    { label: 'Seconds', value: seconds },
  ];

  return (
    <div
      className={cn('flex items-stretch gap-1.5 sm:gap-3', className)}
      role="timer"
      aria-label={`Programme ends in ${days} days, ${hours} hours, ${minutes} minutes and ${seconds} seconds`}
    >
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex min-w-[54px] flex-col items-center justify-center rounded-xl bg-orange-500 px-2 py-2 text-white shadow-lg shadow-orange-500/25 sm:min-w-[76px] sm:rounded-2xl sm:px-4 sm:py-3"
        >
          <span className="text-xl font-black leading-none tabular-nums sm:text-3xl">
            {pad(unit.value)}
          </span>
          <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/85 sm:text-[10px]">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default memo(ProgrammeCountdown);
