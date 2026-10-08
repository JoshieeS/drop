'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type Level = 'info' | 'ok' | 'warn' | 'err';
type Line = { t: string; level: Level; msg: string };

export function useLog() {
  const [lines, setLines] = useState<Line[]>([]);
  const log = useCallback((msg: string, level: Level = 'info') => {
    const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLines((prev) => [...prev.slice(-200), { t, level, msg }]);
  }, []);
  return { lines, log };
}

const tone: Record<Level, string> = {
  info: 'text-fg', ok: 'text-accent', warn: 'text-warn', err: 'text-err',
};

export function Terminal({ lines }: { lines: Line[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines]);

  async function copy() {
    const header = `transmit log · ${navigator.userAgent}\n`;
    const text = header + lines.map((l) => `${l.t} [${l.level}] ${l.msg}`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded border border-line bg-panel">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <i className="size-2 rounded-full bg-line" />
        <i className="size-2 rounded-full bg-line" />
        <i className="size-2 rounded-full bg-line" />
        <span className="ml-2 text-xs text-dim">connection log</span>
        <button onClick={copy} className="ml-auto text-xs text-dim hover:text-accent">
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <div ref={box} className="max-h-48 overflow-y-auto p-3 text-xs leading-relaxed">
        {lines.map((l, i) => (
          <div key={i}>
            <span className="text-dim">{l.t} </span>
            <span className={tone[l.level]}>{l.msg}</span>
          </div>
        ))}
        <div className="cursor text-dim">&gt;</div>
      </div>
    </div>
  );
}