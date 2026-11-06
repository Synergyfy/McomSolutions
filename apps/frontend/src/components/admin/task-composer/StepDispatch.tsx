import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  CircleDollarSign,
  Loader2,
  ReceiptText,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import FieldTooltip from '../../common/FieldTooltip';
import {
  COMPENSATION_OPTIONS,
  initials,
  type CompensationModel,
  type TaskCategory,
} from '../../task-composer/taskComposerUtils';
import StepIntro from '../../task-composer/StepIntro';
import {
  ADMIN_ROLE_FILTERS,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLE_STYLES,
  amountNeededFor,
  categoryLabel,
  formatGbp,
  type AdminAssignee,
  type AdminAssigneeRole,
} from './adminTaskComposerUtils';

interface DispatchSummary {
  businessName: string;
  title: string;
  category: TaskCategory;
  platforms: string[];
  requiredSkills: string[];
  assigneeName: string;
}

interface StepDispatchProps {
  assignees: AdminAssignee[];
  assigneesLoading: boolean;
  assigneeUserId: string;
  onAssigneeChange: (userId: string) => void;
  dueAt: string;
  onDueAtChange: (value: string) => void;
  compensationModel: CompensationModel;
  onCompensationModelChange: (value: CompensationModel) => void;
  compensationAmount: string;
  onCompensationAmountChange: (value: string) => void;
  billableToBusiness: boolean;
  onBillableToBusinessChange: (value: boolean) => void;
  businessChargeAmount: string;
  onBusinessChargeAmountChange: (value: string) => void;
  platformFeePercent: string;
  onPlatformFeePercentChange: (value: string) => void;
  requiresBusinessApproval: boolean;
  onRequiresBusinessApprovalChange: (value: boolean) => void;
  summary: DispatchSummary;
}

const today = new Date().toISOString().slice(0, 10);

