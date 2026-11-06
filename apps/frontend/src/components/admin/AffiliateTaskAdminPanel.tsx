import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Flag,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trophy,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import AffiliateSettlementLedger from './AffiliateSettlementLedger';
import {
  useAdminAccountManagers,
  useAdminAgents,
  useAdminConsultants,
  useAffiliateReports,
  useAffiliateReputation,
  useAffiliateSettlementSummary,
  useAffiliateTasksAdmin,
  useAssignAffiliateTask,
  useBackfillAccountManagers,
  useCancelAffiliateTaskAdmin,
  useReviewAffiliateReport,
  useReviewAffiliateTask,
} from '../../services/admin/hooks';
import type {
  AdminAffiliateReport,
  AdminAffiliateTask,
} from '../../services/admin/types';

const isMembershipFunded = (task: AdminAffiliateTask) =>
  task.freeDelegation === true ||
  task.compensationModel === 'MEMBERSHIP_INCLUDED' ||
  task.delegationQuotaSource === 'MEMBERSHIP' ||
  task.delegationQuotaSource === 'ACCESS_PASS';

const STATUS_LABELS: Record<string, string> = {
  PENDING_ASSIGNMENT: 'Awaiting assignment',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted — needs review',
  PENDING_BUSINESS_APPROVAL: 'Awaiting business approval',
  REVISION_REQUESTED: 'Changes requested',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING_ASSIGNMENT: 'bg-amber-100 text-amber-800',
  ASSIGNED: 'bg-sky-100 text-sky-800',
  ACCEPTED: 'bg-sky-100 text-sky-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  SUBMITTED: 'bg-violet-100 text-violet-800',
  PENDING_BUSINESS_APPROVAL: 'bg-amber-100 text-amber-800',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const REPORT_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  VALID: 'bg-red-100 text-red-700',
  INVALID: 'bg-gray-100 text-gray-600',
};

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'No money',
  PENDING_HOLD: 'Hold pending',
  HELD: 'Escrowed',
  SETTLING: 'Settling',
  SETTLED: 'Settled',
  RELEASED: 'Released',
  FAILED: 'Needs attention',
};

const SETTLEMENT_STATUS_STYLES: Record<string, string> = {
  NOT_REQUIRED: 'bg-gray-100 text-gray-600',
  PENDING_HOLD: 'bg-amber-100 text-amber-800',
  HELD: 'bg-sky-100 text-sky-800',
  SETTLING: 'bg-indigo-100 text-indigo-800',
  SETTLED: 'bg-emerald-100 text-emerald-800',
  RELEASED: 'bg-gray-100 text-gray-600',
  FAILED: 'bg-red-100 text-red-700',
};

const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;

const formatCredits = (value: string | number | null | undefined) =>
  num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function nameOf(person?: { firstName?: string | null; lastName?: string | null; email?: string } | null) {
  if (!person) return '—';
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || '—';
}

