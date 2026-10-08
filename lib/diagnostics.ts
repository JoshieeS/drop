import type { DataConnection } from 'peerjs';
import type { Level } from '@/lib/Terminal';

type Log = (msg: string, level?: Level) => void;

export function traceConnection(conn: DataConnection, log: Log) {
  conn.on('iceStateChanged', (state) =>
    log(`ice: ${state}`, state === 'failed' || state === 'disconnected' ? 'err' : 'info'));

  conn.on('open', async () => {
    const stats = await conn.peerConnection.getStats();

    // Find the candidate pair the browser actually chose.
    let pairId: string | undefined;
    stats.forEach((s: any) => {
      if (s.type === 'transport' && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId;
    });
    let pair: any;
    stats.forEach((s: any) => {
      if (s.type !== 'candidate-pair') return;
      if (s.id === pairId || (!pairId && s.nominated && s.state === 'succeeded')) pair = s;
    });
    if (!pair) return log('channel open', 'ok');

    const local = stats.get(pair.localCandidateId);
    const remote = stats.get(pair.remoteCandidateId);
    const relayed = local?.candidateType === 'relay' || remote?.candidateType === 'relay';

    log(
      relayed
        ? `channel open · relayed via TURN (${local?.protocol})`
        : `channel open · direct p2p (${local?.candidateType} ↔ ${remote?.candidateType}, ${local?.protocol})`,
      relayed ? 'warn' : 'ok'
    );
  });
}