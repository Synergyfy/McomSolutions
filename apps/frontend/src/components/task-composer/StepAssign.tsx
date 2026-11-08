import { useDeferredValue, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Infinity as InfinityIcon,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Ticket,
  Trophy,
  UserCog,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAccountManager,
  useDelegationQuota,
  useNearbyAffiliates,
} from '../../services/business/hooks';
import type { AffiliateDelegationQuota, NearbyAffiliate } from '../../services/business';
import StepIntro from './StepIntro';
import FieldTooltip from '../common/FieldTooltip';
import {
  COMPENSATION_OPTIONS,
  RADIUS_OPTIONS,
  ROLE_FILTERS,
  ROLE_LABELS,
  initials,
  scoreAffiliates,
  type AffiliateRoleFilter,
  type CompensationModel,
  type ScoredAffiliate,
  type TaskCategory,
} from './taskComposerUtils';

interface StepAssignProps {
  category: TaskCategory;
  platforms: string[];
  requiredSkills: string[];
  assigneeUserId: string;
  onAssigneeChange: (userId: string) => void;
  dueAt: string;
  onDueAtChange: (value: string) => void;
  compensationModel: CompensationModel;
  onCompensationModelChange: (value: CompensationModel) => void;
  compensationAmount: string;
  onCompensationAmountChange: (value: string) => void;
  requiresBusinessApproval: boolean;
  onRequiresBusinessApprovalChange: (value: boolean) => void;
}

