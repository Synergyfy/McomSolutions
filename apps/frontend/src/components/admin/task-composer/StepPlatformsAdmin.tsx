import { Check, LayoutGrid, LockKeyhole } from 'lucide-react';
import { cn } from '../../../lib/utils';
import StepIntro from '../../task-composer/StepIntro';
import { platformLabel } from './adminTaskComposerUtils';

interface StepPlatformsAdminProps {
  businessName: string;
  platforms: string[];
  selected: string[];
  onToggle: (key: string) => void;
}

export default function StepPlatformsAdmin({
  businessName,
  platforms,
  selected,
  onToggle,
}: StepPlatformsAdminProps) {
  return (
    <div>
      <StepIntro
        icon={LayoutGrid}
        eyebrow="Step 3 of 6"
        title="Which platforms does this touch?"
        description={`Tag the MCOM platforms involved for ${businessName || 'this business'}. Only platforms the business currently has access to can be tagged.`}
        tip="Optional. Platform tags help the affiliate understand the tools involved and stop tasks being routed to people who cannot work inside them."
        tooltip="Only platforms this business currently has access to can be tagged. This helps the affiliate know which tools the work happens in."
      />

      {platforms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-black text-gray-900">No platform access on file</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] font-medium leading-5 text-gray-500">
            This business has no active platform packages, so there is nothing to tag. You can still
            create a professional or internal task without platform tags.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {platforms.map((platform) => {
            const active = selected.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(platform)}
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
                    {platformLabel(platform)}
                  </span>
                  <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {platform}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] font-semibold text-gray-500">
        {selected.length
          ? `${selected.length} platform${selected.length === 1 ? '' : 's'} tagged.`
          : 'Optional, but tagging gives the affiliate better context.'}
      </p>
    </div>
  );
}
