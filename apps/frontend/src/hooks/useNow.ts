import { useEffect, useState } from 'react';

type TickListener = (now: number) => void;

/**
 * One shared 1s ticker for the whole app. Every subscriber gets the same
 * `Date.now()` value, so N countdowns still only cost a single interval and
 * each one re-renders only its own subtree (the parent page never re-renders).
 */
const listeners = new Set<TickListener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function notify() {
  const now = Date.now();
  listeners.forEach((listener) => listener(now));
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    // Nobody can see the countdowns — stop burning CPU.
    pause();
  } else {
    notify();
    resume();
  }
}

function pause() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

function resume() {
  if (intervalId !== null || listeners.size === 0) return;
  intervalId = setInterval(notify, 1000);
}

function start() {
  if (intervalId !== null) return;
  if (typeof document !== 'undefined' && !document.hidden) {
    intervalId = setInterval(notify, 1000);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
}

function stop() {
  pause();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
}

/**
 * Returns the current timestamp, refreshed once per second.
 *
 * @param active  When false the hook unsubscribes from the ticker entirely.
 * @param stopAt  Optional epoch ms. Once reached the value freezes there and
 *                the component stops re-rendering (React bails on equal state).
 */
export function useNow(active = true, stopAt?: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const listener: TickListener = (value) => {
      setNow(stopAt != null && value >= stopAt ? stopAt : value);
    };

    listeners.add(listener);
    start();
    listener(Date.now());

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stop();
    };
  }, [active, stopAt]);

  return now;
}
