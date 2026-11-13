import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { acquireSuiteLock } from '../scripts/suite-lock.mjs';

const unique = () => `ghost-notes-suite-lock-test-${process.pid}-${Math.random()}`;

describe.runIf(process.platform === 'linux')('browser suite lock', () => {
  it('a second suite waits until the first releases the lock', async () => {
    const name = unique();
    const release = await acquireSuiteLock({ name });
    const logs: string[] = [];
    let second = false;
    const waiting = acquireSuiteLock({ name, pollMs: 10, log: (line) => logs.push(line) }).then(
      (releaseSecond) => {
        second = true;
        return releaseSecond;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(second).toBe(false);
    expect(logs).toEqual(['Waiting for another browser suite on this machine to finish']);
    release();
    (await waiting)();
    expect(second).toBe(true);
  });

  it('eight processes contending never hold the lock at the same time', async () => {
    const name = unique();
    const holder = `
      const { acquireSuiteLock } = await import(${JSON.stringify(new URL('../scripts/suite-lock.mjs', import.meta.url).href)});
      const release = await acquireSuiteLock({ name: ${JSON.stringify(name)}, pollMs: 5, log: () => {} });
      const enter = performance.timeOrigin + performance.now();
      await new Promise((resolve) => setTimeout(resolve, 40));
      const leave = performance.timeOrigin + performance.now();
      release();
      console.log(JSON.stringify([enter, leave]));`;
    const run = () =>
      new Promise<[number, number]>((resolve, reject) => {
        const child = spawn(process.execPath, ['--input-type=module', '-e', holder]);
        let out = '';
        child.stdout.on('data', (chunk) => (out += chunk));
        child.once('error', reject);
        child.once('exit', (code) =>
          code ? reject(Error(`exit ${code}`)) : resolve(JSON.parse(out)),
        );
      });
    const spans = (await Promise.all(Array.from({ length: 8 }, run))).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++)
      expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
  });

  it('a holder that is killed frees the lock', async () => {
    const name = unique();
    const holder = `
      const { acquireSuiteLock } = await import(${JSON.stringify(new URL('../scripts/suite-lock.mjs', import.meta.url).href)});
      await acquireSuiteLock({ name: ${JSON.stringify(name)}, log: () => {} });
      console.log('held');
      setInterval(() => {}, 1000);`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', holder]);
    await new Promise((resolve) => child.stdout.once('data', resolve));
    let taken = false;
    const waiting = acquireSuiteLock({ name, pollMs: 10, log: () => {} }).then((release) => {
      taken = true;
      return release;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(taken).toBe(false);
    child.kill('SIGKILL');
    (await waiting)();
    expect(taken).toBe(true);
  });
});
