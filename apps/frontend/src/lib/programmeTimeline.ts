const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProgrammeTimelineTask {
  /** The admin-configured window for this task (`/admin/programme` → Tasks → "Deadline (days)"). */
  deadlineDays?: number | null;
  /** When the task was handed to the business. */
  assignedAt?: string | Date | null;
}

export interface ProgrammeTimelineInput {
  /** Tasks assigned to this business (`/programme/my-tasks` data). */
  tasks?: ProgrammeTimelineTask[] | null;
  /** `meta.totalProgrammeDays` from `/programme/my-tasks` (sum of all configured task windows). */
  configuredTotalDays?: number | null;
  /** Enrolment date from `/programme/my-programme`. */
  startedAt?: string | Date | null;
  /** Admin-granted extension in days (`extendedBy`). */
  extendedDays?: number | null;
  /** Last-resort programme length when nothing is configured. */
  fallbackDays?: number;
}

export interface ProgrammeTimeline {
  /** Programme length in days = Σ of every task's configured deadline window. */
  totalDays: number;
  /** Clock start: when the first task was assigned (falls back to enrolment). */
  startsAt: Date | null;
  /** Clock end: startsAt + totalDays + extensions. */
  endsAt: Date | null;
}

function toMs(value?: string | Date | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Derives the programme clock from the task-engine configuration.
 *
 * - Each task expires `deadlineDays` after it is assigned (the backend sets
 *   `deadlineAt = assignedAt + deadlineDays`, which drives the per-task
 *   countdown on /dashboard).
 * - The whole programme therefore needs Σ(deadlineDays) days, counted from the
 *   moment the first task was assigned. Admin extensions (`extendedBy`) are
 *   added on top.
 */
export function resolveProgrammeTimeline({
  tasks,
  configuredTotalDays,
  startedAt,
  extendedDays,
  fallbackDays = 90,
}: ProgrammeTimelineInput): ProgrammeTimeline {
  const list = Array.isArray(tasks) ? tasks : [];

  const summedTaskDays = list.reduce((sum, task) => {
    const days = Number(task?.deadlineDays);
    return Number.isFinite(days) && days > 0 ? sum + days : sum;
  }, 0);

  const configured = Number(configuredTotalDays);
  const totalDays =
    summedTaskDays > 0
      ? summedTaskDays
      : Number.isFinite(configured) && configured > 0
        ? configured
        : fallbackDays;

  const earliestAssigned = list.reduce<number | null>((min, task) => {
    const ms = toMs(task?.assignedAt);
    if (ms === null) return min;
    return min === null || ms < min ? ms : min;
  }, null);

  const startMs = earliestAssigned ?? toMs(startedAt);
  const extension = Number(extendedDays) > 0 ? Number(extendedDays) : 0;

  return {
    totalDays,
    startsAt: startMs !== null ? new Date(startMs) : null,
    endsAt: startMs !== null ? new Date(startMs + (totalDays + extension) * DAY_MS) : null,
  };
}
