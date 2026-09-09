'use client';
import { useEffect, useRef } from 'react';
import { startVisiblePolling } from '@/lib/visible-poll';
export function useVisiblePoll(task: (signal: AbortSignal) => Promise<unknown>, interval: number, initialDelay = 0) {
  const taskRef = useRef(task);
  taskRef.current = task;
  useEffect(() => startVisiblePolling(signal => taskRef.current(signal), interval, { document, window, navigator }, initialDelay), [interval, initialDelay]);
}
