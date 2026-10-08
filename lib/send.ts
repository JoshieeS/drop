import { CHUNK, sendMsg } from './protocol';

const READ_BLOCK = 1024 * 1024;     // read 1 MB from disk at a time
const HIGH_WATER = 4 * 1024 * 1024; // pause when 4 MB is queued
const LOW_WATER = 1024 * 1024;      // resume when it drains below 1 MB

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

export async function sendFiles(
  dc: RTCDataChannel,
  files: File[],
  onProgress: (sentBytes: number) => void
) {
  dc.bufferedAmountLowThreshold = LOW_WATER;
  let sent = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    sendMsg(dc, { kind: 'file-start', index });

    for (let offset = 0; offset < file.size; offset += READ_BLOCK) {
      const block = await file.slice(offset, offset + READ_BLOCK).arrayBuffer();

      for (let p = 0; p < block.byteLength; p += CHUNK) {
        if (dc.readyState !== 'open') throw new Error('channel closed');
        if (dc.bufferedAmount > HIGH_WATER) await drained(dc);

        const chunk = block.slice(p, p + CHUNK);
        dc.send(chunk);
        sent += chunk.byteLength;
      }
      onProgress(sent);
    }

    sendMsg(dc, { kind: 'file-end', index });
  }

  sendMsg(dc, { kind: 'complete' });

  // Wait until everything has actually left, so the timing we log is real.
  while (dc.bufferedAmount > 0 && dc.readyState === 'open') {
    await new Promise((r) => setTimeout(r, 50));
  }
}