import { sendMsg } from './protocol';

const READ_BLOCK = 4 * 1024 * 1024; // read 4 MB from disk at a time
const HIGH_WATER = 8 * 1024 * 1024; // stay well under Chrome's ~16 MB queue limit
const LOW_WATER = 2 * 1024 * 1024;  // resume when it drains below 2 MB
const SAFE_CHUNK = 16 * 1024;       // fallback that every browser accepts

export type SendStats = { waitMs: number; totalMs: number; chunk: number };

// Resolves when the queue drains; rejects if the channel closes while we wait.
function drained(dc: RTCDataChannel) {
  return new Promise<void>((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('channel closed')); };
    const cleanup = () => {
      dc.removeEventListener('bufferedamountlow', ok);
      dc.removeEventListener('close', fail);
    };
    dc.addEventListener('bufferedamountlow', ok);
    dc.addEventListener('close', fail);
  });
}

function read(file: File, offset: number): Promise<ArrayBuffer> {
  const p = file.slice(offset, offset + READ_BLOCK).arrayBuffer();
  p.catch(() => {}); // avoid unhandled rejection if we abort before awaiting it
  return p;
}

export async function sendFiles(
  dc: RTCDataChannel,
  files: File[],
  onProgress: (sentBytes: number) => void,
  initialChunk: number,
  log?: (msg: string, level?: 'info' | 'ok' | 'warn' | 'err') => void
): Promise<SendStats> {
  dc.bufferedAmountLowThreshold = LOW_WATER;
  const t0 = performance.now();
  let chunk = initialChunk;
  let waitMs = 0;
  let sent = 0;

  const waitForRoom = async () => {
    const w = performance.now();
    await drained(dc);
    waitMs += performance.now() - w;
  };

  // Send one piece, recovering from "queue full" and "message too large".
  const sendPiece = async (piece: ArrayBuffer): Promise<boolean> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (dc.readyState !== 'open') throw new Error('channel closed');
      if (dc.bufferedAmount + piece.byteLength > HIGH_WATER) await waitForRoom();
      try {
        dc.send(piece);
        return true;
      } catch (err) {
        const e = err as DOMException;
        if (e.name === 'TypeError' && chunk > SAFE_CHUNK) {
          // Message too large for the other browser: shrink and resend this block.
          chunk = SAFE_CHUNK;
          log?.(`chunk rejected as too large · falling back to ${SAFE_CHUNK / 1024} KB`, 'warn');
          return false;
        }
        if (e.name === 'OperationError') {
          // Queue full: wait for it to drain, then retry the same piece.
          await waitForRoom();
          continue;
        }
        throw err;
      }
    }
    throw new Error('send queue stayed full');
  };

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    sendMsg(dc, { kind: 'file-start', index });

    let next = file.size > 0 ? read(file, 0) : Promise.resolve(new ArrayBuffer(0));

    for (let offset = 0; offset < file.size; offset += READ_BLOCK) {
      const block = await next;
      const nextOffset = offset + READ_BLOCK;
      if (nextOffset < file.size) next = read(file, nextOffset); // read ahead while sending

      let p = 0;
      while (p < block.byteLength) {
        const piece = block.slice(p, p + chunk);
        if (!(await sendPiece(piece))) continue; // chunk shrank: re-slice from same position
        p += piece.byteLength;
        sent += piece.byteLength;
        onProgress(sent);
      }
    }

    sendMsg(dc, { kind: 'file-end', index });
  }

  sendMsg(dc, { kind: 'complete' });

  while (dc.bufferedAmount > 0 && dc.readyState === 'open') {
    const w = performance.now();
    await new Promise((r) => setTimeout(r, 50));
    waitMs += performance.now() - w;
  }

  return { waitMs, totalMs: performance.now() - t0, chunk };
}