export default function StepDispatch({
  assignees,
  assigneesLoading,
  assigneeUserId,
  onAssigneeChange,
  dueAt,
  onDueAtChange,
  compensationModel,
  onCompensationModelChange,
  compensationAmount,
  onCompensationAmountChange,
  billableToBusiness,
  onBillableToBusinessChange,
  businessChargeAmount,
  onBusinessChargeAmountChange,
  platformFeePercent,
  onPlatformFeePercentChange,
  requiresBusinessApproval,
  onRequiresBusinessApprovalChange,
  summary,
}: StepDispatchProps) {
  const [roleFilter, setRoleFilter] = useState<'ALL' | AdminAssigneeRole>('ALL');
  const [search, setSearch] = useState('');

  const filteredAssignees = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return assignees.filter((assignee) => {
      if (roleFilter !== 'ALL' && assignee.role !== roleFilter) return false;
      if (!needle) return true;
      return `${assignee.name} ${assignee.email}`.toLowerCase().includes(needle);
    });
  }, [assignees, roleFilter, search]);

  const selectedAssignee = assignees.find((assignee) => assignee.userId === assigneeUserId);
  const amountNeeded = amountNeededFor(compensationModel);
  const compValue = compensationAmount ? Number(compensationAmount) : null;
  const chargeValue = businessChargeAmount ? Number(businessChargeAmount) : null;
  const feeValue = platformFeePercent ? Number(platformFeePercent) : null;

  return (
    <div>
      <StepIntro
        icon={Users}
        eyebrow="Step 6 of 6"
        title="Dispatch, reward and charge"
        description="Choose who takes it, set the deadline and decide how the affiliate is rewarded. Leave the assignee blank to let the account manager or admin routing take over."
        tip="The business's free delegated-task allowance is checked on creation. Over the allowance the task becomes chargeable and the business wallet is reserved before the affiliate can accept it."
        tooltip="This step decides who does the work, when it is due, what the affiliate is paid, and whether the business is charged."
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
              Who should do it?
              <FieldTooltip text="Pick an affiliate directly, or leave it blank so the business's account manager or the admin team routes it." />
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500">
              Pick an affiliate directly, or leave it to auto-routing.
            </p>
          </div>
          <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 text-[10px] font-black text-brand-blue">
            {filteredAssignees.length} affiliate{filteredAssignees.length === 1 ? '' : 's'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onAssigneeChange('')}
          className={cn(
            'mt-3 flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-all',
            assigneeUserId === ''
              ? 'border-brand-blue bg-brand-blue/[0.05]'
              : 'border-gray-100 bg-white hover:border-brand-blue/30',
          )}
        >
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              assigneeUserId === '' ? 'bg-brand-blue text-white' : 'bg-violet-50 text-violet-600',
            )}
          >
            <UserCog className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-black text-gray-900">
              Leave unassigned — auto-route
            </span>
            <span className="block text-[10px] font-semibold text-gray-500">
              The business&apos;s account manager takes it, or the admin team routes it.
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

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ADMIN_ROLE_FILTERS.map((filter) => (
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

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search affiliates by name or email…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-base font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-brand-blue focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-blue/10 sm:text-xs"
          />
          <FieldTooltip
            text="Filter the affiliate list by name or email. Use the role chips above to narrow it further."
            align="right"
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          />
        </div>

        {selectedAssignee && (
          <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Selected: <strong className="font-black">{selectedAssignee.name}</strong>
            <button
              type="button"
              onClick={() => onAssigneeChange('')}
              className="ml-auto shrink-0 text-[10px] font-black underline underline-offset-2"
            >
              Clear
            </button>
          </p>
        )}

        <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {assigneesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
            </div>
          ) : filteredAssignees.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-3 py-4 text-center text-[11px] font-semibold text-gray-500">
              No affiliates match this filter.
            </p>
          ) : (
            filteredAssignees.map((assignee) => {
              const active = assignee.userId === assigneeUserId;
              return (
                <button
                  key={assignee.userId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onAssigneeChange(assignee.userId)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all',
                    active
                      ? 'border-brand-blue bg-brand-blue/[0.05]'
                      : 'border-gray-100 bg-white hover:border-brand-blue/30 hover:bg-gray-50/60',
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-black text-white">
                    {initials(assignee.name || assignee.email)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-black text-gray-900">
                      {assignee.name || assignee.email}
                    </span>
                    <span className="block truncate text-[10px] font-medium text-gray-500">
                      {assignee.email}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
                      ADMIN_ROLE_STYLES[assignee.role],
                    )}
                  >
                    {ADMIN_ROLE_LABELS[assignee.role]}
                  </span>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      active
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-gray-200 text-transparent',
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 sm:grid-cols-2 sm:p-4">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
            <CalendarDays className="h-3.5 w-3.5 text-brand-blue" /> Due date
            <FieldTooltip text="The latest date the work should be finished. Leave it blank to default to seven days from now." />
          </span>
          <input
            type="date"
            min={today}
            value={dueAt}
            onChange={(event) => onDueAtChange(event.target.value)}
            onClick={(event) => {
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
            Optional. Defaults to seven days from creation if left blank.
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
                step="0.01"
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
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-600">
              <ReceiptText className="h-3.5 w-3.5 text-brand-blue" /> Business charge
              <FieldTooltip text="Turn on 'Charge the business' to invoice them for this task. The platform fee is taken from that charge." />
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500">
              Applied automatically when the business is over its free allowance.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-[11px] font-bold text-gray-700">
            <input
              type="checkbox"
              checked={billableToBusiness}
              onChange={(event) => onBillableToBusinessChange(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
            />
            Charge the business
            <FieldTooltip text="Tick this to take payment from the business wallet for this task." />
          </label>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Business charge (GBP)
              <FieldTooltip text="How much to charge the business. Leave it blank to match the affiliate reward." />
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={businessChargeAmount}
              disabled={!billableToBusiness}
              onChange={(event) => onBusinessChargeAmountChange(event.target.value)}
              placeholder={compensationAmount || '120'}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="mt-1 block text-[10px] font-semibold text-gray-400">
              Leave blank to match the affiliate reward.
            </span>
          </label>
          <label className="block">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Platform fee (% of charge)
              <FieldTooltip text="The percentage MCOM keeps from the business charge. It is capped so the affiliate is always paid in full." />
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={platformFeePercent}
              disabled={!billableToBusiness}
              onChange={(event) => onPlatformFeePercentChange(event.target.value)}
              placeholder="10"
              className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="mt-1 block text-[10px] font-semibold text-gray-400">
              Capped at the spread so the affiliate payout is never reduced.
            </span>
          </label>
        </div>

        <label className="mt-3 flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5">
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
              Business approves the delivered outcome
              <FieldTooltip text="Turn this on if the business should review the work before it is marked complete." />
            </span>
            <span className="block text-[10px] font-medium leading-4 text-gray-500">
              The affiliate submits the work, then the business reviews it before it is marked
              complete. Admin review still applies first.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-3 rounded-2xl border border-brand-blue/15 bg-brand-blue/[0.03] p-3.5 sm:p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-600">Review</p>
        <div className="mt-2 grid gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-2">
          <SummaryRow label="Business" value={summary.businessName || 'Not selected'} />
          <SummaryRow label="Type" value={categoryLabel(summary.category)} />
          <SummaryRow label="Title" value={summary.title || 'Not written'} />
          <SummaryRow
            label="Assignee"
            value={summary.assigneeName || 'Auto-route / account manager'}
          />
          <SummaryRow
            label="Platforms"
            value={summary.platforms.length ? summary.platforms.join(', ') : 'None tagged'}
          />
          <SummaryRow
            label="Skills"
            value={summary.requiredSkills.length ? summary.requiredSkills.join(', ') : 'None added'}
          />
          <SummaryRow label="Due" value={dueAt ? new Date(dueAt).toLocaleDateString('en-GB') : '7 days'} />
          <SummaryRow
            label="Affiliate reward"
            value={
              amountNeeded
                ? compValue != null
                  ? formatGbp(compValue)
                  : 'Not set'
                : COMPENSATION_OPTIONS.find((option) => option.value === compensationModel)?.label ?? '—'
            }
          />
          <SummaryRow
            label="Business charge"
            value={
              billableToBusiness
                ? chargeValue != null
                  ? formatGbp(chargeValue)
                  : compValue != null
                    ? `${formatGbp(compValue)} (matches reward)`
                    : 'Calculated by allowance'
                : 'No charge'
            }
          />
          <SummaryRow
            label="Platform fee"
            value={billableToBusiness ? (feeValue != null ? `${feeValue}%` : 'Default') : '—'}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-gray-200/70 py-0.5 last:border-0">
      <span className="shrink-0 font-bold uppercase tracking-wider text-[9px] text-gray-400">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-semibold text-gray-800">{value}</span>
    </div>
  );
}
