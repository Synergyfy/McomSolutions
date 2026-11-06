import { Check, LayoutGrid, LockKeyhole, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { PlatformAccessItem } from '../../services/business';
import StepIntro from './StepIntro';

interface StepPlatformsProps {
  platforms: PlatformAccessItem[];
  selected: string[];
  onToggle: (key: string) => void;
}

export default function StepPlatforms({
  platforms,
  selected,
  onToggle,
}: StepPlatformsProps) {
  return (
    <div>
      <StepIntro
        icon={LayoutGrid}
        eyebrow="Quest 2 of 5"
        title="Which platforms does this touch?"
        description="Tag the MCOM platforms involved so we only surface affiliates who can actually do the work inside them."
        tip="You can pick more than one. Platform tags also let us show the right context to the person taking the task."
      />

      {platforms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-black text-gray-900">No platform access yet</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] font-medium leading-5 text-gray-500">
            Your current plan does not include platform tags. You can still create a professional
            task — or unlock platform access to delegate inside MCOM tools.
          </p>
          <Link
            to="/dashboard/memberships"
            className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark"
          >
            Explore membership <Sparkles className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {platforms.map((platform) => {
            const active = selected.includes(platform.key);
            return (
              <button
                key={platform.key}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(platform.key)}
                className={cn(
                  'flex min-h-[64px] items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-all',
                  active
                    ? 'border-brand-blue bg-brand-blue/[0.05]'
                    : 'border-gray-100 bg-white hover:border-brand-blue/30 hover:bg-gray-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                    active ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {active ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <LayoutGrid className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-gray-900">
                    {platform.name}
                  </span>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {platform.platformSlug || platform.key.replaceAll('_', ' ')}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] font-semibold text-gray-500">
        {selected.length
          ? `${selected.length} platform${selected.length === 1 ? '' : 's'} tagged — nice. This sharpens your matches.`
          : 'Optional, but tagging gives you stronger recommendations.'}
      </p>
    </div>
  );
}
