import { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type TooltipAlign = 'left' | 'center' | 'right';

interface FieldTooltipProps {
  /** Simple explanation shown when the icon is hovered, focused or tapped. */
  text: string;
  /** Accessible label for the help button. */
  label?: string;
  align?: TooltipAlign;
  className?: string;
  size?: 'sm' | 'md';
}

const ALIGN_CLASSES: Record<TooltipAlign, string> = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0',
};

/**
 * Small "?" icon that reveals a plain-language explanation of a form field.
 * Works with mouse hover, keyboard focus and touch (tap to toggle).
 */
export default function FieldTooltip({
  text,
  label = 'What this field is for',
  align = 'left',
  className,
  size = 'sm',
}: FieldTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className={cn('relative inline-flex shrink-0 align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          // Keep the tooltip from activating the surrounding label/control.
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-gray-400 outline-none transition-colors hover:text-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/40',
          size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
        )}
      >
        <HelpCircle
          className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute bottom-full z-50 mb-1.5 w-56 max-w-[70vw] rounded-lg bg-slate-900 px-2.5 py-2 text-left text-[10px] font-medium leading-4 text-white shadow-xl sm:text-[11px] sm:leading-5',
            ALIGN_CLASSES[align],
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
