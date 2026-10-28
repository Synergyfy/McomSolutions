import { describe, expect, it } from 'vitest';
import { groupProgrammeTasks } from './programmeTaskGroups';

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();
const day = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(NOW + days * day).toISOString();

const apiTask = (id: string, status: string, deadlineDays?: number) => ({
  id,
  status,
  deadlineAt: deadlineDays === undefined ? null : inDays(deadlineDays),
});

describe('groupProgrammeTasks', () => {
  it('orders outstanding tasks by soonest deadline and separates the rest', () => {
    const { active, expired, completed } = groupProgrammeTasks({
      useApiStatus: true,
      now: NOW,
      tasks: [
        apiTask('later', 'PENDING', 10),
        apiTask('done', 'COMPLETED', 5),
        apiTask('soon', 'PENDING', 2),
        apiTask('gone', 'EXPIRED', -1),
        apiTask('in-progress', 'IN_PROGRESS', 6),
      ],
    });

    expect(active.map((t) => t.id)).toEqual(['soon', 'in-progress', 'later']);
    expect(expired.map((t) => t.id)).toEqual(['gone']);
    expect(completed.map((t) => t.id)).toEqual(['done']);
  });

  it('treats open tasks past their deadline as expired before the nightly sweep', () => {
    const { active, expired } = groupProgrammeTasks({
      useApiStatus: true,
      now: NOW,
      tasks: [apiTask('overdue', 'PENDING', -2), apiTask('open', 'PENDING', 3)],
    });

    expect(expired.map((t) => t.id)).toEqual(['overdue']);
    expect(expired[0].status).toBe('expired');
    expect(active.map((t) => t.id)).toEqual(['open']);
  });

  it('sorts most recently expired first and most recently completed first', () => {
    const { expired, completed } = groupProgrammeTasks({
      useApiStatus: true,
      now: NOW,
      tasks: [
        apiTask('expired-long-ago', 'EXPIRED', -20),
        apiTask('expired-yesterday', 'EXPIRED', -1),
        { id: 'completed-old', status: 'COMPLETED', completedAt: new Date(NOW - 10 * day).toISOString() },
        { id: 'completed-new', status: 'COMPLETED', completedAt: new Date(NOW - day).toISOString() },
      ],
    });

    expect(expired.map((t) => t.id)).toEqual(['expired-yesterday', 'expired-long-ago']);
    expect(completed.map((t) => t.id)).toEqual(['completed-new', 'completed-old']);
  });

  it('falls back to local statuses and completed mission ids for static missions', () => {
    const { active, completed } = groupProgrammeTasks({
      useApiStatus: false,
      now: NOW,
      completedMissionIds: ['mission-done'],
      localStatuses: { 'mission-progress': 'in_progress' },
      tasks: [
        { id: 'mission-done' },
        { id: 'mission-progress' },
        { id: 'mission-new' },
      ],
    });

    expect(completed.map((t) => t.id)).toEqual(['mission-done']);
    expect(active.map((t) => t.id)).toEqual(['mission-progress', 'mission-new']);
    expect(active[0].status).toBe('in_progress');
    expect(active[1].status).toBe('not_started');
  });

  it('keeps tasks without a deadline at the end of the outstanding list', () => {
    const { active } = groupProgrammeTasks({
      useApiStatus: true,
      now: NOW,
      tasks: [
        { id: 'no-deadline', status: 'PENDING' },
        apiTask('dated', 'PENDING', 4),
      ],
    });

    expect(active.map((t) => t.id)).toEqual(['dated', 'no-deadline']);
  });
});
