// Production-browser comparison. Control checkout and local reference are read-only.
import { readdir, writeFile } from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, preview } from 'vite';
import { chromium } from '@playwright/test';
import { acquireSuiteLock } from './suite-lock.mjs';

const workspace = process.cwd();
const control = process.env.GHOST_QUERY_CONTROL;
if (!control) throw Error('Set GHOST_QUERY_CONTROL to a read-only control checkout');
const release = await acquireSuiteLock();
const directory = mkdtempSync(join(tmpdir(), 'ghost-score-query-'));
const servers = [];
const samples = [];
let browser,
  stage = 'build';
try {
  for (const [name, root] of [
    ['old', control],
    ['new', workspace],
  ]) {
    process.chdir(root);
    const outDir = join(directory, name);
    await build({ root, build: { outDir } });
    const server = await preview({
      root,
      build: { outDir },
      preview: { host: '127.0.0.1', port: 0, open: false },
    });
    servers.push({ name, server, url: 'http://127.0.0.1:' + server.httpServer.address().port });
  }
  process.chdir(workspace);
  const songs = join(homedir(), 'projects/ghost-notes/reference/first-test-session/songs');
  const [name] = (await readdir(songs)).sort();
  const folder = join(songs, name);
  browser = await chromium.launch({ headless: true });
  const source = Array.from(
    { length: 6 },
    (_, i) => '$: note("c3 e3 g3 b3").s("sine").gain(' + (i + 1) / 10 + ');',
  ).join('\n');
  for (let run = 1; run <= 5; run++) {
    for (const variant of servers) {
      for (const input of ['fixture', 'first test session, song 1']) {
        stage = variant.name + ' / ' + input;
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        let errors = 0;
        page.on('pageerror', () => errors++);
        await page.route(
          (url) => url.protocol === 'https:',
          (route) => route.abort(),
        );
        await page.addInitScript(() => {
          Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });
          window.queryWorkerStarts = 0;
          const Native = window.Worker;
          window.Worker = class extends Native {
            constructor(url, options) {
              super(url, options);
              if (String(url).includes('evaluate-browser.worker')) window.queryWorkerStarts++;
            }
          };
        });
        await page.goto(variant.url + '/?inspect');
        let start,
          before = 0;
        if (input === 'fixture') {
          start = performance.now();
          await page.evaluate((code) => window.odmApp.load(code), source);
        } else {
          const chooser = page.waitForEvent('filechooser');
          await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
          await (await chooser).setFiles(folder);
          await page.locator('#timeline[data-drawn=true]').waitFor();
          const question = page.getByRole('region', { name: 'Check tempo and bars', exact: true });
          if (await question.isVisible())
            await question.getByRole('button', { name: 'Keep current grid', exact: true }).click();
          await page.getByLabel('First bar', { exact: true }).fill('1');
          await page.getByLabel('Last bar', { exact: true }).fill('8');
          await page
            .locator('#timeline')
            .getByRole('button', { name: 'Select', exact: true })
            .click();
          await page.getByRole('button', { name: 'Make section', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Make section', exact: true });
          await dialog.getByLabel('Name', { exact: true }).fill('First eight');
          for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.uncheck();
          before = await page.evaluate(() => window.queryWorkerStarts);
          start = performance.now();
          await dialog.getByRole('button', { name: 'Make section', exact: true }).click();
        }
        await page.waitForFunction(
          () =>
            window.odmApp.canPlay &&
            window.odmApp.state.rows.length === 6 &&
            Object.keys(window.odmApp.state.events).length === 6,
        );
        const answersMs = performance.now() - start;
        const proof = await page.evaluate(() => ({
          starts: window.queryWorkerStarts,
          queryErrors: Object.values(window.odmApp.state.events).filter((r) => r.error).length,
          notes: Object.values(window.odmApp.state.events).reduce(
            (n, r) => n + r.events.filter((e) => e.hasOnset).length,
            0,
          ),
        }));
        const workers = proof.starts - before;
        const expectedWorkers =
          input === 'fixture' ? (variant.name === 'old' ? 7 : 2) : variant.name === 'old' ? 9 : 3;
        if (workers !== expectedWorkers) throw Error('Expected question path did not run');
        if (proof.queryErrors || errors || proof.notes !== (input === 'fixture' ? 96 : 362))
          throw Error('Score output disagrees');
        if (input !== 'fixture') await page.locator('#timeline[data-animating=false]').waitFor();
        samples.push({
          run,
          variant: variant.name,
          input,
          answersMs,
          readyMs: performance.now() - start,
          workers,
          notes: proof.notes,
          errors,
          queryErrors: proof.queryErrors,
        });
        await page.close();
      }
    }
  }
  await writeFile(
    process.env.GHOST_QUERY_REPORT ?? '/tmp/ghost-score-query-bench.json',
    JSON.stringify({ browser: browser.version(), viewport: [1440, 1100], samples }, null, 2),
  );
  console.log(JSON.stringify({ samples: samples.length, errors: 0 }));
} catch {
  console.error('Score-query comparison failed at ' + stage);
  process.exitCode = 1;
} finally {
  process.chdir(workspace);
  await browser?.close();
  for (const { server } of servers)
    await new Promise((resolve) => server.httpServer.close(resolve));
  rmSync(directory, { recursive: true, force: true });
  release();
}
