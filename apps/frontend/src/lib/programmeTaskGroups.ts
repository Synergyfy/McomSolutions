export type ProgrammeTaskState = 'not_started' | 'in_progress' | 'completed' | 'expired';

export interface ProgrammeTaskLike {
  id: string;
  /** Backend assignment status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `EXPIRED`). */
  status?: string | null;
  deadlineAt?: string | Date | null;
  completedAt?: string | Date | null;
}

export interface GroupProgrammeTasksInput<T extends ProgrammeTaskLike> {
  tasks?: T[] | null;
  /** When true, each task's own status (from `/programme/my-tasks`) is authoritative. */
  useApiStatus: boolean;
  /** Mission ids already completed on the stored programme record. */
  completedMissionIds?: string[] | null;
  /** Locally tracked statuses used for static (non-API) missions. */
  localStatuses?: Record<string, string> | null;
  /** Injectable clock (ms) so ordering is deterministic in tests. */
  now?: number;
}

export interface ProgrammeTaskGroups<T> {
  /** Tasks that still need attention, soonest deadline first. */
  active: T[];
  /** Tasks whose deadline passed, most recently expired first. */
  expired: T[];
  /** Finished tasks, most recently completed first. */
  completed: T[];
}

const toMs = (value?: string | Date | null): number | null => {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const deadlineMs = (task: ProgrammeTaskLike): number =>
  toMs(task.deadlineAt) ?? Number.POSITIVE_INFINITY;

const completedMs = (task: ProgrammeTaskLike): number => toMs(task.completedAt) ?? 0;

function resolveState<T extends ProgrammeTaskLike>(
  task: T,
  input: GroupProgrammeTasksInput<T>,
): ProgrammeTaskState {
  if (input.useApiStatus) {
    const status = String(task.status ?? '').toUpperCase();
    if (status === 'COMPLETED') return 'completed';
    if (status === 'EXPIRED') return 'expired';
    if (status === 'IN_PROGRESS') return 'in_progress';
    return 'not_started';
  }

  if (input.completedMissionIds?.includes(task.id)) return 'completed';
  const local = input.localStatuses?.[task.id];
  if (local === 'completed' || local === 'in_progress' || local === 'not_started') return local;
  return 'not_started';
}

/**
 * Splits programme tasks into what still needs doing vs. what is already closed
 * out, and orders each bucket so the dashboard surfaces the most urgent work.
 *
 * A task is treated as expired as soon as its deadline passes, even if the
 * backend nightly sweep has not flipped its stored status yet.
 */
export function groupProgrammeTasks<T extends ProgrammeTaskLike>(
  input: GroupProgrammeTasksInput<T>,
): ProgrammeTaskGroups<T & { status: ProgrammeTaskState }> {
  const now = input.now ?? Date.now();
  const active: Array<T & { status: ProgrammeTaskState }> = [];
  const expired: Array<T & { status: ProgrammeTaskState }> = [];
  const completed: Array<T & { status: ProgrammeTaskState }> = [];

  for (const task of input.tasks ?? []) {
    const state = resolveState(task, input);
    const deadline = toMs(task.deadlineAt);
    const isOverdue = deadline !== null && deadline <= now;

    if (state === 'completed') {
      completed.push({ ...task, status: 'completed' });
    } else if (state === 'expired' || isOverdue) {
      expired.push({ ...task, status: 'expired' });
    } else {
      active.push({ ...task, status: state });
    }
  }

  active.sort((a, b) => deadlineMs(a) - deadlineMs(b));
  expired.sort((a, b) => deadlineMs(b) - deadlineMs(a));
  completed.sort((a, b) => completedMs(b) - completedMs(a));

  return { active, expired, completed };
}
