import { paintTimeline } from './timeline-paint';
import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { homedir, cpus, loadavg } from 'node:os';
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
  let ordinal = 0;
  const selected = process.env.GHOST_TIMELINE_SONG;
  for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
    let number = 0;
    for (const name of (await readdir(join(root, source, 'songs'))).sort()) {
      const folder = join(root, source, 'songs', name);
      if (!existsSync(join(folder, 'song.json'))) continue;
      number++;
      ordinal++;
      if (selected && ordinal !== Number(selected)) continue;
      const input = source === 'first-test-session' ? `first test session, song ${number}` : source;
      const system = { cores: cpus().length, loadAverage: loadavg() };
      try {
        // Reload releases the previous PCM and makes each first draw a fresh mount.
        await page.goto('/?inspect');
        const open = performance.now();
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
        await (await chooser).setFiles(folder);
        await page.locator('#timeline[data-drawn=true]').waitFor();
        const openMs = performance.now() - open;
        let gridReview: unknown = null;
        if (process.env.GHOST_GRID_REVIEW_MEASURE) {
          const question = page.getByRole('region', { name: 'Check tempo and bars', exact: true });
          const detected = await page.evaluate(() => {
            const s = window.ghostReference.current!.song;
            return {
              flagged: s.beatMap.tempoReview.flagged,
              counts: s.detectedBars.filter((b) => !b.partial).map((b) => b.endBeat - b.startBeat),
              bars: s.bars.filter((b) => b.number > 0).length,
            };
          });
          if (detected.flagged || input === 'diversity-1') await expect(question).toBeVisible();
          if (input === 'diversity-1') {
            expect(detected.counts.filter((n) => n === 2)).toHaveLength(87);
            expect(detected.counts.filter((n) => n === 4)).toHaveLength(70);
            await page.getByLabel('Beats per bar', { exact: true }).selectOption('4');
            await page.getByLabel('Beat one', { exact: true }).selectOption('1');
            await question.getByRole('button', { name: 'Use 1×', exact: true }).click();
            await expect(question).toBeHidden();
            await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
            const changed = await page.evaluate(() => ({
              meter: window.ghostReference.current!.song.beatMap.beatsPerBar,
              bars: window.ghostReference.current!.song.bars.filter((b) => b.number > 0).length,
            }));
            expect(changed.meter).toBe(4);
            expect(changed.bars).toBeLessThan(detected.bars);
            gridReview = { ...detected, ...changed };
          } else if (await question.isVisible()) {
            await question.getByRole('button', { name: 'Keep current grid', exact: true }).click();
          }
        }
        const shape = await page.evaluate(() => {
          const r = window.ghostReference.current!;
          return {
            bars: r.song.bars.filter((b) => b.number > 0).length,
            notes: r.song.stems.reduce((n, s) => n + s.notes.length, 0),
            stems: r.song.stems.length,
            gapRegions: r.song.beatMap.coverage.gaps.length,
            barBreaks: r.song.bars.filter(
              (b, i, bars) => i > 0 && Math.abs(b.startSeconds - bars[i - 1].endSeconds) > 1e-8,
            ).length,
            pcmMiB: [...r.audio.values()].reduce((n, a) => n + a.pcmBytes, 0) / 1024 ** 2,
            firstDrawMs: performance.getEntriesByName('Ghost:timeline-first-draw').at(-1)!.duration,
            rows: document.querySelectorAll('#timeline [data-row]').length,
          };
        });
        expect(shape.rows).toBe(24);
        expect(shape.stems).toBe(6);
        let arrangement: unknown = null;
        if (process.env.GHOST_ARRANGEMENT_MEASURE) {
          await page.getByLabel('First bar', { exact: true }).fill('1');
          await page.getByLabel('Last bar', { exact: true }).fill('8');
          await page
            .locator('#timeline')
            .getByRole('button', { name: 'Select', exact: true })
            .click();
          await page
            .locator('.tl-sections')
            .getByRole('button', { name: 'Make section', exact: true })
            .click();
          const dialog = page.getByRole('dialog', { name: 'Make section', exact: true });
          await dialog.getByLabel('Name', { exact: true }).fill('First eight');
          await dialog.getByRole('button', { name: 'Make section', exact: true }).click();
          await page.waitForFunction(
            () =>
              window.odmApp.canPlay &&
              window.odmApp.pendingRows.size === 0 &&
              window.odmApp.state.rows.length === 6 &&
              Object.keys(window.odmApp.state.events).length === 6,
          );
          await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
          const proof = await page.evaluate(() => ({
            queryErrors: Object.values(window.odmApp.state.events).filter((r) => r.error).length,
            queriedNotes: Object.values(window.odmApp.state.events).reduce(
              (n, r) => n + r.events.filter((e) => e.hasOnset).length,
              0,
            ),
            places: document.querySelectorAll('[data-place]').length,
            notes: [...document.querySelectorAll('[data-layer="mine"]')].map((n) =>
              Number(n.getAttribute('aria-description')?.split(' ')[0]),
            ),
            unarrangedRanges: [...document.querySelectorAll('[data-layer="mine"]')].map((n) =>
              Number(
                n.getAttribute('aria-description')?.match(/(\d+) unarranged ranges/)?.[1] ?? 0,
              ),
            ),
          }));
          arrangement = proof;
          expect(proof.queryErrors).toBe(0);
          expect(proof.notes.reduce((n, v) => n + v, 0)).toBe(proof.queriedNotes);
          await page.getByRole('button', { name: 'Close the lens', exact: true }).click();
          await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
        }
        const busiestStem = await page.evaluate(() => {
          const s = window.ghostReference.current!.song;
          const end = s.bars.find((b) => b.number === 8)?.endSeconds ?? s.durationSeconds;
          return [...s.stems].sort(
            (a, b) =>
              b.notes.filter((n) => n.startSeconds < end).length -
              a.notes.filter((n) => n.startSeconds < end).length,
          )[0].id;
        });
        const visibleStem = process.env.GHOST_LENS_DRUMS ? 'drums' : busiestStem;
        if (process.env.GHOST_TIMELINE_LAYERS) {
          await page.locator('#settings').click();
          await page.getByLabel('All instrument views', { exact: true }).selectOption('layers');
          await page.getByRole('button', { name: 'Done', exact: true }).click();
          await expect(page.locator('[data-row="layers"]')).toHaveCount(6);
        }
        const shown = page.getByRole('img', {
          name: `${visibleStem} Mine queried arrangement`,
          exact: true,
        });
        await shown.scrollIntoViewIfNeeded();
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const visibleKind = visibleStem === 'drums' ? 'drums' : 'pitch';
        let lensFrames: Record<string, number[]> = {};
        let lensPointerMoves = 0;
        let lensGridMoves = 0;
        let lensEditorCloses = 0;
        if (process.env.GHOST_LENS_MEASURE) {
          const chunks: unknown[] = [];
          const collect = (event: { value: unknown[] }) => chunks.push(...event.value);
          cdp.on('Tracing.dataCollected', collect);
          await cdp.send('Tracing.start', {
            categories:
              'devtools.timeline,blink.user_timing' +
              (process.env.GHOST_LENS_PROFILE
                ? ',cc,gpu,viz,toplevel,renderer.scheduler' +
                  (process.env.GHOST_LENS_PROFILE === 'pipeline'
                    ? ',blink'
                    : ',disabled-by-default-skia')
                : ''),
            transferMode: 'ReportEvents',
          });
          if (process.env.GHOST_LENS_PROFILE && process.env.GHOST_LENS_PROFILE !== 'pipeline') {
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.start');
          }
          const measured = await page.evaluate(
            async ({ arranged, stemId, pointer, editor }) => {
              const measuredDoc = window.odmApp.state.doc;
              const first = document.querySelector<HTMLInputElement>('[data-first]')!,
                last = document.querySelector<HTMLInputElement>('[data-last]')!;
              const song = window.ghostReference.current!.song;
              const bars = song.bars.filter((b) => b.number > 0 && b.endSeconds > b.startSeconds);
              let best = 0,
                bestCount = -1;
              for (let i = 0; i + 4 < bars.length && (!arranged || i < 5); i++) {
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
              async function openSource() {
                if (!editor) return;
                document.getElementById('score-workspace')!.scrollIntoView({ block: 'center' });
                const instrument =
                  document.querySelector<HTMLSelectElement>('#lens-edit-instrument')!;
                instrument.value = stemId;
                instrument.dispatchEvent(new Event('change'));
                const bar = document.querySelector<HTMLSelectElement>('#lens-edit-bar')!;
                const interior = String(window.ghostTimeline.lens!.firstBar + 1);
                bar.value = [...bar.options].some((o) => o.value === interior)
                  ? interior
                  : String(window.ghostTimeline.lens!.firstBar);
                bar.dispatchEvent(new Event('change'));
                const picker = document.querySelector<HTMLSelectElement>(
                  `[aria-label="${stemId} part to edit"]`,
                );
                if (picker && stemId === 'drums') {
                  picker.selectedIndex = picker.options.length - 1;
                  picker.dispatchEvent(new Event('change'));
                }
                const row = window.odmApp.state.rows.find((r) =>
                  r.patterns.some((p) => p.stem === stemId),
                )!;
                document
                  .querySelector<HTMLElement>(
                    `#score tr[data-node-id="${CSS.escape(row.id)}"] [data-control="rhythm"]`,
                  )!
                  .click();
                const panel = document.getElementById('editor')!;
                if (panel.dataset.editorKind !== 'source') {
                  const source = [...panel.querySelectorAll('button')].find(
                    (b) => b.textContent === 'Edit as source',
                  );
                  if (!source) throw Error('Native source control unavailable');
                  source.click();
                }
                const field = panel.querySelector<HTMLTextAreaElement>('textarea');
                if (panel.hidden || panel.dataset.editorKind !== 'source' || !field)
                  throw Error('Native source editor did not open');
                field.value += '\n/* Unapplied frame-check draft */';
                document
                  .querySelector<HTMLElement>(
                    `[data-stem="${CSS.escape(stemId)}"] [data-layer="mine"]`,
                  )!
                  .scrollIntoView({ block: 'center' });
                await next();
                await next();
              }
              const stillVisible = () => {
                const canvas = document.querySelector<HTMLCanvasElement>(
                  `[data-stem="${CSS.escape(stemId)}"] [data-layer="mine"]`,
                )!;
                const box = canvas.getBoundingClientRect();
                if (box.bottom <= 0 || box.top >= innerHeight)
                  throw Error('Measured Mine row left the viewport');
              };
              let pointerFrame = 0,
                gridMoves = 0;
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
                  if (pointer) {
                    const canvas = document.querySelector<HTMLCanvasElement>(
                      `[data-stem="${CSS.escape(stemId)}"] [data-layer="mine"]`,
                    )!;
                    const box = canvas.getBoundingClientRect();
                    const grid =
                      stemId === 'drums'
                        ? document.querySelector<HTMLElement>('.tl-drum-grid:not([hidden])')
                        : null;
                    const hitBox = grid?.getBoundingClientRect() ?? box;
                    if (grid) gridMoves++;
                    (grid ?? canvas).dispatchEvent(
                      new PointerEvent('pointermove', {
                        bubbles: true,
                        pointerType: 'mouse',
                        clientX: hitBox.left + hitBox.width * (0.15 + (pointerFrame++ % 30) / 40),
                        clientY: grid ? hitBox.top + hitBox.height / 2 : box.bottom - 3,
                      }),
                    );
                  }
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
              if (window.ghostTimeline.lens?.firstBar !== firstBar)
                throw Error('Lens did not open');
              stillVisible();
              await openSource();
              const move = await record('move', () =>
                document.querySelector<HTMLButtonElement>('[data-later]')!.click(),
              );
              if (Number(window.ghostTimeline.lens?.firstBar) !== firstBar + 1)
                throw Error('Lens did not move');
              stillVisible();
              let editorCloses = 0;
              if (editor) {
                if (!document.getElementById('editor')!.hidden)
                  throw Error('Moving the lens kept an old editor');
                editorCloses++;
              }
              await openSource();
              const close = await record('close', () =>
                document.querySelector<HTMLButtonElement>('[data-close]')!.click(),
              );
              if (window.ghostTimeline.lens !== null) throw Error('Lens did not close');
              stillVisible();
              if (editor) {
                if (!document.getElementById('editor')!.hidden)
                  throw Error('Closing the lens kept an old editor');
                editorCloses++;
                if (window.odmApp.state.doc !== measuredDoc)
                  throw Error('A frame-check draft changed the arrangement');
              }
              return {
                frames: { open, move, close },
                pointerMoves: pointerFrame,
                gridMoves,
                editorCloses,
              };
            },
            {
              arranged: !!process.env.GHOST_ARRANGEMENT_MEASURE,
              stemId: visibleStem,
              pointer: !!process.env.GHOST_LENS_POINTER,
              editor: !!process.env.GHOST_LENS_EDITOR,
            },
          );
          lensFrames = measured.frames;
          lensPointerMoves = measured.pointerMoves;
          lensGridMoves = measured.gridMoves;
          lensEditorCloses = measured.editorCloses;
          if (process.env.GHOST_LENS_PROFILE && process.env.GHOST_LENS_PROFILE !== 'pipeline') {
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
        await paintTimeline(page);
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
        // Read canvas pixels only after timing: a readback can change its rendering path.
        expect(
          await shown.evaluate((c: HTMLCanvasElement) =>
            c
              .getContext('2d')!
              .getImageData(0, 0, c.width, c.height)
              .data.some((v) => v !== 0),
          ),
        ).toBe(true);
        if (process.env.GHOST_LENS_MEASURE) {
          await page.getByRole('button', { name: 'Look closer', exact: true }).click();
          await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
          await paintTimeline(page);
          await page
            .locator('.tl-scroll')
            .screenshot({ path: `/tmp/ghost-lens-local-${report.length + 1}.png` });
          await page.getByRole('button', { name: 'Close the lens', exact: true }).click();
          await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
        }
        report.push({
          system,
          arrangement,
          viewMode: process.env.GHOST_TIMELINE_LAYERS ? 'layers' : 'rows',
          pointerMoves: lensPointerMoves,
          gridPointerMoves: lensGridMoves,
          editorCloses: lensEditorCloses,
          visibleKind,
          input,
          ...shape,
          openMs,
          ...frames,
          lensFrames,
          gridReview,
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
  expect(report).toHaveLength(selected ? 1 : 6);
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
