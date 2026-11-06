import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trophy,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import TaskCountdown from './TaskCountdown';
import {
  useAccountManager,
  useAffiliateProjects,
  useAffiliateTasks,
  useApproveServiceRequestPrice,
  useCancelAffiliateTask,
  useCloseAffiliateProject,
  useCreateAffiliateTask,
  useCreateServiceRequest,
  useDelegationQuota,
  useLockAffiliateTaskFunds,
  useMyTasks,
  useNearbyAffiliates,
  usePlatformAccess,
  useReassignAffiliateTask,
  useReviewAffiliateTask,
  useReviewAffiliateTaskCharge,
  useServiceRequests,
} from '../services/business/hooks';
import type {
  AffiliateDelegationQuota,
  AffiliateProjectRecord,
  AffiliateServiceRequestRecord,
  AffiliateTaskRecord,
} from '../services/business';
import { useMyWallet } from '../services/wallet/hooks';

const STATUS_LABELS: Record<string, string> = {
  PENDING_ASSIGNMENT: 'Awaiting assignment',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted for review',
  PENDING_BUSINESS_APPROVAL: 'Awaiting your approval',
  REVISION_REQUESTED: 'Changes requested',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING_ASSIGNMENT: 'bg-amber-50 text-amber-700',
  ASSIGNED: 'bg-sky-50 text-sky-700',
  ACCEPTED: 'bg-sky-50 text-sky-700',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700',
  SUBMITTED: 'bg-violet-50 text-violet-700',
  PENDING_BUSINESS_APPROVAL: 'bg-amber-100 text-amber-800',
  REVISION_REQUESTED: 'bg-orange-50 text-orange-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const STATUS_FILTERS = ['', ...Object.keys(STATUS_LABELS)];

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardDelegatedTasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [createdFlash, setCreatedFlash] = useState<{
    fundingRequired: boolean;
  } | null>(null);
  const [fundingFeedback, setFundingFeedback] = useState<string | null>(null);
  const [lockingTaskId, setLockingTaskId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [affiliateSkill, setAffiliateSkill] = useState('');
  const [affiliatePostcode, setAffiliatePostcode] = useState('');
  const [affiliateRole, setAffiliateRole] = useState('');

  const query = useMemo(
    () => ({
      status: status || undefined,
      search: search.trim() || undefined,
      platform: platform || undefined,
      limit: 25,
    }),
    [status, search, platform],
  );

  useEffect(() => {
    const state = location.state as {
      taskCreated?: boolean;
      fundingRequired?: boolean;
    } | null;
    if (state?.taskCreated) {
      setCreatedFlash({ fundingRequired: Boolean(state.fundingRequired) });
      navigate('/dashboard/tasks', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  const { data: tasksRes, isLoading, refetch: refetchTasks } = useAffiliateTasks(query);
  const tasks: AffiliateTaskRecord[] = tasksRes?.data ?? [];
  const { data: wallet } = useMyWallet();
  const lockTaskFunds = useLockAffiliateTaskFunds();
  const { data: accessRes } = usePlatformAccess();
  const platforms = accessRes?.data?.platforms ?? [];
  const { data: quotaRes } = useDelegationQuota();
  const quota = quotaRes?.data as AffiliateDelegationQuota | undefined;
  const { data: managerRes } = useAccountManager();
  const manager = managerRes?.data ?? null;
  const { data: myTasksRes } = useMyTasks();
  const programmeTasks: any[] = myTasksRes?.data ?? [];
  const { data: affiliateSearchRes, isLoading: affiliateSearching } = useNearbyAffiliates({
    skill: affiliateSkill.trim() || undefined,
    postcode: affiliatePostcode.trim() || undefined,
    role: affiliateRole || undefined,
    limit: 12,
  });
  const affiliateResults = affiliateSearchRes?.items ?? [];
  const distanceFrom = affiliateSearchRes?.distanceFrom ?? null;
  const createTask = useCreateAffiliateTask();
  const cancelTask = useCancelAffiliateTask();
  const reassignTask = useReassignAffiliateTask();
  const [reassignFor, setReassignFor] = useState<AffiliateTaskRecord | null>(null);
  const [reassignAffiliateId, setReassignAffiliateId] = useState('');
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Service request + project state.
  const [showRequest, setShowRequest] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestOutcome, setRequestOutcome] = useState('');
  const [requestUrgency, setRequestUrgency] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);
  const [closingProject, setClosingProject] = useState<AffiliateProjectRecord | null>(null);
  const [projectOutcome, setProjectOutcome] = useState('');
  const [projectFollowUp, setProjectFollowUp] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);

  const { data: requestsRes } = useServiceRequests({ limit: 20 });
  const serviceRequests: AffiliateServiceRequestRecord[] = requestsRes?.data ?? [];
  const { data: projectsRes } = useAffiliateProjects({ limit: 20 });
  const projects: AffiliateProjectRecord[] = projectsRes?.data ?? [];
  const createServiceRequest = useCreateServiceRequest();
  const approveServiceRequestPrice = useApproveServiceRequestPrice();
  const closeProject = useCloseAffiliateProject();
  const reviewAffiliateTask = useReviewAffiliateTask();
  const reviewAffiliateTaskCharge = useReviewAffiliateTaskCharge();

  const submitServiceRequest = async () => {
    if (!requestTitle.trim() || !requestDescription.trim()) return;
    setRequestFeedback(null);
    try {
      await createServiceRequest.mutateAsync({
        title: requestTitle.trim(),
        description: requestDescription.trim(),
        desiredOutcome: requestOutcome.trim() || undefined,
        urgency: requestUrgency,
      });
      setRequestFeedback('Request submitted. Your account manager will review it and confirm the plan.');
      setShowRequest(false);
      setRequestTitle('');
      setRequestDescription('');
      setRequestOutcome('');
      setRequestUrgency('NORMAL');
    } catch (error: any) {
      setRequestFeedback(error?.response?.data?.message || 'The request could not be submitted.');
    }
  };

  const decideTask = async (task: AffiliateTaskRecord, decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    setReviewFeedback(null);
    try {
      await reviewAffiliateTask.mutateAsync({
        id: task.id,
        data: { decision, notes: reviewNotes[task.id]?.trim() || undefined },
      });
      setReviewFeedback(
        decision === 'APPROVED'
          ? 'Outcome approved. The task is complete and payment has been recorded where applicable.'
          : 'Changes requested. The affiliate will be notified.',
      );
      setReviewNotes((current) => ({ ...current, [task.id]: '' }));
    } catch (error: any) {
      setReviewFeedback(error?.response?.data?.message || 'The review could not be recorded.');
    }
  };

  const decideCharge = async (task: AffiliateTaskRecord, decision: 'APPROVED' | 'DECLINED') => {
    setReviewFeedback(null);
    try {
      await reviewAffiliateTaskCharge.mutateAsync({
        id: task.id,
        data: { decision, notes: reviewNotes[task.id]?.trim() || undefined },
      });
      setReviewFeedback(
        decision === 'APPROVED'
          ? 'Charge approved. The affiliate can now start the work.'
          : 'Charge declined and the task was cancelled.',
      );
    } catch (error: any) {
      setReviewFeedback(error?.response?.data?.message || 'The charge decision could not be recorded.');
    }
  };

  const submitProjectClose = async () => {
    if (!closingProject || !projectOutcome.trim()) return;
    await closeProject.mutateAsync({
      id: closingProject.id,
      data: {
        outcomeSummary: projectOutcome.trim(),
        followUpNotes: projectFollowUp.trim() || undefined,
        followUpRequired: Boolean(projectFollowUp.trim()),
      },
    });
    setClosingProject(null);
    setProjectOutcome('');
    setProjectFollowUp('');
  };

  const pushProgrammeTask = async (task: any) => {
    await createTask.mutateAsync({
      title: task.title,
      description: task.description,
      assignmentId: task.id,
      assigneeUserId: manager?.userId,
    });
  };

  const lockFunds = async (task: AffiliateTaskRecord) => {
    setFundingFeedback(null);
    setLockingTaskId(task.id);
    try {
      await lockTaskFunds.mutateAsync(task.id);
      setFundingFeedback(
        `Funds locked for "${task.title}". The affiliate can now start the task.`,
      );
      await refetchTasks();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setFundingFeedback(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'The funds could not be locked yet. Top up the wallet and try again.',
      );
    } finally {
      setLockingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Task Delegation</h1>
          <p className="text-sm text-gray-500 font-medium">
            Push programme tasks or create your own work for your account manager and nearby affiliates.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button
            onClick={() => setShowRequest(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-blue/30 bg-white px-4 py-2.5 text-xs font-bold text-brand-blue transition-colors hover:bg-brand-blue/5"
          >
            <MessageSquare className="w-4 h-4" /> New service request
          </button>
          <button
            onClick={() => navigate('/dashboard/tasks/new')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-brand-dark"
          >
            <Plus className="w-4 h-4" /> Create task
          </button>
        </div>
      </div>

      {quota && quota.source !== 'NONE' && (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-xs font-semibold',
            quota.unlimited || (quota.remaining ?? 0) > 0
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          {quota.unlimited
            ? `Unlimited free delegated tasks are included with ${quota.planName ?? 'your plan'}.`
            : (quota.remaining ?? 0) > 0
              ? `${quota.remaining} of ${quota.freeLimit} free delegated tasks left on ${quota.planName ?? 'your plan'}.`
              : `Your ${quota.freeLimit} free delegated task${quota.freeLimit === 1 ? '' : 's'} on ${quota.planName ?? 'your plan'} are used up. Further delegations are charged.`}
        </div>
      )}

      {createdFlash && (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-xs font-semibold flex items-start justify-between gap-3',
            createdFlash.fundingRequired
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800',
          )}
        >
          <span className="flex items-start gap-2">
            {createdFlash.fundingRequired ? (
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {createdFlash.fundingRequired
                ? 'Task assigned, but the funds are not locked yet. Top up your wallet and lock the funds so the affiliate can start. The affiliate can already see the task.'
                : 'Task launched. We are matching it with the right person now.'}
            </span>
          </span>
          <button onClick={() => setCreatedFlash(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {fundingFeedback && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-start justify-between gap-3">
          <span>{fundingFeedback}</span>
          <button onClick={() => setFundingFeedback(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {requestFeedback && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-start justify-between gap-3">
          <span>{requestFeedback}</span>
          <button onClick={() => setRequestFeedback(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {reviewFeedback && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-start justify-between gap-3">
          <span>{reviewFeedback}</span>
          <button onClick={() => setReviewFeedback(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <section
        className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"
        aria-labelledby="delegated-tasks-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2
              id="delegated-tasks-heading"
              className="flex items-center gap-2 text-base font-black text-gray-900"
            >
              <ClipboardList className="h-5 w-5 text-brand-blue" /> Delegated tasks
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs font-medium text-gray-500">
              Track every request you have delegated, its status, reviewer and deadline.
            </p>
          </div>
          <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-[11px] font-black text-brand-blue">
            {(tasksRes?.total ?? 0)} task{(tasksRes?.total ?? 0) === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search delegated tasks"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter tasks by status"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold"
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value ? STATUS_LABELS[value] : 'All statuses'}
              </option>
            ))}
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            aria-label="Filter tasks by platform"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold"
          >
            <option value="">All platforms</option>
            {platforms.map((item) => (
              <option key={item.key} value={item.key}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm font-bold text-gray-700">No delegated tasks yet</p>
            <p className="text-xs text-gray-500">Create a task or push one from your programme.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-gray-50">
            {tasks.map((task) => {
              const isOpen = expanded === task.id;
              const requiredCredits = Number(
                task.settlement?.businessChargeCredits ??
                  task.businessChargeAmount ??
                  0,
              );
              const availableCredits = Number(wallet?.availableBalance ?? 0);
              const fundingRequired = task.paymentStatus === 'ON_HOLD';
              const shortfall = Math.max(
                0,
                Number((requiredCredits - availableCredits).toFixed(2)),
              );
              const topUpAmount = Math.max(
                5,
                Math.min(500, Math.ceil(shortfall || requiredCredits || 5)),
              );
              return (
                <div key={task.id} className="py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="break-words text-sm font-bold text-gray-900">{task.title}</p>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                            STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {STATUS_LABELS[task.status] ?? task.status}
                        </span>
                        {fundingRequired && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">
                            Funds needed
                          </span>
                        )}
                        {task.source === 'PROGRAMME' && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                            Programme
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {task.assignee
                          ? `${task.assignee.firstName ?? ''} ${task.assignee.lastName ?? ''}`.trim() ||
                            task.assignee.email
                          : 'Awaiting admin assignment'}
                        <span className="mx-1.5">·</span>
                        Due {formatDate(task.dueAt)}
                        {task.platforms.length > 0 && (
                          <>
                            <span className="mx-1.5">·</span>
                            {task.platforms.join(', ')}
                          </>
                        )}
                      </p>
                      <div className="mt-1.5">
                        <TaskCountdown
                          deadlineAt={task.dueAt}
                          active={!['COMPLETED', 'CANCELLED', 'DECLINED'].includes(task.status)}
                        />
                      </div>
                      {task.status === 'DECLINED' && task.declineReason && (
                        <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] leading-5 text-red-800">
                          <span className="font-black">Decline reason:</span> {task.declineReason}
                        </p>
                      )}
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <button
                        onClick={() => setExpanded(isOpen ? null : task.id)}
                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50 sm:flex-none"
                      >
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        Details
                      </button>
                      {task.status === 'DECLINED' && (
                        <button
                          onClick={() => {
                            setReassignFor(task);
                            setReassignAffiliateId('');
                            setReassignError(null);
                          }}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-blue px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-brand-dark sm:flex-none"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> Reassign
                        </button>
                      )}
                      {!['COMPLETED', 'CANCELLED', 'DECLINED'].includes(task.status) && (
                        <button
                          onClick={() => cancelTask.mutate(task.id)}
                          disabled={cancelTask.isPending}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:flex-none"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {fundingRequired && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                      <p className="flex items-start gap-2 text-[12px] font-black text-amber-900">
                        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                        Funds are not locked — the affiliate can see this task but cannot start.
                      </p>
                      <p className="mt-1 text-[11px] font-medium leading-5 text-amber-800">
                        {shortfall > 0
                          ? `Add at least ${shortfall.toFixed(2)} MCOM (£${shortfall.toFixed(2)}) to your wallet, then lock the funds.`
                          : `Your available balance covers this task. Lock ${requiredCredits.toFixed(2)} MCOM now so the affiliate can start.`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/dashboard/wallet?topup=required&amount=${topUpAmount}&taskId=${task.id}`,
                            )
                          }
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[11px] font-black text-white hover:bg-brand-dark"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          {shortfall > 0 ? 'Fund wallet' : 'Open wallet'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void lockFunds(task)}
                          disabled={lockingTaskId === task.id}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-black text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {lockingTaskId === task.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LockKeyhole className="h-3.5 w-3.5" />
                          )}
                          {lockingTaskId === task.id ? 'Locking…' : 'Lock funds now'}
                        </button>
                      </div>
                      <p className="mt-1.5 text-[10px] font-semibold text-amber-700">
                        You can fund later. The task stays blocked for the affiliate until the
                        money is reserved.
                      </p>
                    </div>
                  )}

                  {isOpen && (
                    <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-2">
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{task.description}</p>
                      {task.lastSyncError && (
                        <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" /> Affiliate sync: {task.lastSyncError}
                        </p>
                      )}
                      {task.reviews && task.reviews.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Review history
                          </p>
                          {task.reviews.map((review) => (
                            <div key={review.id} className="rounded-xl bg-white border border-gray-100 p-2">
                              <p className="text-[11px] font-bold text-gray-800">
                                Round {review.round}:{' '}
                                {review.decision === 'APPROVED' ? 'Approved' : 'Changes requested'}
                              </p>
                              {review.notes && <p className="text-[11px] text-gray-600">{review.notes}</p>}
                              <p className="text-[10px] text-gray-400">
                                {formatDate(review.reviewedAt)}
                                {review.acknowledgedAt ? ' · seen by affiliate' : ''}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                          {(task.category || 'EXTERNAL').toLowerCase()} task
                        </span>
                        {task.project && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                            {task.project.title}
                          </span>
                        )}
                        {task.compensationModel && task.compensationModel !== 'NONE' && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            {task.compensationModel.replaceAll('_', ' ')}
                            {task.compensationAmount != null ? ` · ${task.compensationCurrency || 'GBP'} ${task.compensationAmount}` : ''}
                          </span>
                        )}
                        {task.paymentStatus && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            payment {task.paymentStatus.replaceAll('_', ' ').toLowerCase()}
                          </span>
                        )}
                        {task.freeDelegation === true && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                            free task
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
                              beyond free allowance · charged
                            </span>
                          )}
                      </div>
                      {task.deliverables && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Agreed deliverables</p>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] text-gray-600">{task.deliverables}</p>
                        </div>
                      )}
                      {task.materials && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Materials supplied</p>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] text-gray-600">{task.materials}</p>
                        </div>
                      )}
                      {task.submissionData && Object.keys(task.submissionData).length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Submission
                          </p>
                          <pre className="mt-1 max-h-40 overflow-auto rounded-xl bg-white border border-gray-100 p-2 text-[10px] text-gray-600">
                            {JSON.stringify(task.submissionData, null, 2)}
                          </pre>
                        </div>
                      )}

                      {task.businessChargeStatus === 'PENDING_APPROVAL' && !fundingRequired && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                          <p className="text-[11px] font-bold text-amber-900">
                            Charge approval required: {task.businessChargeCurrency || 'GBP'} {task.businessChargeAmount ?? 0}
                          </p>
                          <p className="mt-0.5 text-[10px] text-amber-800">
                            Chargeable work cannot begin until you approve. This is separate from the affiliate&apos;s earnings.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => void decideCharge(task, 'APPROVED')}
                              disabled={reviewAffiliateTaskCharge.isPending}
                              className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              Approve charge
                            </button>
                            <button
                              onClick={() => void decideCharge(task, 'DECLINED')}
                              disabled={reviewAffiliateTaskCharge.isPending}
                              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      )}

                      {task.settlement && task.settlement.status !== 'NOT_REQUIRED' && !fundingRequired && (
                        <div
                          className={cn(
                            'rounded-xl border p-2.5 text-[11px]',
                            task.settlement.status === 'SETTLED'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                              : task.settlement.status === 'FAILED'
                                ? 'border-red-200 bg-red-50 text-red-900'
                                : 'border-sky-200 bg-sky-50 text-sky-900',
                          )}
                        >
                          <p className="font-bold">
                            {task.settlement.status === 'SETTLED'
                              ? 'Charge settled'
                              : task.settlement.status === 'HELD'
                                ? `Funds reserved: ${Number(task.settlement.businessChargeCredits ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} MCOM`
                                : `Payment status: ${task.settlement.status.replaceAll('_', ' ').toLowerCase()}`}
                          </p>
                          <p className="mt-0.5 text-[10px] opacity-80">
                            {task.settlement.status === 'SETTLED'
                              ? 'The business charge was captured and the affiliate was paid into their MCOM wallet.'
                              : task.settlement.status === 'HELD'
                                ? 'Reserved from your MCOM wallet while the work is in progress. It is released automatically if the task is cancelled or the charge is declined.'
                                : task.settlement.failureReason ||
                                  'We could not reserve the charge. Top up your MCOM wallet and contact support.'}
                          </p>
                        </div>
                      )}

                      {task.status === 'PENDING_BUSINESS_APPROVAL' && (
                        <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5">
                          <p className="text-[11px] font-bold text-violet-900">
                            Your account manager checked the submission. Approve the outcome or request changes.
                          </p>
                          <textarea
                            value={reviewNotes[task.id] || ''}
                            onChange={(event) =>
                              setReviewNotes((current) => ({ ...current, [task.id]: event.target.value }))
                            }
                            rows={2}
                            placeholder="Acceptance notes or change instructions"
                            className="mt-2 w-full rounded-lg border border-violet-200 px-2 py-1.5 text-[11px]"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              onClick={() => void decideTask(task, 'APPROVED')}
                              disabled={reviewAffiliateTask.isPending}
                              className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              Approve outcome
                            </button>
                            <button
                              onClick={() => void decideTask(task, 'CHANGES_REQUESTED')}
                              disabled={reviewAffiliateTask.isPending || !(reviewNotes[task.id] || '').trim()}
                              className="rounded-lg border border-orange-300 bg-white px-2.5 py-1 text-[10px] font-bold text-orange-800 hover:bg-orange-50 disabled:opacity-50"
                            >
                              Request changes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Service requests — the business's support channel/ask */}
      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-blue" /> Service requests
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Describe the outcome you need. Your account manager clarifies it and turns it into a project and tasks.
            </p>
          </div>
          <span className="text-[11px] font-bold text-gray-400">{serviceRequests.length} request{serviceRequests.length === 1 ? '' : 's'}</span>
        </div>
        {serviceRequests.length === 0 ? (
          <p className="mt-3 rounded-xl bg-gray-50 px-4 py-4 text-center text-xs font-semibold text-gray-500">
            No service requests yet. Use “New service request” to tell your account manager what you need.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {serviceRequests.slice(0, 6).map((request) => (
              <div key={request.id} className="rounded-xl border border-gray-100 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900">{request.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{request.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-600">
                      {request.status.replaceAll('_', ' ')}
                    </span>
                    {request.project && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {request.project.title}
                      </span>
                    )}
                  </div>
                </div>
                {request.clarificationNote && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                    <strong>Account manager:</strong> {request.clarificationNote}
                  </p>
                )}
                {request.estimatedCost != null && !request.priceApprovedAt && (
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-50 px-2 py-1.5">
                    <span className="text-[11px] font-semibold text-sky-800">
                      Quote: {request.currency} {request.estimatedCost} — approve before chargeable work begins.
                    </span>
                    <button
                      onClick={() => void approveServiceRequestPrice.mutateAsync({ id: request.id, data: {} })}
                      disabled={approveServiceRequestPrice.isPending}
                      className="rounded-lg bg-sky-700 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-sky-800 disabled:opacity-50"
                    >
                      Approve quote
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects group related tasks into one service plan */}
      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-blue" /> Projects
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Related tasks grouped under one outcome. Close a project to record the result and any follow-up.
            </p>
          </div>
          <span className="text-[11px] font-bold text-gray-400">{projects.length} project{projects.length === 1 ? '' : 's'}</span>
        </div>
        {projects.length === 0 ? (
          <p className="mt-3 rounded-xl bg-gray-50 px-4 py-4 text-center text-xs font-semibold text-gray-500">
            No projects yet. Your account manager can convert a service request into a project, or group tasks when creating them.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {projects.slice(0, 6).map((project) => (
              <div key={project.id} className="rounded-xl border border-gray-100 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900">{project.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{project.objective || project.description}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {project.tasks?.length ?? 0} task{(project.tasks?.length ?? 0) === 1 ? '' : 's'} · due {project.dueAt ? formatDate(project.dueAt) : 'not set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                      project.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700',
                    )}>
                      {project.status.replaceAll('_', ' ')}
                    </span>
                    {project.status !== 'COMPLETED' && project.status !== 'CANCELLED' && (
                      <button
                        onClick={() => setClosingProject(project)}
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50"
                      >
                        Close project
                      </button>
                    )}
                  </div>
                </div>
                {project.followUpRequired && project.followUpNotes && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                    <strong>Follow-up:</strong> {project.followUpNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-brand-blue" /> Find an affiliate
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Search agents, account managers and consultants by postcode or skill. Distances are
            estimated from your business postcode{distanceFrom ? ` (${distanceFrom})` : ''}.
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={affiliateSkill}
              onChange={(e) => setAffiliateSkill(e.target.value)}
              placeholder="Skill e.g. design, marketing"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={affiliatePostcode}
              onChange={(e) => setAffiliatePostcode(e.target.value)}
              placeholder="Postcode e.g. M1"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
          <select
            value={affiliateRole}
            onChange={(e) => setAffiliateRole(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold"
          >
            <option value="">All roles</option>
            <option value="ACCOUNT_MANAGER">Account managers</option>
            <option value="AGENT">Agents</option>
            <option value="CONSULTANT">Consultants</option>
          </select>
        </div>

        {!distanceFrom && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-800 flex items-start justify-between gap-3">
            <span>
              Add a postcode to your business profile so we can show how far each affiliate is from you.
            </span>
            <button
              onClick={() => navigate('/dashboard/business-profile')}
              className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-700"
            >
              Add postcode
            </button>
          </div>
        )}

        {affiliateSearching ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
          </div>
        ) : affiliateResults.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-6 text-center text-xs font-semibold text-gray-500">
            No affiliates matched that postcode or skill.
          </div>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {affiliateResults.map((affiliate: any) => (
              <div key={affiliate.userId} className="rounded-2xl border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-gray-900 truncate">{affiliate.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-blue">
                      {affiliate.role.replace('_', ' ')}
                    </p>
                  </div>
                  <span
                    title={
                      affiliate.distance?.reason === 'AFFILIATE_POSTCODE_MISSING'
                        ? 'This affiliate has not added a postcode yet'
                        : affiliate.distance?.reason === 'BUSINESS_POSTCODE_MISSING'
                          ? 'Add your business postcode to see distances'
                          : undefined
                    }
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black',
                      affiliate.distance?.km != null
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {affiliate.distance?.km != null
                      ? affiliate.distance.label
                      : affiliate.distance?.reason === 'BUSINESS_POSTCODE_MISSING'
                        ? 'Add your postcode'
                        : affiliate.distance?.reason === 'AFFILIATE_POSTCODE_MISSING'
                          ? 'Location not shared'
                          : 'Distance unavailable'}
                  </span>
                </div>

                <p className="mt-1 text-[11px] text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {affiliate.postcode || 'Postcode not set'}
                  <span className="mx-1">·</span>
                  {affiliate.proximity?.matchedLevel?.replace('_', ' ')}
                </p>

                {affiliate.skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {affiliate.skills.slice(0, 4).map((skill: string) => (
                      <span key={skill} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                        {skill}
                      </span>
                    ))}
                    {affiliate.skills.length > 4 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                        +{affiliate.skills.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-1">
                    <Trophy className="w-3 h-3" /> {affiliate.reputationScore} rep
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1">
                    <Award className="w-3 h-3" /> {affiliate.completedTasksCount} done
                  </span>
                </div>

                <button
                  onClick={() =>
                    navigate(
                      `/dashboard/tasks/new?assignee=${encodeURIComponent(affiliate.userId)}`,
                    )
                  }
                  className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-dark"
                >
                  <Send className="w-3.5 h-3.5" /> Assign a task
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {manager ? (
        <div className="rounded-2xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-sm">
          <span className="font-bold text-gray-900">Your account manager:</span>{' '}
          <span className="text-gray-600">{manager.name}</span>
          <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-brand-blue">
            {manager.matchedLevel?.replace('_', ' ') || 'national'}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No account manager yet — tasks you create will be routed by an admin to an available agent or consultant.
        </div>
      )}

      {programmeTasks.length > 0 && (
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-blue" /> Push a programme task
          </h2>
          <p className="text-xs text-gray-500 font-medium mb-3">
            Delegate one of your activity-programme tasks to your account manager.
          </p>
          <div className="space-y-2">
            {programmeTasks
              .filter((t) => t.status !== 'COMPLETED')
              .slice(0, 5)
              .map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900">{task.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{task.description}</p>
                  </div>
                  {task.delegation ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-700">
                      <Send className="w-3.5 h-3.5" />
                      Delegated{task.delegation.assigneeName ? ` · ${task.delegation.assigneeName}` : ''}
                    </span>
                  ) : (
                    <button
                      onClick={() => pushProgrammeTask(task)}
                      disabled={createTask.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/30 px-3 py-1.5 text-[11px] font-bold text-brand-blue hover:bg-brand-blue/5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Delegate
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowRequest(false)}>
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900">New service request</h3>
              <button onClick={() => setShowRequest(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-[11px] font-semibold text-gray-500">
              Tell us the outcome you want. Your account manager will confirm the details and plan the work.
            </p>
            <input
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              placeholder="e.g. Promote my new product collection"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            />
            <textarea
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              rows={3}
              placeholder="What do you need help with?"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            />
            <textarea
              value={requestOutcome}
              onChange={(e) => setRequestOutcome(e.target.value)}
              rows={2}
              placeholder="What does success look like?"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            />
            <select
              value={requestUrgency}
              onChange={(e) => setRequestUrgency(e.target.value as any)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold"
            >
              <option value="LOW">Low urgency</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowRequest(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submitServiceRequest}
                disabled={createServiceRequest.isPending || !requestTitle.trim() || !requestDescription.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {createServiceRequest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit request
              </button>
            </div>
          </div>
        </div>
      )}

      {reassignFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setReassignFor(null)}>
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900">Reassign “{reassignFor.title}”</h3>
              <button onClick={() => setReassignFor(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {reassignFor.declineReason && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-800">
                <span className="font-black">Decline reason:</span> {reassignFor.declineReason}
              </p>
            )}
            <label className="block text-[11px] font-bold text-gray-700">
              Send this task to
              <select
                value={reassignAffiliateId}
                onChange={(e) => setReassignAffiliateId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold"
              >
                <option value="">
                  {affiliateSearching ? 'Loading affiliates…' : 'Select an affiliate'}
                </option>
                {affiliateResults
                  .filter((affiliate: any) => affiliate.userId !== reassignFor.assigneeId)
                  .map((affiliate: any) => (
                    <option key={affiliate.userId} value={affiliate.userId}>
                      {affiliate.name} — {String(affiliate.role).replace('_', ' ').toLowerCase()}
                      {affiliate.postcode ? ` · ${affiliate.postcode}` : ''}
                    </option>
                  ))}
              </select>
            </label>
            <p className="text-[11px] font-medium leading-5 text-gray-500">
              Compensation and charge terms stay the same. The new affiliate can see the decline reason and
              must accept before work begins.
            </p>
            {reassignError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800">
                {reassignError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReassignFor(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!reassignAffiliateId) {
                    setReassignError('Select an affiliate to reassign this task to.');
                    return;
                  }
                  setReassignError(null);
                  try {
                    await reassignTask.mutateAsync({
                      id: reassignFor.id,
                      data: {
                        assigneeUserId: reassignAffiliateId,
                        note: 'Reassigned by the business after an affiliate decline',
                      },
                    });
                    setReassignFor(null);
                  } catch (error: any) {
                    setReassignError(
                      error?.response?.data?.message ||
                        error?.message ||
                        'Could not reassign the task. Please try again.',
                    );
                  }
                }}
                disabled={!reassignAffiliateId || reassignTask.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {reassignTask.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Reassign task
              </button>
            </div>
          </div>
        </div>
      )}

      {closingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setClosingProject(null)}>
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900">Close “{closingProject.title}”</h3>
              <button onClick={() => setClosingProject(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-[11px] font-semibold text-gray-500">
              Record the outcome and any outstanding follow-up. The project history stays attached to the business.
            </p>
            <textarea
              value={projectOutcome}
              onChange={(e) => setProjectOutcome(e.target.value)}
              rows={3}
              placeholder="What was delivered and confirmed by the business?"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            />
            <textarea
              value={projectFollowUp}
              onChange={(e) => setProjectFollowUp(e.target.value)}
              rows={2}
              placeholder="Any follow-up work? (optional)"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setClosingProject(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submitProjectClose}
                disabled={closeProject.isPending || !projectOutcome.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {closeProject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Close project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
