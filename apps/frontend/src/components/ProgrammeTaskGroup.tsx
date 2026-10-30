import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export type ProgrammeTaskGroupTone = 'expired' | 'completed';

export interface ProgrammeTaskGroupProps {
  title: string;
  count: number;
  tone: ProgrammeTaskGroupTone;
  icon: React.ComponentType<{ className?: string }>;
  /** Short helper line shown next to the title (e.g. "Past their deadline"). */
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const TONES: Record<ProgrammeTaskGroupTone, { header: string; badge: string; icon: string }> = {
  expired: {
    header: 'bg-red-50/60 hover:bg-red-50 border-red-100',
    badge: 'bg-red-100 text-red-700',
    icon: 'text-red-500',
  },
  completed: {
    header: 'bg-green-50/60 hover:bg-green-50 border-green-100',
    badge: 'bg-green-100 text-green-700',
    icon: 'text-green-500',
  },
};

/**
 * Collapsible group used to tuck away finished/expired programme tasks so the
 * dashboard only surfaces what still needs attention.
 */
export default function ProgrammeTaskGroup({
  title,
  count,
  tone,
  icon: Icon,
  hint,
  defaultOpen = false,
  children,
}: ProgrammeTaskGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = TONES[tone];

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-xl sm:rounded-2xl border px-3 sm:px-4 py-2.5 text-left transition-colors',
          styles.header,
        )}
      >
        <Icon className={cn('w-4 h-4 shrink-0', styles.icon)} />
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] sm:text-sm font-bold text-gray-900 leading-tight">{title}</span>
          {hint && <span className="block text-[11px] text-gray-500 leading-tight">{hint}</span>}
        </span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', styles.badge)}>{count}</span>
        <ChevronDown
          className={cn('w-4 h-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2.5 sm:space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
