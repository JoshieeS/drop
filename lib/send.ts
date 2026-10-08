import { sendMsg } from './protocol';

const READ_BLOCK = 4 * 1024 * 1024;  // read 4 MB from disk at a time
const HIGH_WATER = 16 * 1024 * 1024; // pause when 16 MB is queued
const LOW_WATER = 4 * 1024 * 1024;   // resume when it drains below 4 MB

export type SendStats = { waitMs: number; totalMs: number };

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
  chunk: number
): Promise<SendStats> {
  dc.bufferedAmountLowThreshold = LOW_WATER;
  const t0 = performance.now();
  let waitMs = 0; // time spent paused because the network couldn't keep up
  let sent = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    sendMsg(dc, { kind: 'file-start', index });

    let next = file.size > 0 ? read(file, 0) : Promise.resolve(new ArrayBuffer(0));

    for (let offset = 0; offset < file.size; offset += READ_BLOCK) {
      const block = await next;

      // Start reading the following block now, while this one is being sent.
      const nextOffset = offset + READ_BLOCK;
      if (nextOffset < file.size) next = read(file, nextOffset);

      for (let p = 0; p < block.byteLength; p += chunk) {
        if (dc.readyState !== 'open') throw new Error('channel closed');
        if (dc.bufferedAmount > HIGH_WATER) {
          const w = performance.now();
          await drained(dc);
          waitMs += performance.now() - w;
        }
        const piece = block.slice(p, p + chunk);
        dc.send(piece);
        sent += piece.byteLength;
      }
      onProgress(sent);
    }

    sendMsg(dc, { kind: 'file-end', index });
  }

  sendMsg(dc, { kind: 'complete' });

  // Wait until everything has actually left, so the timing is real.
  while (dc.bufferedAmount > 0 && dc.readyState === 'open') {
    const w = performance.now();
    await new Promise((r) => setTimeout(r, 50));
    waitMs += performance.now() - w;
  }

  return { waitMs, totalMs: performance.now() - t0 };
}