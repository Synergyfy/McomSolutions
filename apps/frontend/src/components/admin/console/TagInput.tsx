import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Chip/tag input. Type and press Enter (or comma) to add; Backspace removes the
 * last chip. Suggestions are clickable and never block new values.
 */
export default function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add…',
  hint,
  disabled,
}: TagInputProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    return suggestions
      .filter((s) => !value.includes(s) && (!q || s.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [suggestions, value, input]);

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setInput('');
  };

  const remove = (t: string) => onChange(value.filter((v) => v !== t));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex flex-wrap items-center gap-1.5 px-2 py-2 bg-gray-50 border rounded-xl min-h-[42px] transition-all cursor-text',
          focused ? 'border-brand-blue ring-2 ring-brand-blue/20' : 'border-gray-200',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-brand-blue/10 border border-brand-blue/20 text-brand-blue"
          >
            {t}
            <button type="button" onClick={() => remove(t)} className="hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[100px] bg-transparent text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none py-0.5"
        />
      </div>

      {focused && filtered.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white border border-gray-200 text-gray-600 hover:border-brand-blue hover:text-brand-blue"
            >
              <Plus className="w-3 h-3" /> {s}
            </button>
          ))}
        </div>
      )}

      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