export default function AffiliateTaskAdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const createdNotice = (location.state ?? null) as
    | {
        taskCreated?: boolean;
        taskTitle?: string;
        businessName?: string;
        assigneeName?: string | null;
      }
    | null;
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const [tab, setTab] = useState<'tasks' | 'settlements' | 'reports'>('tasks');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [unassigned, setUnassigned] = useState(false);

  const query = useMemo(
    () => ({
      status: status || undefined,
      search: search.trim() || undefined,
      unassigned: unassigned ? 'true' : undefined,
      limit: 50,
    }),
    [status, search, unassigned],
  );

  const tasksRes = useAffiliateTasksAdmin(query);
  const tasks: AdminAffiliateTask[] = tasksRes.data?.data ?? [];
  // Separate lightweight query so the review shortcut reflects the whole
  // submission queue, not just the current filter/search.
  const submittedQueue = useAffiliateTasksAdmin({ status: 'SUBMITTED', limit: 1 });
  const submittedCount = submittedQueue.data?.total ?? 0;
  const reportsRes = useAffiliateReports({ limit: 50 });
  const reports: AdminAffiliateReport[] = reportsRes.data?.data ?? [];

  const summaryRes = useAffiliateSettlementSummary();
  const summary = summaryRes.data?.data;

  const agents = useAdminAgents({ limit: 100 }).data?.data ?? [];
  const consultants = useAdminConsultants({ limit: 100 }).data?.data ?? [];
  const managers = useAdminAccountManagers({ limit: 100 }).data?.data ?? [];

  const assignees = useMemo(
    () => [
      ...managers.map((m: any) => ({ userId: m.userId, name: m.name, email: m.email, role: 'ACCOUNT_MANAGER' })),
      ...agents.map((a: any) => ({ userId: a.userId, name: a.name, email: a.email, role: 'AGENT' })),
      ...consultants.map((c: any) => ({ userId: c.userId, name: c.name, email: c.email, role: 'CONSULTANT' })),
    ],
    [managers, agents, consultants],
  );

  const assignTask = useAssignAffiliateTask();
  const reviewTask = useReviewAffiliateTask();
  const cancelTask = useCancelAffiliateTaskAdmin();
  const reviewReport = useReviewAffiliateReport();
  const backfillManagers = useBackfillAccountManagers();
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const [assignFor, setAssignFor] = useState<AdminAffiliateTask | null>(null);
  const [assignee, setAssignee] = useState('');
  const [assignComp, setAssignComp] = useState('');
  const [assignCharge, setAssignCharge] = useState('');
  const [assignFee, setAssignFee] = useState('');
  const [assignBillable, setAssignBillable] = useState(false);
  const [assignApproval, setAssignApproval] = useState(true);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<AdminAffiliateTask | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'CHANGES_REQUESTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewComp, setReviewComp] = useState('');
  const [reputationFor, setReputationFor] = useState<string | null>(null);
  const [reportActionFor, setReportActionFor] = useState<AdminAffiliateReport | null>(null);
  const [reportDecision, setReportDecision] = useState<'VALID' | 'INVALID'>('VALID');
  const [reportNotes, setReportNotes] = useState('');

  const reputation = useAffiliateReputation(reputationFor ?? undefined);

  return (
    <div className="space-y-5">
      {createdNotice?.taskCreated && !noticeDismissed && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-black text-emerald-900">
                Task created{createdNotice.taskTitle ? `: ${createdNotice.taskTitle}` : ''}
              </p>
              <p className="mt-0.5 text-xs font-medium text-emerald-800">
                {createdNotice.businessName ? `For ${createdNotice.businessName}. ` : ''}
                {createdNotice.assigneeName
                  ? `Assigned to ${createdNotice.assigneeName}.`
                  : 'Left unassigned for auto-routing.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setNoticeDismissed(true)}
            className="shrink-0 rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('tasks')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold',
            tab === 'tasks' ? 'bg-brand-blue text-white' : 'bg-white border border-gray-200 text-gray-600',
          )}
        >
          <ClipboardList className="w-4 h-4" /> Delegated tasks
        </button>
        <button
          onClick={() => setTab('settlements')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold',
            tab === 'settlements' ? 'bg-brand-blue text-white' : 'bg-white border border-gray-200 text-gray-600',
          )}
        >
          <Wallet className="w-4 h-4" /> Settlement ledger
          {summary && summary.failedCount > 0 && (
            <span className="rounded-full bg-red-500 text-white px-1.5 text-[10px] font-black">
              {summary.failedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('reports')}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold',
            tab === 'reports' ? 'bg-brand-blue text-white' : 'bg-white border border-gray-200 text-gray-600',
          )}
        >
          <Flag className="w-4 h-4" /> Reports
          {reports.some((r) => r.status === 'PENDING') && (
            <span className="rounded-full bg-red-500 text-white px-1.5 text-[10px] font-black">
              {reports.filter((r) => r.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/admin/affiliate-tasks/new')}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark"
        >
          <Plus className="w-4 h-4" /> New task
        </button>
        <button
          onClick={async () => {
            const res = await backfillManagers.mutateAsync(100);
            const data = res?.data;
            setBackfillMessage(
              data
                ? `Backfill: ${data.assigned} assigned, ${data.skipped} skipped, ${data.failed} failed (${data.candidates} checked).`
                : 'Backfill completed.',
            );
          }}
          disabled={backfillManagers.isPending}
          title="Assign account managers to paid businesses that have never had one (runs nightly too)"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {backfillManagers.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          Assign missing managers
        </button>
      </div>

      {submittedCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-violet-900">
              {submittedCount} task{submittedCount === 1 ? '' : 's'} awaiting admin review
            </p>
            <p className="text-xs font-medium text-violet-800">
              Affiliate submissions appear here after the Account Manager check. Approving marks the task
              complete, applies reputation and records payment where applicable.
            </p>
          </div>
          <button
            onClick={() => {
              setTab('tasks');
              setStatus('SUBMITTED');
            }}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
          >
            <CheckCircle2 className="h-4 w-4" /> Open review queue
          </button>
        </div>
      )}

      {backfillMessage && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-start justify-between gap-3">
          <span>{backfillMessage}</span>
          <button onClick={() => setBackfillMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tab === 'tasks' ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by task or business"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold"
            >
              <option value="">All statuses</option>
              {Object.keys(STATUS_LABELS).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-600">
              <input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} />
              Only unassigned
            </label>
            <button
              onClick={() => tasksRes.refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', tasksRes.isFetching && 'animate-spin')} /> Refresh
            </button>
          </div>

          {tasksRes.isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm font-bold text-gray-700">No delegated tasks</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-gray-900">{task.title}</p>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                            STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {STATUS_LABELS[task.status] ?? task.status}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                          {task.source}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        <span className="font-bold text-gray-700">{task.business?.businessName}</span>
                        <span className="mx-1.5">·</span>
                        {task.assignee ? nameOf(task.assignee) : 'Unassigned'}
                        <span className="mx-1.5">·</span>
                        Due {task.dueAt ? new Date(task.dueAt).toLocaleDateString('en-GB') : '—'}
                        {task.revisionCount > 0 && (
                          <span className="ml-1.5 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                            {task.revisionCount} revision{task.revisionCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2">{task.description}</p>
                      {task.status === 'DECLINED' && task.declineReason && (
                        <p className="mt-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] leading-5 text-red-800">
                          <span className="font-black">Decline reason:</span> {task.declineReason}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                          {(task.category || 'EXTERNAL').toLowerCase()}
                        </span>
                        {task.project && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{task.project.title}</span>
                        )}
                        {task.platforms.map((platform) => (
                          <span key={platform} className="rounded-full bg-gray-100 px-2 py-0.5 uppercase text-gray-500">{platform}</span>
                        ))}
                        {task.compensationAmount != null && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            {task.compensationCurrency || 'GBP'} {task.compensationAmount}
                          </span>
                        )}
                        {task.businessChargeStatus === 'PENDING_APPROVAL' && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">charge pending</span>
                        )}
                        {task.paymentStatus && task.paymentStatus !== 'NOT_APPLICABLE' && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">payment {task.paymentStatus.toLowerCase()}</span>
                        )}
                        {task.freeDelegation === true && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                            free quota
                            {task.delegationQuotaUnlimited
                              ? ' · unlimited'
                              : task.delegationQuotaLimit != null
                                ? ` · ${task.delegationQuotaUsed ?? 0}/${task.delegationQuotaLimit} used`
                                : ''}
                          </span>
                        )}
                        {task.freeDelegation === false &&
                          task.delegationQuotaSource &&
                          task.delegationQuotaSource !== 'NONE' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                              over free limit · chargeable
                            </span>
                          )}
                        {task.settlement && task.settlement.status !== 'NOT_REQUIRED' && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5',
                              task.settlement.status === 'SETTLED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : task.settlement.status === 'FAILED'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-sky-100 text-sky-800',
                            )}
                          >
                            escrow {task.settlement.status.toLowerCase()}
                          </span>
                        )}
                      </div>
                      {task.deliverables && (
                        <p className="mt-1 text-[11px] text-gray-500"><span className="font-bold text-gray-700">Deliverables:</span> {task.deliverables}</p>
                      )}
                      {task.lastSyncError && (
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">
                          Affiliate sync: {task.lastSyncError}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      {['PENDING_ASSIGNMENT', 'DECLINED'].includes(task.status) && (
                        <button
                          onClick={() => {
                            setAssignFor(task);
                            setAssignee('');
                            setAssignComp(
                              task.compensationAmount != null ? String(task.compensationAmount) : '',
                            );
                            setAssignCharge(
                              task.businessChargeAmount != null ? String(task.businessChargeAmount) : '',
                            );
                            setAssignBillable(Boolean(task.billableToBusiness));
                            setAssignApproval(task.requiresBusinessApproval ?? true);
                            setAssignFee(
                              task.settlement?.platformFeePercent != null
                                ? String(task.settlement.platformFeePercent)
                                : '',
                            );
                            setAssignError(null);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-dark"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> {task.status === 'DECLINED' ? 'Reassign' : 'Assign'}
                        </button>
                      )}
                      {['SUBMITTED', 'PENDING_BUSINESS_APPROVAL'].includes(task.status) && (
                        <button
                          onClick={() => {
                            setReviewFor(task);
                            setReviewDecision('APPROVED');
                            setReviewNotes('');
                            setReviewComp(
                              task.compensationAmount != null ? String(task.compensationAmount) : '',
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Review
                        </button>
                      )}
                      {task.assignee && (
                        <button
                          onClick={() => setReputationFor(task.assignee!.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                        >
                          <Trophy className="w-3.5 h-3.5" /> Reputation
                        </button>
                      )}
                      {!['COMPLETED', 'CANCELLED', 'DECLINED'].includes(task.status) && (
                        <button
                          onClick={() => cancelTask.mutate(task.id)}
                          disabled={cancelTask.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {task.submissionData && Object.keys(task.submissionData).length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[11px] font-bold text-brand-blue">
                        View submission
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-gray-50 border border-gray-100 p-2 text-[10px] text-gray-600">
                        {JSON.stringify(task.submissionData, null, 2)}
                      </pre>
                    </details>
                  )}

                  {task.attachments && task.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue/10 px-2.5 py-1 text-[10px] font-bold text-brand-blue hover:bg-brand-blue/20"
                        >
                          {attachment.fileName || attachment.kind || 'Attachment'}
                        </a>
                      ))}
                    </div>
                  )}

                  {task.reviews && task.reviews.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.reviews.slice(0, 3).map((review) => (
                        <span
                          key={review.id}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold',
                            review.decision === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-orange-50 text-orange-700',
                          )}
                        >
                          R{review.round} · {review.decision === 'APPROVED' ? 'approved' : 'changes'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'settlements' ? (
        <AffiliateSettlementLedger />
      ) : (
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          {reportsRes.isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
            </div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center">
              <Flag className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm font-bold text-gray-700">No reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="rounded-2xl border border-gray-100 p-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-gray-900">{report.reason}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', REPORT_STYLES[report.status])}>
                        {report.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="font-bold text-gray-700">{report.business?.businessName}</span> reported{' '}
                      {nameOf(report.affiliate)}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">{report.description}</p>
                    {report.adminNotes && (
                      <p className="mt-1 text-[11px] text-gray-500">Admin notes: {report.adminNotes}</p>
                    )}
                  </div>
                  {report.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        setReportActionFor(report);
                        setReportDecision('VALID');
                        setReportNotes('');
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-dark"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Review
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign modal */}
      {assignFor && (
        <Modal title={`Assign "${assignFor.title}"`} onClose={() => setAssignFor(null)}>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold"
          >
            <option value="">Select an affiliate</option>
            {assignees.map((item: any) => (
              <option key={item.userId} value={item.userId}>
                {item.name} — {item.role.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-bold text-gray-700">
              Affiliate compensation (GBP)
              <input
                type="number"
                min={0}
                value={assignComp}
                onChange={(e) => setAssignComp(e.target.value)}
                placeholder="75"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold"
              />
            </label>
            <label className="text-[11px] font-bold text-gray-700">
              Business charge (GBP)
              <input
                type="number"
                min={0}
                value={assignCharge}
                onChange={(e) => {
                  setAssignCharge(e.target.value);
                  if (Number(e.target.value) > 0) setAssignBillable(true);
                }}
                placeholder="120"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold"
              />
            </label>
          </div>
          <label className="block text-[11px] font-bold text-gray-700">
            Platform fee (% of business charge)
            <input
              type="number"
              min={0}
              max={100}
              value={assignFee}
              onChange={(e) => setAssignFee(e.target.value)}
              placeholder="10"
              className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold"
            />
            <span className="mt-1 block text-[10px] font-medium text-gray-400">
              Capped at the gap between the business charge and the affiliate payout, so the affiliate is
              always paid in full.
            </span>
          </label>
          <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-800">
            The business&apos;s free delegated-task allowance is checked on assignment. If it is exhausted,
            this task is chargeable and a business charge is required.
          </p>
          <div className="flex flex-wrap gap-4 text-[11px] font-semibold text-gray-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={assignBillable}
                onChange={(e) => setAssignBillable(e.target.checked)}
              />
              Charge the business
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={assignApproval}
                onChange={(e) => setAssignApproval(e.target.checked)}
              />
              Business approves the outcome
            </label>
          </div>
          {assignError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800">
              {assignError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAssignFor(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600">
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!assignee) return;
                setAssignError(null);
                try {
                  await assignTask.mutateAsync({
                    id: assignFor.id,
                    data: {
                      assigneeUserId: assignee,
                      compensationAmount: assignComp ? Number(assignComp) : undefined,
                      billableToBusiness: assignBillable,
                      businessChargeAmount: assignCharge ? Number(assignCharge) : undefined,
                      requiresBusinessApproval: assignApproval,
                      platformFeePercent: assignFee ? Number(assignFee) : undefined,
                    },
                  });
                  setAssignFor(null);
                } catch (error: any) {
                  setAssignError(
                    error?.response?.data?.message ||
                      error?.message ||
                      'Could not assign the task. Check the business wallet balance.',
                  );
                }
              }}
              disabled={!assignee || assignTask.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {assignTask.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assign task
            </button>
          </div>
        </Modal>
      )}

      {/* Review modal */}
      {reviewFor && (
        <Modal title={`Review "${reviewFor.title}"`} onClose={() => setReviewFor(null)}>
          <div className="flex gap-2">
            <button
              onClick={() => setReviewDecision('APPROVED')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-xs font-bold',
                reviewDecision === 'APPROVED'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-gray-200 text-gray-600',
              )}
            >
              Approve & complete
            </button>
            <button
              onClick={() => setReviewDecision('CHANGES_REQUESTED')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-xs font-bold',
                reviewDecision === 'CHANGES_REQUESTED'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'border-gray-200 text-gray-600',
              )}
            >
              Request changes
            </button>
          </div>
          {reviewDecision === 'APPROVED' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <label className="block text-[11px] font-bold text-gray-700">
                Affiliate compensation (GBP)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={reviewComp}
                  onChange={(e) => setReviewComp(e.target.value)}
                  placeholder="20.00"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"
                />
              </label>
              <p className="mt-1.5 text-[10px] font-medium leading-4 text-blue-800">
                Enter the amount the affiliate should receive for this task. It is stored exactly in
                pence, then paid into their MCOM wallet and written to the ledger when you approve.
              </p>
              {isMembershipFunded(reviewFor) ? (
                <p className="mt-1 text-[10px] font-semibold text-blue-900">
                  This task is funded by the business&apos;s membership / access pass. Compensation is
                  required before approval.
                </p>
              ) : null}
              {(!reviewComp || Number(reviewComp) <= 0) && isMembershipFunded(reviewFor) ? (
                <p className="mt-1 text-[10px] font-semibold text-red-700">
                  Enter a compensation amount greater than zero.
                </p>
              ) : null}
            </div>
          )}
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={4}
            placeholder={
              reviewDecision === 'APPROVED'
                ? 'Optional note for the affiliate'
                : 'Tell the affiliate exactly what to change'
            }
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <p className="text-[11px] text-gray-500">
            {reviewDecision === 'APPROVED'
              ? 'Approving applies +10 reputation and +1 completed task (experience).'
              : 'Requesting changes sends the task back with your notes; no reputation change yet.'}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setReviewFor(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600">
              Cancel
            </button>
            <button
              onClick={async () => {
                await reviewTask.mutateAsync({
                  id: reviewFor.id,
                  data: {
                    decision: reviewDecision,
                    notes: reviewNotes || undefined,
                    ...(reviewDecision === 'APPROVED' && reviewComp
                      ? { compensationPence: Math.round(Number(reviewComp) * 100) }
                      : {}),
                  },
                });
                setReviewFor(null);
              }}
              disabled={
                reviewTask.isPending ||
                (reviewDecision === 'CHANGES_REQUESTED' && !reviewNotes.trim()) ||
                (reviewDecision === 'APPROVED' &&
                  isMembershipFunded(reviewFor) &&
                  (!reviewComp || Number(reviewComp) <= 0))
              }
              className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {reviewTask.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save review
            </button>
          </div>
        </Modal>
      )}

      {/* Report modal */}
      {reportActionFor && (
        <Modal title="Review affiliate report" onClose={() => setReportActionFor(null)}>
          <div className="flex gap-2">
            <button
              onClick={() => setReportDecision('VALID')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-xs font-bold',
                reportDecision === 'VALID' ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600',
              )}
            >
              Mark valid (−15 rep)
            </button>
            <button
              onClick={() => setReportDecision('INVALID')}
              className={cn(
                'flex-1 rounded-xl border px-3 py-2 text-xs font-bold',
                reportDecision === 'INVALID' ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 text-gray-600',
              )}
            >
              Dismiss
            </button>
          </div>
          <textarea
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setReportActionFor(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600">
              Cancel
            </button>
            <button
              onClick={async () => {
                await reviewReport.mutateAsync({
                  id: reportActionFor.id,
                  data: { decision: reportDecision, adminNotes: reportNotes || undefined },
                });
                setReportActionFor(null);
              }}
              disabled={reviewReport.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {reviewReport.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save decision
            </button>
          </div>
        </Modal>
      )}

      {/* Reputation modal */}
      {reputationFor && (
        <Modal title="Affiliate reputation" onClose={() => setReputationFor(null)}>
          {reputation.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
            </div>
          ) : reputation.data?.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Reputation" value={reputation.data.data.reputationScore} />
                <Stat label="Experience" value={reputation.data.data.experienceScore} />
                <Stat label="Completed" value={reputation.data.data.completedTasksCount} />
                <Stat label="Failed" value={reputation.data.data.failedTasksCount} />
                <Stat
                  label="Avg rating"
                  value={
                    reputation.data.data.ratingAverage != null
                      ? `${reputation.data.data.ratingAverage.toFixed(1)} / 5`
                      : '—'
                  }
                />
                <Stat label="Ratings" value={reputation.data.data.ratingCount} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Recent events
                </p>
                <div className="space-y-1 max-h-56 overflow-auto">
                  {reputation.data.data.events.map((event) => (
                    <div key={event.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px]">
                      <span className="text-gray-600">{event.reason}</span>
                      <span className={cn('font-black', event.delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {event.delta > 0 ? '+' : ''}{event.delta}
                      </span>
                    </div>
                  ))}
                  {reputation.data.data.events.length === 0 && (
                    <p className="text-xs text-gray-400">No reputation events yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No reputation data.</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-black text-gray-900">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
