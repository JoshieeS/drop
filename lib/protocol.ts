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

export function pickChunkSize(pc: RTCPeerConnection): number {
    const max = pc.sctp?.maxMessageSize ?? 0;
    if (max >= 64*1024) return Math.min(max, 256*1024);   // 64–256 KB is safe for all browsers
    return 16*1024;   // Safari 16.4 and earlier only support 16 KB
}