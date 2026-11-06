import type { LucideIcon } from 'lucide-react';

interface StepIntroProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  tip?: string;
}

export default function StepIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
  tip,
}: StepIntroProps) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-blue">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-lg font-black leading-tight text-gray-900 sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-[13px] font-medium leading-6 text-gray-500 sm:text-sm">
            {description}
          </p>
        </div>
      </div>
      {tip && (
        <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-800">
          {tip}
        </p>
      )}
    </div>
  );
}
