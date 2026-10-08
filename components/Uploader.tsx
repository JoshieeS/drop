'use client';
import { useEffect, useRef, useState } from 'react';
import type { DataConnection, Peer } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import { Dropzone } from './DropZone';
import { FileList } from './FileList';
import { Terminal, useLog } from '@/lib/Terminal';
import { AsciiProgress } from './AsciiProgress';
import { formatBytes, isMedia } from '@/lib/format';
import { ICE_SERVERS } from '@/lib/ice';
import { makeSlug } from '@/lib/slug';
import { traceConnection } from '@/lib/diagnostics';
import { parseMsg, sendMsg } from '@/lib/protocol';
import { sendFiles } from '@/lib/send';
import { useWakeLock } from '@/lib/usewakeLock';
import { useVisibilityLog } from '@/lib/useVisibilityLog';

const keyOf = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

type Phase = 'idle' | 'starting' | 'hosting';
type PeerInfo = {
  state: 'connecting' | 'connected' | 'sending' | 'done' | 'closed';
  sent: number;
  total: number;
};
const blank: PeerInfo = { state: 'connecting', sent: 0, total: 0 };

export function Uploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [link, setLink] = useState('');
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
  const [copied, setCopied] = useState(false);
  const { lines, log } = useLog();

  const peerRef = useRef<Peer | null>(null);
  const filesRef = useRef<File[]>([]);

  const update = (id: string, patch: Partial<PeerInfo>) =>
    setPeers((prev) => {
      const next = { ...prev };
      next[id] = { ...(prev[id] ?? blank), ...patch };
      return next;
    });

  // ---------- file selection ----------
  function add(incoming: File[]) {
    const media = incoming.filter(isMedia);
    setFiles((prev) => {
      const seen = new Set(prev.map(keyOf));
      return [...prev, ...media.filter((f) => !seen.has(keyOf(f)))];
    });
  }
  const remove = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  // ---------- hosting ----------
  async function start() {
    filesRef.current = files;
    setPhase('starting');
    log('requesting peer id…');

    const mod = await import('peerjs');

    const open = (attempt = 0) => {
      const peer = new mod.Peer(makeSlug(), { config: { iceServers: ICE_SERVERS } });

      peer.on('open', (id) => {
        peerRef.current = peer;
        setLink(`${window.location.origin}/d/${id}`);
        setPhase('hosting');
        log(`listening as ${id}`, 'ok');
      });

      peer.on('connection', serve);

      peer.on('disconnected', () => {
        if (peer.destroyed) return;
        log('signaling server lost, reconnecting…', 'warn');
        peer.reconnect();
      });

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && attempt < 3) {
          log('id taken, retrying…', 'warn');
          peer.destroy();
          open(attempt + 1);
          return;
        }
        log(`error: ${err.type}`, 'err');
      });
    };
    open();
  }

  function serve(conn: DataConnection) {
    const id = conn.connectionId;
    const who = `peer ${conn.peer.slice(0, 8)}`;
    let busy = false;

    update(id, { state: 'connecting' });
    log(`${who} connecting…`);
    traceConnection(conn, log);

    conn.on('open', () => {
      const dc = conn.dataChannel;
      dc.binaryType = 'arraybuffer';
      update(id, { state: 'connected' });
      const list = filesRef.current;
      sendMsg(dc, {
        kind: 'manifest',
        files: list.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      });
      log(`manifest sent to ${who} (${list.length} files)`, 'ok');
    });

    conn.on('data', async (raw) => {
      const msg = parseMsg(raw);
      if (msg?.kind !== 'start' || busy) return;
      busy = true;

      const list = filesRef.current;
      const total = list.reduce((s, f) => s + f.size, 0);
      update(id, { state: 'sending', sent: 0, total });
      log(`sending ${formatBytes(total)} to ${who}…`);

      const t0 = performance.now();
      let lastUi = 0;
      try {
        await sendFiles(conn.dataChannel, list, (sent) => {
          const now = performance.now();
          if (now - lastUi > 150) {   // re-render at most ~7×/s
            lastUi = now;
            update(id, { sent });
          }
        });
        const secs = Math.max((performance.now() - t0) / 1000, 0.001);
        update(id, { state: 'done', sent: total });
        log(`sent to ${who} in ${secs.toFixed(1)}s · avg ${formatBytes(total / secs)}/s`, 'ok');
      } catch (err) {
        update(id, { state: 'closed' });
        log(`transfer to ${who} aborted: ${(err as Error).message}`, 'err');
      }
    });

    conn.on('close', () => {
      setPeers((prev) => {
        const p = prev[id];
        if (!p || p.state === 'done') return prev;   // keep finished peers marked done
        const next = { ...prev };
        next[id] = { ...p, state: 'closed' };
        return next;
      });
      log(`${who} disconnected`, 'warn');
    });

    conn.on('error', (err) => log(`connection error: ${err.type}`, 'err'));
  }

  function stop() {
    peerRef.current?.destroy();
    peerRef.current = null;
    setPhase('idle');
    setLink('');
    setPeers({});
    log('sharing stopped', 'warn');
  }

  useEffect(() => () => peerRef.current?.destroy(), []);

  useEffect(() => {
    if (phase !== 'hosting') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  useWakeLock(phase === 'hosting', log);
  useVisibilityLog(phase === 'hosting', log);

  // ---------- render ----------
  if (files.length === 0 && phase === 'idle') {
    return (
      <div className="space-y-4">
        <Dropzone onFiles={add} />
        {lines.length > 0 && <Terminal lines={lines} />}
      </div>
    );
  }

  const entries = Object.entries(peers);
  const active = entries.filter((e) => e[1].state !== 'closed').length;

  return (
    <div className="space-y-4">
      <FileList files={files} onRemove={phase === 'idle' ? remove : undefined} />

      {phase === 'idle' && (
        <>
          <Dropzone onFiles={add} compact />
          <div className="flex gap-3">
            <button
              onClick={start}
              className="flex-1 border border-accent px-4 py-2 text-accent transition-colors hover:bg-accent hover:text-bg"
            >
              start sharing →
            </button>
            <button
              onClick={() => setFiles([])}
              className="border border-line px-4 py-2 text-dim hover:border-dim hover:text-fg"
            >
              clear
            </button>
          </div>
        </>
      )}

      {phase === 'starting' && <div className="cursor text-dim">opening channel</div>}

      {phase === 'hosting' && (
        <div className="space-y-4 rounded border border-line bg-panel p-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <QRCodeSVG value={link} size={148} bgColor="#c8d3cc" fgColor="#0a0c0b" marginSize={2} />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="text-xs text-dim">scan or open on the other device</div>
              <div className="break-all text-accent">{link}</div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="border border-line px-3 py-1 text-xs hover:border-dim"
                >
                  {copied ? 'copied ✓' : 'copy link'}
                </button>
                <button
                  onClick={stop}
                  className="border border-line px-3 py-1 text-xs text-dim hover:border-err hover:text-err"
                >
                  stop sharing
                </button>
              </div>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="space-y-3 border-t border-line pt-3">
              {entries.map((e) => (
                <div key={e[0]} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-dim">peer {e[0].slice(-6)}</span>
                    <span className={e[1].state === 'done' ? 'text-accent' : e[1].state === 'closed' ? 'text-err' : ''}>
                      {e[1].state}
                    </span>
                  </div>
                  {e[1].total > 0 && <AsciiProgress value={e[1].sent} total={e[1].total} />}
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-dim">
            {active} peer{active === 1 ? '' : 's'} active · keep this tab open
          </div>
        </div>
      )}

      {lines.length > 0 && <Terminal lines={lines} />}
    </div>
  );
}