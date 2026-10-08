export type Sink = {
  kind: 'disk' | 'memory';
  open(path: string): void;
  write(buf: ArrayBuffer): void;
  close(name: string, type: string): Promise<File>;
  dispose(): void;
};

export async function createSink(onError: (msg: string) => void): Promise<Sink> {
  return (await diskSink(onError)) ?? memorySink();
}

async function diskSink(onError: (msg: string) => void): Promise<Sink | null> {
  if (typeof Worker === 'undefined' || !navigator.storage?.getDirectory) return null;

  const dirName = `incoming-${crypto.randomUUID()}`;
  const worker = new Worker('/sink-worker.js');
  const waiters: ((reply: any) => void)[] = []; // replies arrive in the order we asked

  worker.onmessage = (e) => {
    if (e.data.op === 'error') return onError(e.data.message);
    waiters.shift()?.(e.data);
  };

  const ask = (msg: object) =>
    new Promise<any>((resolve) => {
      waiters.push(resolve);
      worker.postMessage(msg);
    });

  const timeout = new Promise<any>((r) => setTimeout(() => r({ ok: false }), 3000));
  const ready = await Promise.race([ask({ op: 'init', dir: dirName }), timeout]);
  if (!ready.ok) {
    worker.terminate();
    return null;
  }

  let path = '';
  return {
    kind: 'disk',
    open(p) {
      path = p;
      worker.postMessage({ op: 'open', path: p });
    },
    write(buf) {
      worker.postMessage({ op: 'write', buf }, [buf]); // transfer ownership, no copy
    },
    async close(name, type) {
      const myPath = path; // capture now: the next file may call open() before we finish
      const reply = await ask({ op: 'close' });
      if (!reply.ok) throw new Error(reply.message);
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle(dirName);
      const onDisk = await (await dir.getFileHandle(myPath)).getFile();
      return new File([onDisk], name, { type, lastModified: Date.now() });
    },
    dispose() {
      worker.terminate();
    },
  };
}

function memorySink(): Sink {
  let parts: ArrayBuffer[] = [];
  return {
    kind: 'memory',
    open() { parts = []; },
    write(buf) { parts.push(buf); },
    async close(name, type) {
      const mine = parts;
      parts = [];
      return new File(mine, name, { type });
    },
    dispose() { parts = []; },
  };
}                          