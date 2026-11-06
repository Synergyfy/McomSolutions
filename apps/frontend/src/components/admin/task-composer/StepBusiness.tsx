import { Building2, Check, Loader2, Search, Users } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { BusinessUser } from '../../../services/admin/types';
import { initials } from '../../task-composer/taskComposerUtils';
import FieldTooltip from '../../common/FieldTooltip';
import StepIntro from '../../task-composer/StepIntro';

interface StepBusinessProps {
  businesses: BusinessUser[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selected: BusinessUser | null;
  selectedId: string;
  onSelect: (business: BusinessUser) => void;
}

export default function StepBusiness({
  businesses,
  loading,
  search,
  onSearchChange,
  selected,
  selectedId,
  onSelect,
}: StepBusinessProps) {
  return (
    <div>
      <StepIntro
        icon={Building2}
        eyebrow="Step 1 of 6"
        title="Which business is this task for?"
        description="Search the business you are creating on behalf of. Its membership allowance, platform access and account manager drive the rest of the setup."
        tip="Admin-created tasks follow the same allowance rules as business-created ones — the free quota is applied automatically and anything over it becomes chargeable."
        tooltip="Pick the business the task is for. Its plan decides the free task allowance, and its platform access decides which platform tags you can use."
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search businesses by name or email"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-9 pr-10 text-base font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 sm:text-sm"
        />
        <FieldTooltip
          text="Filter the list by business name or email to find the right account quickly."
          align="right"
          className="absolute right-2.5 top-1/2 -translate-y-1/2"
        />
      </div>

      {selected && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
          Selected: <strong className="font-black">{selected.name}</strong>
          <span className="text-emerald-600">· {selected.email}</span>
        </div>
      )}

      <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
            <p className="mt-2 text-xs font-semibold text-gray-500">Loading businesses…</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
            <Users className="mx-auto h-7 w-7 text-gray-300" />
            <p className="mt-2 text-sm font-black text-gray-800">No businesses match</p>
            <p className="mt-1 text-[11px] font-medium text-gray-500">
              Try a different name or email. Businesses must have a profile before you can delegate
              work to them.
            </p>
          </div>
        ) : (
          businesses.map((business) => {
            const active = business.id === selectedId;
            const platforms = business.platformAccess ?? [];
            return (
              <button
                key={business.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(business)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-all',
                  active
                    ? 'border-brand-blue bg-brand-blue/[0.05] shadow-[0_10px_30px_-20px_rgba(255,105,0,0.8)]'
                    : 'border-gray-100 bg-white hover:border-brand-blue/30 hover:bg-gray-50/60',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white',
                    active
                      ? 'bg-gradient-to-br from-brand-blue to-rose-500'
                      : 'bg-gradient-to-br from-slate-700 to-slate-900',
                  )}
                >
                  {initials(business.name || business.email)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-black text-gray-900">
                    {business.name || 'Unnamed business'}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-gray-500">
                    {business.email}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5 text-[9px] font-bold">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                      {business.membership || 'No membership'}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5',
                        business.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700',
                      )}
                    >
                      {business.status || 'Unknown'}
                    </span>
                    {platforms.slice(0, 4).map((platform) => (
                      <span
                        key={`${business.id}-${platform}`}
                        className="rounded-full bg-gray-100 px-2 py-0.5 uppercase text-gray-500"
                      >
                        {platform}
                      </span>
                    ))}
                    {platforms.length > 4 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
                        +{platforms.length - 4}
                      </span>
                    )}
                  </span>
                </span>

                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    active
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-gray-200 bg-white text-transparent',
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
