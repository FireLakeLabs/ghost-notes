import { createServer } from 'node:net';

// One test suite (Node or browser) at a time on this machine, across worktrees:
// parallel suites disturb each other's timing tests and per-test time limits. The lock is a Linux abstract socket: binding
// it is atomic, and the kernel frees it when its process exits, however it exits,
// so there is no stale lock to clean up. Other systems run without the lock.
// The name predates the Node suite taking the lock; keep it so branches made
// before then still exclude each other.
export const defaultLockName = 'ghost-notes-browser-suite';

function listen(name) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(`\0${name}`, () => {
      server.unref();
      resolve(server);
    });
  });
}

export async function acquireSuiteLock({
  name = defaultLockName,
  pollMs = 2000,
  log = console.log,
} = {}) {
  if (process.platform !== 'linux') {
    log('Test suite lock is Linux-only; running without it.');
    return () => {};
  }
  let announced = false;
  for (;;) {
    try {
      const server = await listen(name);
      return () => server.close();
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
    if (!announced) {
      log('Waiting for another test suite on this machine to finish');
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
