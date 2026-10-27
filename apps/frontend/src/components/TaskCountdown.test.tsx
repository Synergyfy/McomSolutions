import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import TaskCountdown from './TaskCountdown';

describe('TaskCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the remaining days, hours, minutes and seconds', () => {
    render(<TaskCountdown deadlineAt="2026-01-03T04:05:06.000Z" />);

    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
    expect(screen.getByText('05')).toBeInTheDocument();
    expect(screen.getByText('06')).toBeInTheDocument();
    expect(screen.getByText('d')).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
    expect(screen.getByText('s')).toBeInTheDocument();
  });

  it('ticks down every second', () => {
    render(<TaskCountdown deadlineAt="2026-01-01T00:00:10.000Z" />);
    expect(screen.getByText('10')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('09')).toBeInTheDocument();
  });

  it('shows "Deadline passed" once the deadline is in the past', () => {
    render(<TaskCountdown deadlineAt="2025-12-31T23:59:00.000Z" />);
    expect(screen.getByText('Deadline passed')).toBeInTheDocument();
  });

  it('freezes instead of counting past zero', () => {
    render(<TaskCountdown deadlineAt="2026-01-01T00:00:02.000Z" />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Deadline passed')).toBeInTheDocument();
  });

  it('uses a single shared interval for many countdowns', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(
      <div>
        <TaskCountdown deadlineAt="2026-01-02T00:00:00.000Z" />
        <TaskCountdown deadlineAt="2026-01-03T00:00:00.000Z" />
        <TaskCountdown deadlineAt="2026-01-04T00:00:00.000Z" />
      </div>
    );

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });

  it('renders nothing without a deadline', () => {
    const { container } = render(<TaskCountdown deadlineAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
