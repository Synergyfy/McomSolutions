import { useId, useState } from 'react';

type FieldRequirementHintProps = {
  kind: 'required' | 'important';
};

const copy = {
  required: {
    full: 'Required to continue.',
    short: 'Required.',
    label: 'Required field',
  },
  important: {
    full: 'Important for a complete profile. You can continue and add it later.',
    short: 'Important; add later.',
    label: 'Important field; you can continue without it',
  },
};

export default function FieldRequirementHint({ kind }: FieldRequirementHintProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const message = copy[kind];

  return (
    <span className="relative ml-1 inline-flex items-center gap-1 align-middle">
      <span aria-hidden="true" className="font-bold text-orange-600">*</span>
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label={message.label}
          aria-describedby={open ? tooltipId : undefined}
          aria-expanded={open}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold leading-none text-slate-600 outline-none transition hover:border-orange-500 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
        >
          ?
        </button>
        {open && (
          <span
            id={tooltipId}
            role="tooltip"
            className="absolute bottom-full left-1/2 z-50 mb-2 w-40 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-2 text-left text-[10px] font-medium leading-4 text-white shadow-lg sm:w-64 sm:px-3 sm:text-xs sm:leading-5"
          >
            <span className="sm:hidden">{message.short}</span>
            <span className="hidden sm:inline">{message.full}</span>
          </span>
        )}
      </span>
    </span>
  );
}
