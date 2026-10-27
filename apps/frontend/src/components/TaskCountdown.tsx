import { memo } from 'react';
import { Timer } from 'lucide-react';
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

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="tabular-nums font-black">{pad(value)}</span>
      <span className="text-[9px] font-bold opacity-70">{label}</span>
    </span>
  );
}

export interface TaskCountdownProps {
  /** ISO timestamp of the task deadline (`deadlineAt` from /programme/my-tasks). */
  deadlineAt?: string | Date | null;
  /** Set false once the task is completed/expired so the ticker unsubscribes. */
  active?: boolean;
  className?: string;
}

/**
 * Compact live countdown (days / hours / minutes / seconds) for a programme task.
 *
 * Only this component subscribes to the shared ticker, so the surrounding task
 * list and dashboard never re-render on each tick.
 */
function TaskCountdown({ deadlineAt, active = true, className }: TaskCountdownProps) {
  const deadline = deadlineAt ? new Date(deadlineAt) : null;
  const deadlineMs = deadline && !isNaN(deadline.getTime()) ? deadline.getTime() : null;

  // Freeze the clock at the deadline instead of ticking past it.
  const now = useNow(active && deadlineMs !== null, deadlineMs);

  if (deadlineMs === null) return null;

  const remaining = deadlineMs - now;
  const isOverdue = remaining <= 0;
  const { days, hours, minutes, seconds } = splitRemaining(remaining);

  const tone =
    remaining <= DAY
      ? 'bg-red-50 text-red-600 border-red-200'
      : remaining <= 3 * DAY
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] leading-none',
        tone,
        className
      )}
      title={isOverdue ? 'Deadline passed' : `Deadline: ${deadline!.toLocaleString()}`}
    >
      <Timer className="w-3.5 h-3.5 shrink-0" />
      {isOverdue ? (
        <span className="font-bold whitespace-nowrap">Deadline passed</span>
      ) : (
        <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
          <Unit value={days} label="d" />
          <Unit value={hours} label="h" />
          <Unit value={minutes} label="m" />
          <Unit value={seconds} label="s" />
        </span>
      )}
    </span>
  );
}

export default memo(TaskCountdown);
