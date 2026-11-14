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
        let lensFrames: Record<string, number[]> = {};
        if (process.env.GHOST_LENS_MEASURE) {
          const chunks: unknown[] = [];
          const collect = (event: { value: unknown[] }) => chunks.push(...event.value);
          cdp.on('Tracing.dataCollected', collect);
          await cdp.send('Tracing.start', {
            categories: 'devtools.timeline,blink.user_timing',
            transferMode: 'ReportEvents',
          });
          if (process.env.GHOST_LENS_PROFILE) {
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.start');
          }
          lensFrames = await page.evaluate(async () => {
            const first = document.querySelector<HTMLInputElement>('[data-first]')!,
              last = document.querySelector<HTMLInputElement>('[data-last]')!;
            const song = window.ghostReference.current!.song;
            const bars = song.bars.filter((b) => b.number > 0 && b.endSeconds > b.startSeconds);
            let best = 0,
              bestCount = -1;
            for (let i = 0; i + 4 < bars.length; i++) {
              const count = song.stems.reduce(
                (n, s) =>
                  n +
                  s.notes.filter(
                    (note) =>
                      note.startSeconds >= bars[i].startSeconds &&
                      note.startSeconds < bars[i + 3].endSeconds,
                  ).length,
                0,
              );
              if (count > bestCount) {
                best = i;
                bestCount = count;
              }
            }
            const firstBar = bars[best].number;
            first.value = String(firstBar);
            last.value = String(bars[best + 3].number);
            document.querySelector<HTMLButtonElement>('[data-select]')!.click();
            const next = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
            const record = async (name: string, action: () => void) => {
              const result: number[] = [];
              let before = await next();
              performance.mark(`Ghost:lens-${name}-start`, { detail: { timestamp: before } });
              action();
              do {
                const now = await next();
                result.push(now - before);
                performance.mark(`Ghost:lens-${name}-frame`, { detail: { timestamp: now } });
                before = now;
              } while (document.getElementById('timeline')!.dataset.animating === 'true');
              const tail = await next();
              result.push(tail - before);
              performance.mark(`Ghost:lens-${name}-frame`, { detail: { timestamp: tail } });
              performance.mark(`Ghost:lens-${name}-end`);
              return result;
            };
            const open = await record('open', () =>
              document.querySelector<HTMLButtonElement>('[data-closer]')!.click(),
            );
            if (window.ghostTimeline.lens?.firstBar !== firstBar) throw Error('Lens did not open');
            const move = await record('move', () =>
              document.querySelector<HTMLButtonElement>('[data-later]')!.click(),
            );
            if (Number(window.ghostTimeline.lens?.firstBar) !== firstBar + 1)
              throw Error('Lens did not move');
            const close = await record('close', () =>
              document.querySelector<HTMLButtonElement>('[data-close]')!.click(),
            );
            if (window.ghostTimeline.lens !== null) throw Error('Lens did not close');
            return { open, move, close };
          });
          if (process.env.GHOST_LENS_PROFILE) {
            const cpu = await cdp.send('Profiler.stop');
            await writeFile(
              `/tmp/ghost-lens-cpu-${report.length + 1}.json`,
              JSON.stringify(cpu.profile),
            );
            await cdp.send('Profiler.disable');
          }
          const done = new Promise<void>((resolve) =>
            cdp.once('Tracing.tracingComplete', () => resolve()),
          );
          await cdp.send('Tracing.end');
          await done;
          cdp.off('Tracing.dataCollected', collect);
          await writeFile(
            `/tmp/ghost-lens-trace-${process.env.GHOST_LENS_RUN ?? '1'}-${report.length + 1}.json`,
            JSON.stringify({ traceEvents: chunks }),
          );
          await page.getByRole('button', { name: 'Look closer', exact: true }).click();
          await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
          await page
            .locator('.tl-scroll')
            .screenshot({ path: `/tmp/ghost-lens-local-${report.length + 1}.png` });
          await page.getByRole('button', { name: 'Close the lens', exact: true }).click();
          await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
        }
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
          lensFrames,
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
  if (process.env.GHOST_LENS_MEASURE)
    for (const row of report)
      for (const [operation, frames] of Object.entries(row.lensFrames)) {
        expect(frames.length, `${row.input} ${operation} frame count`).toBeGreaterThan(10);
        // 60 Hz timestamps are quantized to 16.6/16.7 ms; allow 0.2 ms rounding.
        expect(Math.max(...frames), `${row.input} ${operation} worst frame`).toBeLessThanOrEqual(
          16.9,
        );
      }
});
