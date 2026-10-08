// Dedicated worker: writes incoming chunks straight to the Origin Private File System.
let dir = null;
let handle = null;
let offset = 0;
let failure = null;
let chain = Promise.resolve();

// Run messages strictly one after another, even though some steps are async.
self.onmessage = (e) => {
  chain = chain
    .then(() => run(e.data))
    .catch((err) => {
      if (!failure) self.postMessage({ op: 'error', message: String(err) });
      failure = failure || String(err);
    });
};

async function run(m) {
  switch (m.op) {
    case 'init': {
      try {
        const root = await navigator.storage.getDirectory();
        await sweep(root, m.dir);
        dir = await root.getDirectoryHandle(m.dir, { create: true });
        // Probe: some private-browsing modes expose OPFS but refuse sync handles.
        const probe = await dir.getFileHandle('.probe', { create: true });
        (await probe.createSyncAccessHandle()).close();
        await dir.removeEntry('.probe');
        self.postMessage({ op: 'ready', ok: true });
      } catch (err) {
        self.postMessage({ op: 'ready', ok: false, message: String(err) });
      }
      return;
    }
    case 'open': {
      const fh = await dir.getFileHandle(m.path, { create: true });
      handle = await fh.createSyncAccessHandle();
      handle.truncate(0);
      offset = 0;
      return;
    }
    case 'write': {
      offset += handle.write(new Uint8Array(m.buf), { at: offset });
      return;
    }
    case 'close': {
      try {
        if (handle) { handle.flush(); handle.close(); }
      } catch (err) {
        failure = failure || String(err);
      }
      handle = null;
      self.postMessage({ op: 'closed', ok: !failure, message: failure, written: offset });
      failure = null;
      return;
    }
  }
}

// Delete folders left over from earlier visits. Folders another tab is using are locked and skipped.
async function sweep(root, keep) {
  try {
    const stale = [];
    for await (const entry of root.entries()) {
      const name = entry[0];
      if (name.startsWith('incoming-') && name !== keep) stale.push(name);
    }
    for (const name of stale) {
      await root.removeEntry(name, { recursive: true }).catch(() => {});
    }
  } catch {
    // Directory iteration not supported: skip cleanup.
  }
}