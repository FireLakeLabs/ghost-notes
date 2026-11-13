import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// One browser suite at a time on this machine, across worktrees: parallel suites
// disturb each other's timing tests. The lock is a directory holding the owner's pid.
// A fixed /tmp path, not tmpdir(), so sessions with a private TMPDIR still share it.
export const defaultLockPath = join(
  process.platform === 'win32' ? tmpdir() : '/tmp',
  'ghost-notes-browser-suite.lock',
);

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function tryTake(path) {
  try {
    mkdirSync(path);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner = NaN;
    try {
      owner = Number(readFileSync(join(path, 'pid'), 'utf8'));
    } catch {
      // The owner may be between mkdir and writing its pid. Give it ten seconds.
      if (Date.now() - statSync(path).mtimeMs < 10_000) return { taken: false, owner: undefined };
    }
    if (Number.isInteger(owner) && owner > 0 && alive(owner)) return { taken: false, owner };
    rmSync(path, { recursive: true, force: true });
    return tryTake(path);
  }
  writeFileSync(join(path, 'pid'), String(process.pid));
  return { taken: true };
}

export async function acquireSuiteLock({
  path = defaultLockPath,
  pollMs = 2000,
  log = console.log,
} = {}) {
  let announced = false;
  for (;;) {
    const result = tryTake(path);
    if (result.taken) return () => rmSync(path, { recursive: true, force: true });
    if (!announced) {
      log(`Waiting for another browser suite to finish (pid ${result.owner ?? 'unknown'})`);
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
