'use client';
import { useEffect } from 'react';

type Log = (msg: string, level?: 'info' | 'ok' | 'warn' | 'err') => void;

export function useVisibilityLog(active: boolean, log: Log) {
  useEffect(() => {
    if (!active) return;
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = performance.now();
        log('tab hidden · transfer may pause', 'warn');
      } else if (hiddenAt) {
        log(`tab visible again after ${((performance.now() - hiddenAt) / 1000).toFixed(1)}s`);
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [active, log]);
}