const ROLE_STYLES: Record<string, string> = {
  AGENT: 'bg-sky-50 text-sky-700 border-sky-100',
  ACCOUNT_MANAGER: 'bg-violet-50 text-violet-700 border-violet-100',
  CONSULTANT: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const today = new Date().toISOString().slice(0, 10);

function formatQuotaDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function AffiliateCard({
  entry,
  index,
  selected,
  onSelect,
}: {
  entry: ScoredAffiliate;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { affiliate, skillMatches } = entry;
  const topPick = index < 3;
  const roleLabel = ROLE_LABELS[affiliate.role] ?? affiliate.role;
  const distance = affiliate.distance?.label || 'Distance unavailable';
  const visibleSkills = affiliate.skills.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative flex h-full w-full flex-col rounded-2xl border-2 p-3.5 text-left transition-all',
        selected
          ? 'border-brand-blue bg-brand-blue/[0.05] shadow-[0_10px_30px_-20px_rgba(255,105,0,0.8)]'
          : 'border-gray-100 bg-white hover:border-brand-blue/30 hover:bg-gray-50/60',
      )}
    >
      <span
        className={cn(
          'absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
          selected
            ? 'border-brand-blue bg-brand-blue text-white'
            : 'border-gray-200 bg-white text-transparent',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>

      <div className="flex items-start gap-2.5 pr-7">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white',
            topPick
              ? 'bg-gradient-to-br from-brand-blue to-rose-500'
              : 'bg-gradient-to-br from-slate-700 to-slate-900',
          )}
        >
          {initials(affiliate.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-gray-900">{affiliate.name}</p>
          <span
            className={cn(
              'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
              ROLE_STYLES[affiliate.role] ?? 'border-gray-100 bg-gray-50 text-gray-600',
            )}
          >
            {roleLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700">
          <Trophy className="h-3 w-3" />
          {Number(affiliate.reputationScore ?? 0).toFixed(1)} rep
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
          <Award className="h-3 w-3" />
          {affiliate.completedTasksCount ?? 0} done
        </span>
        {topPick && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue px-2 py-1 text-white">
            <Sparkles className="h-3 w-3" /> Top pick
          </span>
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-gray-500">
        <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
        <span className="truncate">
          {affiliate.postcode || 'Area not set'} · {distance}
        </span>
      </p>

      {(skillMatches.length > 0 || visibleSkills.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skillMatches.map((skill) => (
            <span
              key={`match-${skill}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700"
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
              {skill}
            </span>
          ))}
          {visibleSkills
            .filter(
              (skill) =>
                !skillMatches.some(
                  (match) => match.toLowerCase() === skill.toLowerCase(),
                ),
            )
            .slice(0, Math.max(0, 3 - skillMatches.length))
            .map((skill) => (
              <span
                key={`skill-${skill}`}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-600"
              >
                {skill}
              </span>
            ))}
        </div>
      )}

      <span className="mt-auto pt-3">
        <span
          className={cn(
            'inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-black transition-colors',
            selected
              ? 'bg-brand-blue text-white'
              : 'border border-gray-200 bg-white text-gray-700',
          )}
        >
          {selected ? (
            <>
              <Check className="h-3.5 w-3.5" strokeWidth={3} /> Selected
            </>
          ) : (
            <>
              Choose {affiliate.name.split(' ')[0]} <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </span>
    </button>
  );
}

export default function StepAssign({
  category,
  platforms,
  requiredSkills,
  assigneeUserId,
  onAssigneeChange,
  dueAt,
  onDueAtChange,
  compensationModel,
  onCompensationModelChange,
  compensationAmount,
  onCompensationAmountChange,
  requiresBusinessApproval,
  onRequiresBusinessApprovalChange,
}: StepAssignProps) {
  const [roleFilter, setRoleFilter] = useState<AffiliateRoleFilter>('RECOMMENDED');
  const [radiusMiles, setRadiusMiles] = useState(0);
  const [skillQuery, setSkillQuery] = useState('');
  const deferredSkillQuery = useDeferredValue(skillQuery.trim());

  const { data: nearbyRes, isLoading, isError } = useNearbyAffiliates({
    limit: 50,
    radiusMiles: radiusMiles || undefined,
    skill: deferredSkillQuery || undefined,
  });
  const { data: managerRes } = useAccountManager();
  const manager = managerRes?.data ?? null;
  const distanceFrom = nearbyRes?.distanceFrom ?? null;
  const { data: quotaRes } = useDelegationQuota();
  const quota = quotaRes?.data as AffiliateDelegationQuota | undefined;

  const affiliates: NearbyAffiliate[] = useMemo(() => {
    const raw = nearbyRes?.items;
    if (!Array.isArray(raw)) return [];
    return raw as NearbyAffiliate[];
  }, [nearbyRes]);

  const scored = useMemo(
    () => scoreAffiliates(affiliates, requiredSkills, category),
    [affiliates, requiredSkills, category],
  );

  const visible = useMemo(() => {
    if (roleFilter === 'RECOMMENDED') {
      const withSignal = scored.filter(
        (entry) =>
          entry.skillMatches.length > 0 ||
          entry.affiliate.reputationScore >= 4 ||
          entry.affiliate.proximity?.matchedLevel !== 'national',
      );
      return (withSignal.length ? withSignal : scored).slice(0, 12);
    }
    if (roleFilter === 'ALL') return scored;
    return scored.filter((entry) => entry.affiliate.role === roleFilter);
  }, [roleFilter, scored]);

  const selectedAffiliate = scored.find(
    (entry) => entry.affiliate.userId === assigneeUserId,
  )?.affiliate;

  const amountNeeded =
    compensationModel === 'FIXED' ||
    compensationModel === 'HOURLY' ||
    compensationModel === 'COMMISSION';

  return (
    <div>
      <StepIntro
        icon={Users}
        eyebrow="Quest 5 of 5"
        title="Pick your person and set the clock"
        description="We ranked nearby affiliates by postcode closeness, reputation, completed tasks and the skills you asked for. Choose someone, or let your account manager handle it."
        tip="Not sure who to pick? Leave the default selected and your account manager will take it or route it to the best person."
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
          Matching with
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-gray-700">
          {category === 'EXTERNAL' ? 'External / professional' : 'Internal / platform'}
        </span>
        {platforms.map((platform) => (
          <span
            key={platform}
            className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-gray-700"
          >
            {platform}
          </span>
        ))}
        {requiredSkills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[9px] font-black text-brand-blue"
          >
            {skill}
          </span>
        ))}
        {!platforms.length && !requiredSkills.length && (
          <span className="text-[9px] font-semibold text-gray-400">
            Add skills or platform tags for sharper matches.
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
              Who should do it?
              <FieldTooltip text="Affiliates are ranked by distance, reputation, completed tasks and matching skills. Pick someone, or leave the default for auto-routing." />
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500">
              Filter by role, distance or a specific skill.
            </p>
          </div>
          <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 text-[10px] font-black text-brand-blue">
            {isLoading
              ? 'Finding…'
              : `${visible.length} match${visible.length === 1 ? '' : 'es'}`}
          </span>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ROLE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setRoleFilter(filter.value)}
              className={cn(
                'min-h-9 shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black transition-colors',
                roleFilter === filter.value
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={skillQuery}
              onChange={(event) => setSkillQuery(event.target.value)}
              placeholder="Search by another skill…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-base font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 sm:text-xs"
            />
            <FieldTooltip
              text="Narrow the list to people who have a specific skill you need."
              align="right"
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            />
          </div>
          <label className="relative">
            <span className="sr-only">Search radius</span>
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={radiusMiles}
              onChange={(event) => setRadiusMiles(Number(event.target.value))}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-xs font-bold text-gray-700 focus:border-brand-blue focus:bg-white focus:outline-none"
            >
              {RADIUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldTooltip
              text="Only show affiliates within this distance of your business."
              align="right"
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            />
          </label>
        </div>

        {requiredSkills.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-gray-500">
            <Target className="h-3 w-3 text-brand-blue" />
            Matching on:
            {requiredSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[9px] font-black text-brand-blue"
              >
                {skill}
              </span>
            ))}
          </p>
        )}

        {radiusMiles > 0 && !distanceFrom && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold leading-4 text-amber-800">
            We could not find your business postcode, so the radius filter cannot measure
            distance yet. Add a postcode in Business Profile to unlock it.
          </p>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => onAssigneeChange('')}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-all',
            assigneeUserId === ''
              ? 'border-brand-blue bg-brand-blue/[0.05]'
              : 'border-gray-100 bg-white hover:border-brand-blue/30',
          )}
        >
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              assigneeUserId === ''
                ? 'bg-brand-blue text-white'
                : 'bg-violet-50 text-violet-600',
            )}
          >
            <UserCog className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-black text-gray-900">
              {manager ? `Default — ${manager.name}` : 'Let an admin route it'}
            </span>
            <span className="block text-[10px] font-semibold text-gray-500">
              {manager
                ? 'Your account manager takes it or routes it to the best person.'
                : 'No account manager yet. An admin will assign the right affiliate.'}
            </span>
          </span>
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
              assigneeUserId === ''
                ? 'border-brand-blue bg-brand-blue text-white'
                : 'border-gray-200 text-transparent',
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        </button>

        {selectedAffiliate && (
          <p className="flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Selected: <strong className="font-black">{selectedAffiliate.name}</strong>
            <button
              type="button"
              onClick={() => onAssigneeChange('')}
              className="ml-auto shrink-0 text-[10px] font-black underline underline-offset-2"
            >
              Clear
            </button>
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-10">
          <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
          <p className="mt-2 text-xs font-semibold text-gray-500">
            Finding the best people near you…
          </p>
        </div>
      ) : isError ? (
        <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
          <p className="text-sm font-black text-red-800">We could not load affiliates</p>
          <p className="mt-1 text-[11px] font-medium text-red-600">
            Try a different filter or refresh the page. You can still leave the default selected.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
          <Search className="mx-auto h-7 w-7 text-gray-300" />
          <p className="mt-2 text-sm font-black text-gray-800">No matches for this filter</p>
          <p className="mt-1 text-[11px] font-medium text-gray-500">
            Try a wider radius, another role, or clear the skill search. The default option above
            always works.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2.5 md:grid-cols-2">
          {visible.map((entry, index) => (
            <div key={entry.affiliate.userId} className="h-full">
              <AffiliateCard
                entry={entry}
                index={index}
                selected={assigneeUserId === entry.affiliate.userId}
                onSelect={() => onAssigneeChange(entry.affiliate.userId)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 sm:grid-cols-2 sm:p-4">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
            <CalendarDays className="h-3.5 w-3.5 text-brand-blue" /> Due date
            <FieldTooltip text="The latest date the work should be finished. Leave it blank if there is no fixed deadline." />
          </span>
          <input
            type="date"
            min={today}
            value={dueAt}
            onChange={(event) => onDueAtChange(event.target.value)}
            onClick={(event) => {
              // Chrome only opens the native calendar from the small icon.
              // Treat a click anywhere in the field as a request to pick a date.
              const input = event.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };
              try {
                input.showPicker?.();
              } catch {
                // showPicker can throw if the picker is already open.
              }
            }}
            className="min-h-12 w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-base font-semibold text-gray-900 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 sm:text-sm"
          />
          <span className="mt-1 block text-[10px] font-semibold text-gray-400">
            Optional. Leave blank if there is no fixed deadline.
          </span>
        </label>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
            <CircleDollarSign className="h-3.5 w-3.5 text-brand-blue" /> Affiliate reward
            <FieldTooltip text="Choose how the affiliate is paid. For a fixed fee, hourly or commission, enter the amount in pounds." />
          </span>
          <select
            value={compensationModel}
            onChange={(event) =>
              onCompensationModelChange(event.target.value as CompensationModel)
            }
            className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-base font-semibold text-gray-900 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 sm:text-sm"
          >
            {COMPENSATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {amountNeeded && (
            <div className="mt-2 flex overflow-hidden rounded-xl border border-gray-200 bg-white">
              <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-500">
                £
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={compensationAmount}
                onChange={(event) => onCompensationAmountChange(event.target.value)}
                placeholder="75"
                className="min-h-11 min-w-0 flex-1 px-3 text-base font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:outline-none sm:text-sm"
              />
            </div>
          )}
          <span className="mt-1 block text-[10px] font-semibold text-gray-400">
            {COMPENSATION_OPTIONS.find((option) => option.value === compensationModel)?.helper}
          </span>

          {compensationModel === 'MEMBERSHIP_INCLUDED' && (
            <div
              className={cn(
                'mt-2 rounded-xl border px-3 py-2.5',
                quota && quota.source !== 'NONE'
                  ? 'border-emerald-100 bg-emerald-50'
                  : 'border-amber-100 bg-amber-50',
              )}
            >
              {!quota ? (
                <p className="text-[10px] font-semibold text-gray-500">
                  Checking your membership allowance…
                </p>
              ) : quota.source === 'NONE' ? (
                <p className="flex items-start gap-1.5 text-[10px] font-semibold leading-4 text-amber-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  No delegated-task allowance found on your current plan. Choose another reward type
                  or check your membership.
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 text-[10px] font-black text-emerald-800">
                    {quota.unlimited ? (
                      <InfinityIcon className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Ticket className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {quota.unlimited
                      ? 'Unlimited delegated tasks included'
                      : `${quota.remaining ?? 0} of ${quota.freeLimit} free delegated tasks left`}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-emerald-700">
                    {quota.planName ?? 'Your plan'}
                    {!quota.unlimited && formatQuotaDate(quota.periodEnd)
                      ? ` · resets ${formatQuotaDate(quota.periodEnd)}`
                      : ''}
                  </p>
                  {!quota.unlimited && quota.freeLimit > 0 && (
                    <>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((quota.used / quota.freeLimit) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[9px] font-semibold text-emerald-700/80">
                        {quota.used} used · {quota.remaining ?? 0} left
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5">
            <input
              type="checkbox"
              checked={requiresBusinessApproval}
              onChange={(event) =>
                onRequiresBusinessApprovalChange(event.target.checked)
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
            />
            <span>
              <span className="flex items-center gap-1.5 text-[11px] font-black text-gray-800">
                I approve the delivered outcome
                <FieldTooltip text="Turn this on if you want to review the work before it is marked complete." />
              </span>
              <span className="block text-[10px] font-medium leading-4 text-gray-500">
                The affiliate submits the work, then you review it before it is marked complete.
              </span>
            </span>
          </label>
        </div>

      </div>
    </div>
  );
}
