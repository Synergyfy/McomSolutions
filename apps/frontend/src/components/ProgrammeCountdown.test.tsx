import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ProgrammeCountdown from './ProgrammeCountdown';

describe('ProgrammeCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders days, hours, minutes and seconds blocks', () => {
    render(<ProgrammeCountdown endsAt="2026-01-30T12:34:56.000Z" />);

    expect(screen.getByText('29')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('56')).toBeInTheDocument();
    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('Minutes')).toBeInTheDocument();
    expect(screen.getByText('Seconds')).toBeInTheDocument();
  });

  it('ticks down every second', () => {
    render(<ProgrammeCountdown endsAt="2026-01-01T00:00:10.000Z" />);
    expect(screen.getByText('10')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('09')).toBeInTheDocument();
  });

  it('shows a completion state when the programme clock runs out', () => {
    render(<ProgrammeCountdown endsAt="2026-01-01T00:00:02.000Z" />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText('Programme time is up')).toBeInTheDocument();
  });

  it('renders nothing without an end date', () => {
    const { container } = render(<ProgrammeCountdown endsAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
