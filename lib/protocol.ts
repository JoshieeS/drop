export type FileMeta = { name: string; size: number; type: string };

export type Msg =
  | { kind: 'manifest'; files: FileMeta[] }
  | { kind: 'start' }
  | { kind: 'file-start'; index: number }
  | { kind: 'file-end'; index: number }
  | { kind: 'complete' };

// 16 KB is the message size every browser handles safely, Safari included.
export const CHUNK = 16 * 1024;

export function sendMsg(dc: RTCDataChannel, msg: Msg) {
  dc.send(JSON.stringify(msg));
}

export function parseMsg(data: unknown): Msg | null {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as Msg;
  } catch {
    return null;
  }
}