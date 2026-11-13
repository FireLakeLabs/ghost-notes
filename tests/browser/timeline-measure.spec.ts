import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
const root = join(homedir(), 'projects/ghost-notes/reference');
test('six local songs: first draw, scroll and zoom frame times', async ({ page, context }) => {
  test.skip(!existsSync(root), 'Local reference material is absent');
  test.setTimeout(170_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
  );
  const errors: string[] = [];
  page.on('pageerror', () => errors.push('Browser runtime error'));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const report = [];
  for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
    let number = 0;
    for (const name of (await readdir(join(root, source, 'songs'))).sort()) {
      const folder = join(root, source, 'songs', name);
      if (!existsSync(join(folder, 'song.json'))) continue;
      number++;
      const input = source === 'first-test-session' ? `first test session, song ${number}` : source;
      try {
        // Reload releases the previous PCM and makes each first draw a fresh mount.
        await page.goto('/?inspect');
        const open = performance.now();
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
        await (await chooser).setFiles(folder);
        await page.locator('#timeline[data-drawn=true]').waitFor();
        const openMs = performance.now() - open;
        const shape = await page.evaluate(() => {
          const r = window.ghostReference.current!;
          return {
            bars: r.song.bars.filter((b) => b.number > 0).length,
            notes: r.song.stems.reduce((n, s) => n + s.notes.length, 0),
            stems: r.song.stems.length,
            pcmMiB: [...r.audio.values()].reduce((n, a) => n + a.pcmBytes, 0) / 1024 ** 2,
            firstDrawMs: performance.getEntriesByName('Ghost:timeline-first-draw').at(-1)!.duration,
            rows: document.querySelectorAll('#timeline [data-row]').length,
          };
        });
        expect(shape.rows).toBe(12);
        expect(shape.stems).toBe(6);
        const before = await cdp.send('Performance.getMetrics');
        if (process.env.GHOST_TIMELINE_PROFILE && source === 'first-test-session' && number === 4) {
          await cdp.send('Profiler.enable');
          await cdp.send('Profiler.start');
        }
        const frames = await page.evaluate(async () => {
          const scroll = document.querySelector<HTMLElement>('.tl-scroll')!;
          const zoom = document.querySelector<HTMLInputElement>('[data-zoom]')!;
          const next = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
          const scrollFrames: number[] = [],
            zoomFrames: number[] = [];
          const values = [];
          zoom.value = '8';
          zoom.dispatchEvent(new Event('input'));
          await next();
          await next();
          let last = await next();
          for (let i = 0; i < 90; i++) {
            scroll.scrollLeft = (i / 89) * (scroll.scrollWidth - scroll.clientWidth);
            const now = await next();
            scrollFrames.push(now - last);
            last = now;
            values.push(scroll.scrollLeft);
          }
          for (let i = 0; i < 60; i++) {
            zoom.value = String(1 + (i % 30) / 2);
            zoom.dispatchEvent(new Event('input'));
            const now = await next();
            zoomFrames.push(now - last);
            last = now;
          }
          await next();
          return { scrollFrames, zoomFrames, traveled: Math.max(...values) - Math.min(...values) };
        });
        expect(frames.traveled).toBeGreaterThan(1000);
        const after = await cdp.send('Performance.getMetrics');
        // Anonymous local-only pixels: omit the song-name summary above this region.
        await page
          .locator('.tl-scroll')
          .screenshot({ path: `/tmp/ghost-timeline-local-${report.length + 1}.png` });
        if (process.env.GHOST_TIMELINE_PROFILE && source === 'first-test-session' && number === 4) {
          const profile = await cdp.send('Profiler.stop');
          await writeFile('/tmp/ghost-timeline-cpu.json', JSON.stringify(profile.profile));
          await cdp.send('Profiler.disable');
        }
        const metric = (rows: typeof before.metrics, name: string) =>
          rows.find((r) => r.name === name)?.value ?? 0;
        report.push({
          input,
          ...shape,
          openMs,
          ...frames,
          taskMs:
            (metric(after.metrics, 'TaskDuration') - metric(before.metrics, 'TaskDuration')) * 1000,
          scriptMs:
            (metric(after.metrics, 'ScriptDuration') - metric(before.metrics, 'ScriptDuration')) *
            1000,
        });
      } catch {
        // Do not let a native picker error expose a source path or a song title.
        await page.goto('about:blank');
        throw Error(`Timeline measurement failed: ${input}`);
      }
    }
  }
  await cdp.detach();
  await page.goto('about:blank');
  expect(report).toHaveLength(6);
  expect(errors).toHaveLength(0);
  await writeFile(
    process.env.GHOST_TIMELINE_REPORT ?? '/tmp/ghost-timeline-report.json',
    JSON.stringify(
      {
        browser: await context.browser()!.version(),
        viewport: [1440, 1100],
        errors: errors.length,
        report,
      },
      null,
      2,
    ),
  );
});
