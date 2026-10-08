'use client';
import { useEffect } from 'react';

type Log = (msg: string, level?: 'info' | 'ok' | 'warn' | 'err') => void;

export function useWakeLock(active: boolean, log: Log) {
  useEffect(() => {
    if (!active) return;
    if (!('wakeLock' in navigator)) {
      log('wake lock unsupported · keep the screen on manually', 'warn');
      return;
    }

    let lock: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        log('wake lock on · screen will stay awake', 'ok');
      } catch (err) {
        log(`wake lock denied: ${(err as Error).name}`, 'warn');
      }
    };

    // The browser drops the lock whenever the tab is hidden. Take it back on return.
    const onVisible = () => {
      if (!released && document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active, log]);
}