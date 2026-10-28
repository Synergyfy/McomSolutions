import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle, ArrowLeft, Building2, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, Clock, Gift, Loader2, Search, Target, UserCircle, Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProgrammeUsersProgress, useProgrammeUserTasks } from '../../services/admin/hooks';

type RoleFilter = 'ALL' | 'BUSINESS' | 'CUSTOMER';
type TaskState = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';

interface ProgrammeUserRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'BUSINESS' | 'CUSTOMER' | string;
  logoUrl?: string | null;
  category?: string | null;
  membership?: string;
  joinedAt?: string;
  totalTasks: number;
  completed: number;
  expired: number;
  inProgress: number;
  pending: number;
  outstanding: number;
  progress: number;
}

interface ProgrammeUserTask {
  id: string;
  taskId: string;
  title: string;
  description?: string | null;
  featureKey?: string | null;
  externalAppName?: string | null;
  submissionType?: string | null;
  status: TaskState;
  assignedAt?: string;
  deadlineAt?: string;
  daysRemaining?: number;
  completedAt?: string | null;
  rewardPoints?: number;
  rewardGranted?: boolean;
  rewardCouponEnabled?: boolean;
  rewardCouponCode?: string | null;
}

const PAGE_SIZE = 20;

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const deadlineMs = (task: ProgrammeUserTask) => {
  const ms = task.deadlineAt ? new Date(task.deadlineAt).getTime() : NaN;
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

function RoleBadge({ role }: { role: string }) {
  const isBusiness = role === 'BUSINESS';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        isBusiness ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600',
      )}
    >
      {isBusiness ? <Building2 className="w-3 h-3" /> : <UserCircle className="w-3 h-3" />}
      {isBusiness ? 'Business' : 'Customer'}
    </span>
  );
}

function TaskStateBadge({ status }: { status: TaskState }) {
  const map: Record<TaskState, { label: string; className: string }> = {
    PENDING: { label: 'To do', className: 'bg-orange-50 text-orange-600 border-orange-100' },
    IN_PROGRESS: { label: 'In progress', className: 'bg-blue-50 text-blue-600 border-blue-100' },
    COMPLETED: { label: 'Done', className: 'bg-green-50 text-green-600 border-green-100' },
    EXPIRED: { label: 'Expired', className: 'bg-red-50 text-red-600 border-red-100' },
  };
  const tone = map[status] ?? map.PENDING;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', tone.className)}>
      {tone.label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={cn('h-full rounded-full', value >= 100 ? 'bg-green-500' : 'bg-brand-blue')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('mt-1 text-xl font-black', tone)}>{value}</p>
    </div>
  );
}

function AdminTaskRow({ task }: { key?: React.Key; task: ProgrammeUserTask }) {
  const isDone = task.status === 'COMPLETED';
  const isExpired = task.status === 'EXPIRED';
  const isInProgress = task.status === 'IN_PROGRESS';

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-4',
        isDone ? 'border-green-100 bg-green-50/40' : isExpired ? 'border-red-100 bg-red-50/40' : 'border-gray-100 bg-gray-50',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            isDone ? 'bg-green-500 text-white' : isExpired ? 'bg-red-400 text-white' : isInProgress ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white',
          )}
        >
          {isDone ? <CheckCircle2 className="h-4 w-4" /> : isExpired ? <AlertCircle className="h-4 w-4" /> : isInProgress ? <Clock className="h-4 w-4" /> : <Target className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight text-gray-900 break-words">{task.title}</p>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-500">{task.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isDone ? `Completed ${fmtDate(task.completedAt)}` : `Due ${fmtDate(task.deadlineAt)}`}
            </span>
            {!isDone && !isExpired && typeof task.daysRemaining === 'number' && (
              <span className="font-bold text-gray-600">{task.daysRemaining}d left</span>
            )}
            {typeof task.rewardPoints === 'number' && task.rewardPoints > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                <Target className="h-3 w-3" /> {task.rewardPoints} pts
              </span>
            )}
            {task.rewardCouponCode && (
              <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700">
                <Gift className="h-3 w-3" /> {task.rewardCouponCode}
              </span>
            )}
            {task.externalAppName && <span className="font-bold text-sky-600">{task.externalAppName}</span>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        <TaskStateBadge status={task.status} />
        {task.rewardGranted && isDone && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Rewarded</span>
        )}
      </div>
    </div>
  );
}

