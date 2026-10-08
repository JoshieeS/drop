'use client';
import { useEffect, useRef, useState } from 'react';
import { formatBytes } from '@/lib/format';

type Props = { value: number; total: number; width?: number };

export function AsciiProgress({ value, total, width = 20 }: Props) {
  const frac = total > 0 ? Math.min(value / total, 1) : 0;
  const filled = Math.round(frac * width);

  // Speed, sampled about once a second so the number doesn't jitter.
  const [rate, setRate] = useState(0);
  const prev = useRef({ v: 0, t: 0 });
  useEffect(() => {
    const now = performance.now();
    if (!prev.current.t) {
      prev.current = { v: value, t: now };
      return;
    }
    const dt = (now - prev.current.t) / 1000;
    if (dt >= 1) {
      setRate((value - prev.current.v) / dt);
      prev.current = { v: value, t: now };
    }
  }, [value]);

  const eta = rate > 0 && frac < 1 ? Math.ceil((total - value) / rate) : null;

  return (
    <div className="text-xs">
      <span className="text-dim">[</span>
      <span className="text-accent">{'█'.repeat(filled)}</span>
      <span className="text-line">{'░'.repeat(width - filled)}</span>
      <span className="text-dim">]</span>
      {` ${Math.floor(frac * 100)}%`}
      <span className="text-dim">
        {`  ${formatBytes(value)} / ${formatBytes(total)}`}
        {rate > 0 && frac < 1 ? `  ${formatBytes(rate)}/s` : ''}
        {eta !== null ? `  ~${eta}s` : ''}
      </span>
    </div>
  );
}