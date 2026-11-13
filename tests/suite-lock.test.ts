import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { acquireSuiteLock } from '../scripts/suite-lock.mjs';

const dirs: string[] = [];
function lockPath() {
  const dir = mkdtempSync(join(tmpdir(), 'suite-lock-test-'));
  dirs.push(dir);
  return join(dir, 'lock');
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it('a second suite waits until the first releases the lock', async () => {
  const path = lockPath();
  const release = await acquireSuiteLock({ path });
  const logs: string[] = [];
  let second = false;
  const waiting = acquireSuiteLock({ path, pollMs: 10, log: (line) => logs.push(line) }).then(
    (releaseSecond) => {
      second = true;
      return releaseSecond;
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(second).toBe(false);
  expect(logs).toEqual([`Waiting for another browser suite to finish (pid ${process.pid})`]);
  release();
  (await waiting)();
  expect(second).toBe(true);
  expect(existsSync(path)).toBe(false);
});

it('a lock left by a process that has exited is taken over', async () => {
  const path = lockPath();
  mkdirSync(path);
  writeFileSync(join(path, 'pid'), '2147483646');
  const release = await acquireSuiteLock({ path, pollMs: 10, log: () => {} });
  release();
  expect(existsSync(path)).toBe(false);
});
