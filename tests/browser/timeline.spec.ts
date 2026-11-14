import { paintTimeline } from './timeline-paint';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect } from '@playwright/test';
import { timelineFixture } from '../fixtures/timeline';

test('folder opens the whole-song rows, pickup, gaps, waveform, contour and navigation', async ({
  page,
}) => {
  const folder = await mkdtemp(join(tmpdir(), 'ghost-timeline-'));
  try {
    const files = timelineFixture();
    for (const path of ['song.json', 'beats.json']) {
      const data = JSON.parse(new TextDecoder().decode(files.get(path)));
      data.duration_seconds = 50.01;
      if (path === 'beats.json') data.coverage.trailing_seconds = 0.01;
      files.set(path, new TextEncoder().encode(JSON.stringify(data)));
    }
    for (const [path, bytes] of files) {
      const file = join(folder, path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, bytes);
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.addInitScript(() =>
      Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
    );
    await page.goto('/?inspect');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await chooser).setFiles(folder);
    const timeline = page.getByRole('region', { name: 'Whole song timeline', exact: true });
    await expect(timeline).toHaveAttribute('data-drawn', 'true');
    await expect(timeline).toHaveAttribute('data-bars', '25');
    await expect(timeline.locator('[data-bar="0"]')).toHaveText('0');
    await expect(timeline.locator('[data-gap]')).toHaveCount(1);
    await expect(timeline.locator('[data-uncovered]')).toHaveCount(1);
    const marksFit = await timeline
      .locator('[data-ruler]')
      .evaluate((ruler) =>
        [...ruler.querySelectorAll('.tl-mark')].every(
          (mark) => mark.getBoundingClientRect().bottom <= ruler.getBoundingClientRect().bottom,
        ),
      );
    expect(marksFit).toBe(true);
    await expect(timeline.locator('[data-row="audio"]')).toHaveCount(6);
    await expect(timeline.locator('[data-row="midi"]')).toHaveCount(6);
    expect(await timeline.locator('.tl-heading strong').allTextContents()).toEqual([
      'drums',
      'bass',
      'keys',
      'other',
      'vocals',
      'guitar',
    ]);
    await expect(timeline).toContainText('Skipped quiet stem');
    // Grid choices redraw the same port; inference metadata is optional on detected bars.
    await page.evaluate(() => {
      const bar = window.ghostReference.current!.song.bars[1];
      Object.assign(bar, {
        inferences: [
          {
            kind: 'split-long-bar',
            seconds: bar.startSeconds,
            source: [bar.startSeconds, bar.endSeconds],
          },
        ],
      });
      document.getElementById('reference-panel')!.dispatchEvent(new Event('referencechange'));
    });
    await expect(timeline.locator('[data-inferred]')).toHaveText('1');
    await expect(timeline.locator('[data-inferred]')).toHaveAttribute('title', /split long bar/);
    const neutral = await timeline.locator('[data-inferred]').evaluate((n) => {
      const rgb = getComputedStyle(n).color.match(/\d+/g)!.map(Number);
      return Math.max(...rgb) - Math.min(...rgb);
    });
    expect(neutral).toBeLessThan(32);
    const rulerClear = () =>
      timeline.locator('[data-ruler]').evaluate((ruler) => {
        const viewport = ruler.closest('.tl-scroll')!.getBoundingClientRect();
        const contained = [...ruler.querySelectorAll('.tl-mark')]
          .filter((n) => getComputedStyle(n).visibility === 'visible')
          .every((n) => {
            const r = n.getBoundingClientRect();
            return r.left >= viewport.left + 150 && r.right <= viewport.right;
          });
        const rects = [...ruler.querySelectorAll('.tl-bar, .tl-mark')]
          .filter((n) => getComputedStyle(n).visibility === 'visible')
          .map((n) => n.getBoundingClientRect());
        return (
          contained &&
          rects.every((a, i) =>
            rects
              .slice(i + 1)
              .every(
                (b) =>
                  a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
              ),
          )
        );
      });
    expect(await rulerClear()).toBe(true);
    await expect(timeline).toHaveAttribute('data-drawn', 'true');
    // Real canvas pixels: a blue waveform and contour must both have been painted.
    for (const label of [
      'bass waveform',
      'bass pitch contour',
      'drums drum lanes: Crash, Hi-hat, Snare, Tom, Kick',
    ]) {
      await page.getByRole('img', { name: label, exact: true }).scrollIntoViewIfNeeded();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const blue = await page
        .getByRole('img', { name: label, exact: true })
        .evaluate((canvas: HTMLCanvasElement) => {
          const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          let n = 0,
            minY = canvas.height,
            maxY = 0,
            edgeBlue = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i + 2] > pixels[i] + 30 && pixels[i + 3] > 80) {
              n++;
              const y = Math.floor(i / 4 / canvas.width),
                x = (i / 4) % canvas.width;
              if (y < 2 || y >= canvas.height - 2) edgeBlue++;
              if (y >= 2 && y < canvas.height - 2 && x >= 2 && x < canvas.width - 2) {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
              }
            }
          return { n, span: maxY - minY, height: canvas.height, edgeBlue };
        });
      expect(blue.n).toBeGreaterThan(20);
      if (label === 'bass pitch contour') {
        expect(blue.span).toBeGreaterThan(blue.height * 0.65);
        expect(blue.edgeBlue).toBe(0);
      }
    }
    if (process.env.GHOST_TIMELINE_SHOT) {
      await paintTimeline(page);
      await timeline.screenshot({ path: process.env.GHOST_TIMELINE_SHOT });
    }
    expect(
      await timeline.locator('.tl-scroll').evaluate((n) => n.scrollWidth - n.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.getByLabel('Timeline zoom').fill('4');
    await page.getByRole('slider', { name: 'Song overview' }).press('End');
    await expect
      .poll(() => timeline.locator('.tl-scroll').evaluate((n) => n.scrollLeft))
      .toBeGreaterThan(1000);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const pinned = await timeline.evaluate((root) => {
      const left = root.querySelector('.tl-scroll')!.getBoundingClientRect().left;
      return ['.tl-heading strong', '[data-row] .tl-label'].map(
        (selector) => root.querySelector(selector)!.getBoundingClientRect().left - left,
      );
    });
    expect(pinned).toEqual([0, 0]);
    const end = await timeline
      .locator('.tl-scroll')
      .evaluate((node) => ({ left: node.scrollLeft, expected: node.clientWidth - 150 }));
    expect(end.left).toBeCloseTo(end.expected * 3, 0);
    expect(await rulerClear()).toBe(true);
    await expect(timeline.locator('[data-uncovered]')).toHaveCSS('visibility', 'visible');
    await expect(timeline.locator('[data-gap]')).toHaveCSS('visibility', 'hidden');
    if (process.env.GHOST_TIMELINE_SHOT) {
      await paintTimeline(page);
      await timeline.screenshot({
        path: process.env.GHOST_TIMELINE_SHOT.replace('.png', '-zoom.png'),
      });
    }
    await page.locator('#settings').click();
    await page.getByLabel('Stem audio').uncheck();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(timeline.locator('[data-row="audio"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fit song' }).click();
    await expect(page.getByLabel('Timeline zoom')).toHaveValue('1');
    await page.locator('#settings').click();
    await page.getByLabel('Stem audio').check();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    for (const mode of ['band', 'instrument'])
      for (const snap of ['bars', 'beats']) {
        await page.locator('#settings').click();
        await expect(
          page.getByRole('dialog', { name: 'Settings', exact: true }).getByLabel('Selection scope'),
        ).toHaveCount(1);
        await page.getByLabel('Selection scope').selectOption(mode);
        await page.getByLabel('Selection snap').selectOption(snap);
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        const canvas = timeline.locator('[data-row="midi"][data-stem="bass"] canvas');
        const box = await canvas.boundingBox();
        if (!box) throw Error('Missing MIDI canvas');
        await page.mouse.move(box.x + box.width * 0.12, box.y + 15);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.22, box.y + 15);
        await page.mouse.up();
        const selected = await page.evaluate(() => window.ghostTimeline.selection);
        expect(selected?.scope.kind).toBe(mode);
        if (mode === 'instrument') expect(selected?.scope).toMatchObject({ stemId: 'bass' });
        expect(selected?.end.seconds).toBeGreaterThan(selected!.start.seconds);
        if (snap === 'bars') expect(selected?.start.beatInBar).toBe(0);
        else expect(Number.isInteger(selected?.start.beat)).toBe(true);
      }
    await expect(timeline.locator('[data-row="midi"] canvas').first()).toHaveCSS(
      'touch-action',
      'pan-y',
    );
    await page.getByLabel('Selection instrument').selectOption('keys');
    await expect(page.getByRole('button', { name: 'Look closer', exact: true })).toBeDisabled();
    await page.getByLabel('First bar', { exact: true }).fill('5');
    await page.getByLabel('Last bar', { exact: true }).fill('3');
    await timeline.getByRole('button', { name: 'Select', exact: true }).click();
    const openingMs = await page.evaluate(async () => {
      const start = performance.now();
      document.querySelector<HTMLButtonElement>('[data-closer]')!.click();
      do {
        await new Promise(requestAnimationFrame);
      } while (document.getElementById('timeline')!.dataset.animating === 'true');
      return performance.now() - start;
    });
    expect(openingMs).toBeGreaterThanOrEqual(400);

    await expect(timeline).toHaveAttribute('data-lens', '3:5');
    expect(await page.evaluate(() => window.ghostTimeline.lens)).toEqual({
      firstBar: 3,
      lastBar: 5,
    });
    await expect(timeline).toHaveAttribute('data-animating', 'false');
    const head = page.getByRole('group', { name: 'Lens header' });
    await head.press('ArrowRight');
    await expect(timeline).toHaveAttribute('data-lens', '4:6');
    await expect(timeline).toHaveAttribute('data-animating', 'false');
    const hb = await head.boundingBox();
    if (!hb) throw Error('Missing lens header');
    await page.mouse.move(hb.x + hb.width / 2, hb.y + 15);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 20, hb.y + 15);
    await page.mouse.up();
    await expect(timeline).toHaveAttribute('data-lens', '5:7');
    await expect(timeline).toHaveAttribute('data-animating', 'false');
    const strip = await page.getByRole('slider', { name: 'Song overview' }).boundingBox();
    if (!strip) throw Error('Missing overview');
    const edge = await page.evaluate(() => {
      const s = window.ghostReference.current!.song;
      const a = s.bars.find((b) => b.number === 5)!;
      const b = s.bars.find((b) => b.number === 6)!;
      return {
        a: window.ghostTimeline.xAtPosition({
          kind: 'uncovered',
          seconds: a.startSeconds,
          bar: null,
          beat: null,
          beatInBar: null,
        })!,
        b: window.ghostTimeline.xAtPosition({
          kind: 'uncovered',
          seconds: b.startSeconds,
          bar: null,
          beat: null,
          beatInBar: null,
        })!,
      };
    });
    await page.mouse.move(strip.x + edge.a + 2, strip.y + 15);
    await page.mouse.down();
    await page.mouse.move(strip.x + edge.b + 2, strip.y + 15);
    await page.mouse.up();
    await expect(timeline).toHaveAttribute('data-lens', '6:8');
    await expect(timeline).toHaveAttribute('data-animating', 'false');
    if (process.env.GHOST_LENS_SHOT) {
      await paintTimeline(page);
      await timeline.screenshot({ path: process.env.GHOST_LENS_SHOT });
    }
    await expect(page.locator('#draft-context')).toContainText('Reference lens: bars 6–8');
    // A new selection in the squeezed outside context must remain visible.
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    const keys = timeline.locator('[data-row="midi"][data-stem="keys"] canvas');
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await keys.scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const beforeSelection = await keys.evaluate(
      (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(50, 1, 1, 1).data[0],
    );
    await keys.scrollIntoViewIfNeeded();
    const kb = await keys.boundingBox();
    if (!kb) throw Error('Missing keys row');
    await page.mouse.move(kb.x + 45, kb.y + 15);
    await page.mouse.down();
    await page.mouse.move(kb.x + 55, kb.y + 15);
    await page.mouse.up();
    await expect
      .poll(() =>
        keys.evaluate(
          (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(50, 1, 1, 1).data[0],
        ),
      )
      .toBeGreaterThan(beforeSelection + 10);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const zoomLocked = await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-close]')!.click();
      return document.querySelector<HTMLInputElement>('[data-zoom]')!.disabled;
    });
    expect(zoomLocked).toBe(true);
    await expect(timeline).toHaveAttribute('data-animating', 'false');
    await expect(head).toBeHidden();
    await page.getByRole('button', { name: 'Look closer', exact: true }).click();
    await expect(timeline).toHaveAttribute('data-animating', 'false');
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await head.press('Escape');
    await expect(page.getByRole('slider', { name: 'Song overview' })).toBeFocused();
    // A section port can open without a selection; replacing its reference emits reset.
    const reset = await page.evaluate(() => {
      let result = 'missing';
      const root = document.getElementById('timeline')!;
      root.addEventListener('lenschange', (e) => {
        result = JSON.stringify((e as CustomEvent).detail);
      });
      window.ghostTimeline.openLens({ firstBar: 1, lastBar: 2 });
      window.ghostTimeline.setReference(window.ghostReference.current);
      return result;
    });
    expect(reset).toBe('null');
    // The shell can move the same controls and connect its central session store.
    const movedSettings = await page.evaluate(() => {
      const timeline = window.ghostTimeline;
      document.body.append(timeline.settingsHost);
      let notified = false;
      document.getElementById('timeline')!.addEventListener(
        'settingschange',
        () => {
          notified = true;
        },
        { once: true },
      );
      timeline.setSettings({ selectionScope: 'band', selectionSnap: 'bars', showAudio: false });
      return { settings: timeline.settings, notified };
    });
    expect(movedSettings).toEqual({
      settings: {
        selectionScope: 'band',
        selectionSnap: 'bars',
        showAudio: false,
        viewMode: 'rows',
      },
      notified: true,
    });
    await expect(timeline.locator('[data-row="audio"]')).toHaveCount(0);
    await page.getByLabel('Stem audio').check();
    await expect(timeline.locator('[data-row="audio"]')).toHaveCount(6);
    // Replacing an opened song with a broken folder releases the timeline too.
    await writeFile(join(folder, 'song.json'), '{}');
    const again = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await again).setFiles(folder);
    await expect(timeline).toBeHidden();
    // A split detected meter asks even without a tempo-range flag.
    await writeFile(join(folder, 'song.json'), files.get('song.json')!);
    const beats = JSON.parse(new TextDecoder().decode(files.get('beats.json')));
    beats.tempo_review.flagged = false;
    beats.tempo_review.reasons = [];
    beats.downbeats = [];
    for (let i = 1, group = 0; i < beats.beats.length; group++) {
      beats.downbeats.push(beats.beats[i]);
      i += group % 2 ? 4 : 2;
    }
    await writeFile(join(folder, 'beats.json'), JSON.stringify(beats));
    const meterOpen = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await meterOpen).setFiles(folder);
    const question = page.getByRole('region', { name: 'Check tempo and bars', exact: true });
    await expect(question).toBeVisible();
    await expect(question).toContainText('with 2 beats');
    await expect(question).toContainText('with 4 beats');
    expect(
      await page.evaluate(() => window.ghostReference.current!.song.beatMap.tempoReview.flagged),
    ).toBe(false);
    const original = await page.evaluate(() => {
      const s = window.ghostReference.current!.song;
      const i = s.beatMap.beats.indexOf(s.beatMap.downbeats[0]);
      return {
        folder: window.ghostReference.current!.folder,
        one: s.beatMap.beats[i + 1],
        downbeats: s.detectedBeatMap.downbeats,
        notes: s.stems.flatMap((stem) =>
          stem.notes.map((n) => [n.startSeconds, n.endSeconds, n.pitch, n.velocity]),
        ),
      };
    });
    expect(
      await page.evaluate(
        () =>
          window.ghostReference.current!.song.stems.find((s) => s.id === 'bass')!.notes[1].start
            .bar,
      ),
    ).toBe(1);
    const buffer = await page.evaluateHandle(
      () => window.ghostReference.current!.audio.get('drums')!.buffer,
    );
    await page.getByLabel('Beats per bar', { exact: true }).selectOption('4');
    await page.getByLabel('Beat one', { exact: true }).selectOption('1');
    const previews = await question.locator('svg').evaluateAll((svgs) =>
      svgs.map((svg) => ({
        notes: [...svg.querySelectorAll('.grid-note')].map((n) => n.outerHTML),
        bars: [...svg.querySelectorAll('.grid-bar')].map((n) => n.getAttribute('x')),
      })),
    );
    expect(previews).toHaveLength(3);
    expect(previews[0].notes).toEqual(previews[1].notes);
    expect(previews[1].notes).toEqual(previews[2].notes);
    expect(previews[0].bars).not.toEqual(previews[1].bars);
    if (process.env.GHOST_GRID_SHOT)
      await question.screenshot({ path: process.env.GHOST_GRID_SHOT });
    await question.getByRole('button', { name: 'Use 1×', exact: true }).click();
    await expect(question).toBeHidden();
    const changed = await page.evaluate((buffer) => {
      const r = window.ghostReference.current!,
        s = r.song;
      return {
        folder: r.folder,
        noteBar: s.stems.find((s) => s.id === 'bass')!.notes[1].start.bar,
        meter: s.beatMap.beatsPerBar,
        one: s.beatMap.downbeats[0],
        downbeats: s.detectedBeatMap.downbeats,
        notes: s.stems.flatMap((stem) =>
          stem.notes.map((n) => [n.startSeconds, n.endSeconds, n.pitch, n.velocity]),
        ),
        sameAudio: r.audio.get('drums')!.buffer === buffer,
      };
    }, buffer);
    expect(changed).toEqual({ meter: 4, ...original, sameAudio: true, noteBar: 0 });
    await buffer.dispose();
    await page.getByRole('button', { name: 'Tempo and bars…', exact: true }).click();
    await expect(question).toBeVisible();
    await question.getByRole('button', { name: 'Keep current grid', exact: true }).click();
    await expect(question).toBeHidden();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
