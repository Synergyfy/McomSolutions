import { BriefcaseBusiness, Check, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import StepIntro from './StepIntro';
import { TASK_TYPE_OPTIONS, type TaskCategory } from './taskComposerUtils';

interface StepTaskTypeProps {
  value: TaskCategory;
  onChange: (value: TaskCategory) => void;
}

export default function StepTaskType({ value, onChange }: StepTaskTypeProps) {
  return (
    <div>
      <StepIntro
        icon={Sparkles}
        eyebrow="Quest 1 of 5"
        title="What kind of mission is this?"
        description="Pick the flavour of work. This decides how we match the right people and how the task is tracked."
        tip="Most growth requests are External / professional. Choose Internal / platform when the work happens inside your MCOM tools."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {TASK_TYPE_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all',
                active
                  ? 'border-brand-blue bg-brand-blue/[0.04] shadow-[0_10px_30px_-18px_rgba(255,105,0,0.65)]'
                  : 'border-gray-100 bg-white hover:border-brand-blue/30 hover:bg-gray-50/60',
              )}
            >
              <span
                className={cn(
                  'absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border transition-colors',
                  active
                    ? 'border-brand-blue bg-brand-blue text-white'
                    : 'border-gray-200 bg-white text-transparent',
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <p className="mt-3 pr-8 text-sm font-black text-gray-900">{option.title}</p>
              <p className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-brand-blue">
                {option.tagline}
              </p>
              <p className="mt-2 text-[12px] font-medium leading-5 text-gray-500">
                {option.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {option.examples.map((example) => (
                  <span
                    key={example}
                    className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600"
                  >
                    {example}
                  </span>
                ))}
              </div>

              <p className="mt-3 border-t border-dashed border-gray-200 pt-2 text-[10px] font-semibold leading-4 text-gray-500">
                Best for: {option.bestFor}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