function CollapsibleTaskSection({
  title,
  hint,
  count,
  tone,
  icon: Icon,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  tone: 'expired' | 'completed';
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors sm:px-4',
          tone === 'expired' ? 'border-red-100 bg-red-50/60 hover:bg-red-50' : 'border-green-100 bg-green-50/60 hover:bg-green-50',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', tone === 'expired' ? 'text-red-500' : 'text-green-500')} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight text-gray-900">{title}</span>
          <span className="block text-[11px] leading-tight text-gray-500">{hint}</span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
            tone === 'expired' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
          )}
        >
          {count}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function UserProgressDetail({ userId, name, onBack }: { userId: string; name?: string; onBack: () => void }) {
  const { data, isLoading } = useProgrammeUserTasks(userId);
  const user = data?.user as ProgrammeUserRow | undefined;
  const summary = data?.summary as
    | { total: number; completed: number; expired: number; inProgress: number; pending: number; outstanding: number; progress: number }
    | undefined;
  const tasks: ProgrammeUserTask[] = (data?.data as ProgrammeUserTask[]) ?? [];

  const groups = useMemo(() => {
    const todo = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    const expired = tasks.filter((t) => t.status === 'EXPIRED');
    const completed = tasks.filter((t) => t.status === 'COMPLETED');
    todo.sort((a, b) => deadlineMs(a) - deadlineMs(b));
    expired.sort((a, b) => deadlineMs(b) - deadlineMs(a));
    completed.sort((a, b) => {
      const am = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bm = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bm - am;
    });
    return { todo, expired, completed };
  }, [tasks]);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to all users
      </button>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  {user?.logoUrl ? (
                    <img src={user.logoUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : user?.role === 'BUSINESS' ? (
                    <Building2 className="h-5 w-5 text-gray-400" />
                  ) : (
                    <UserCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900">{user?.name || name || 'Programme participant'}</p>
                  <p className="truncate text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user?.role && <RoleBadge role={user.role} />}
                {user?.membership && (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">{user.membership}</span>
                )}
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-600">Programme progress</span>
                <span className="font-bold text-brand-blue">{summary?.progress ?? 0}%</span>
              </div>
              <ProgressBar value={summary?.progress ?? 0} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="To do" value={summary?.outstanding ?? 0} tone="text-orange-600" />
            <SummaryTile label="Completed" value={summary?.completed ?? 0} tone="text-green-600" />
            <SummaryTile label="Expired" value={summary?.expired ?? 0} tone="text-red-600" />
            <SummaryTile label="Total tasks" value={summary?.total ?? 0} tone="text-gray-900" />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Programme tasks</h3>
              <span className="text-[11px] font-semibold text-gray-400">{groups.todo.length} outstanding</span>
            </div>

            {tasks.length === 0 ? (
              <div className="rounded-xl bg-gray-50 py-10 text-center text-xs text-gray-400">
                No programme tasks have been assigned to this user yet.
              </div>
            ) : (
              <>
                {groups.todo.length === 0 ? (
                  <div className="rounded-xl border border-green-100 bg-green-50/60 py-6 text-center">
                    <CheckCircle2 className="mx-auto mb-1.5 h-5 w-5 text-green-500" />
                    <p className="text-xs font-semibold text-green-700">Nothing outstanding — every task is closed out.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groups.todo.map((task) => (
                      <AdminTaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}

                {groups.expired.length > 0 && (
                  <CollapsibleTaskSection
                    title="Expired tasks"
                    hint="Deadline passed before completion"
                    count={groups.expired.length}
                    tone="expired"
                    icon={AlertCircle}
                  >
                    {groups.expired.map((task) => (
                      <AdminTaskRow key={task.id} task={task} />
                    ))}
                  </CollapsibleTaskSection>
                )}

                {groups.completed.length > 0 && (
                  <CollapsibleTaskSection
                    title="Completed tasks"
                    hint="Finished tasks and claimed rewards"
                    count={groups.completed.length}
                    tone="completed"
                    icon={CheckCircle2}
                  >
                    {groups.completed.map((task) => (
                      <AdminTaskRow key={task.id} task={task} />
                    ))}
                  </CollapsibleTaskSection>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProgrammeProgressPanel() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  const { data: listRes, isLoading } = useProgrammeUsersProgress({
    search: search.trim() || undefined,
    role,
    page,
    limit: PAGE_SIZE,
  });

  const users: ProgrammeUserRow[] = (listRes?.data as ProgrammeUserRow[]) ?? [];
  const summary = listRes?.summary as
    | { users: number; completed: number; expired: number; inProgress: number; pending: number; overdue: number; outstanding: number }
    | undefined;
  const totalPages = listRes?.totalPages ?? 1;

  if (selectedUser) {
    return <UserProgressDetail userId={selectedUser.id} name={selectedUser.name} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Users on programme" value={summary?.users ?? 0} tone="text-gray-900" />
        <SummaryTile label="Tasks completed" value={summary?.completed ?? 0} tone="text-green-600" />
        <SummaryTile label="Overdue / expired" value={summary?.expired ?? 0} tone="text-red-600" />
        <SummaryTile label="Still to do" value={summary?.outstanding ?? 0} tone="text-orange-600" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
          {(['ALL', 'BUSINESS', 'CUSTOMER'] as RoleFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setRole(option);
                setPage(1);
              }}
              className={cn(
                'rounded-xl px-3 py-2 text-xs font-bold transition-all',
                role === option ? 'bg-brand-blue text-white shadow-glow' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {option === 'ALL' ? 'All users' : option === 'BUSINESS' ? 'Businesses' : 'Customers'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search business, customer or email..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 sm:w-72"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="hidden grid-cols-[2fr_1fr_1fr_1.2fr_auto] gap-4 border-b border-gray-100 px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-gray-400 md:grid">
          <span>User</span>
          <span>Type</span>
          <span>Tasks</span>
          <span>Progress</span>
          <span className="text-right">Open</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">No users found</p>
            <p className="text-xs text-gray-400">Try a different search or user type.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((user) => (
              <motion.button
                key={user.id}
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedUser({ id: user.userId || user.id, name: user.name })}
                className="grid w-full grid-cols-1 items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 sm:px-5 md:grid-cols-[2fr_1fr_1fr_1.2fr_auto] md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                    {user.logoUrl ? (
                      <img src={user.logoUrl} alt={user.name} className="h-full w-full object-cover" />
                    ) : user.role === 'BUSINESS' ? (
                      <Building2 className="h-4 w-4 text-gray-400" />
                    ) : (
                      <UserCircle className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{user.name}</p>
                    <p className="truncate text-[11px] text-gray-500">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:block">
                  <RoleBadge role={user.role} />
                  <span className="text-[11px] text-gray-400 md:hidden">{user.membership}</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold">
                  <span className="text-green-600">{user.completed} done</span>
                  {user.outstanding > 0 && <span className="text-orange-600">· {user.outstanding} to do</span>}
                  {user.expired > 0 && <span className="text-red-600">· {user.expired} expired</span>}
                </div>

                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-gray-400">
                    <span>{user.progress}%</span>
                    <span>{user.completed}/{user.totalTasks}</span>
                  </div>
                  <ProgressBar value={user.progress} />
                </div>

                <div className="flex items-center justify-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue/10 px-2.5 py-1 text-[11px] font-bold text-brand-blue">
                    View <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-xs font-semibold text-gray-500 shadow-sm">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
