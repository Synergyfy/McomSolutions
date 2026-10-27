import { describe, expect, it } from 'vitest';
import { resolveProgrammeTimeline } from './programmeTimeline';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('resolveProgrammeTimeline', () => {
  it('adds up each task window and starts at the first assignment', () => {
    const timeline = resolveProgrammeTimeline({
      tasks: [
        { deadlineDays: 7, assignedAt: '2026-01-01T00:00:00.000Z' },
        { deadlineDays: 14, assignedAt: '2026-01-01T00:00:00.000Z' },
        { deadlineDays: 7, assignedAt: '2026-01-03T00:00:00.000Z' },
      ],
    });

    expect(timeline.totalDays).toBe(28);
    expect(timeline.startsAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(timeline.endsAt?.getTime()).toBe(
      new Date('2026-01-01T00:00:00.000Z').getTime() + 28 * DAY_MS
    );
  });

  it('falls back to the configured total when tasks carry no windows', () => {
    const timeline = resolveProgrammeTimeline({
      tasks: [{ assignedAt: '2026-01-01T00:00:00.000Z' }],
      configuredTotalDays: 57,
    });

    expect(timeline.totalDays).toBe(57);
    expect(timeline.endsAt?.getTime()).toBe(
      new Date('2026-01-01T00:00:00.000Z').getTime() + 57 * DAY_MS
    );
  });

  it('falls back to 90 days when nothing is configured', () => {
    const timeline = resolveProgrammeTimeline({
      tasks: [],
      startedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(timeline.totalDays).toBe(90);
    expect(timeline.startsAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('anchors on enrolment when no task has been assigned yet', () => {
    const timeline = resolveProgrammeTimeline({
      tasks: [],
      configuredTotalDays: 57,
      startedAt: '2025-12-01T00:00:00.000Z',
    });

    expect(timeline.startsAt?.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(timeline.endsAt?.getTime()).toBe(
      new Date('2025-12-01T00:00:00.000Z').getTime() + 57 * DAY_MS
    );
  });

  it('adds admin extensions on top of the task windows', () => {
    const timeline = resolveProgrammeTimeline({
      tasks: [
        { deadlineDays: 10, assignedAt: '2026-01-01T00:00:00.000Z' },
        { deadlineDays: 10, assignedAt: '2026-01-01T00:00:00.000Z' },
      ],
      extendedDays: 7,
    });

    expect(timeline.totalDays).toBe(20);
    expect(timeline.endsAt?.getTime()).toBe(
      new Date('2026-01-01T00:00:00.000Z').getTime() + 27 * DAY_MS
    );
  });

  it('has no end date without a start date', () => {
    const timeline = resolveProgrammeTimeline({ tasks: [], configuredTotalDays: 30 });

    expect(timeline.totalDays).toBe(30);
    expect(timeline.startsAt).toBeNull();
    expect(timeline.endsAt).toBeNull();
  });
});
