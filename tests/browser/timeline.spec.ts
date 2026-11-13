import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect } from '@playwright/test';
import { timelineFixture } from '../fixtures/timeline';

test('folder opens the whole-song rows, pickup, gaps, waveform, contour and navigation', async ({
  page,
}, testInfo) => {
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
    await expect(timeline.locator('[data-inferred]')).toContainText('≈');
    await expect(timeline).toHaveAttribute('data-drawn', 'true');
    // Real canvas pixels: a blue waveform and contour must both have been painted.
    for (const label of [
      'bass waveform',
      'bass pitch contour',
      'drums drum lanes: Crash, Hi-hat, Snare, Tom, Kick',
    ]) {
      const blue = await page
        .getByRole('img', { name: label, exact: true })
        .evaluate((canvas: HTMLCanvasElement) => {
          const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          let n = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i + 2] > pixels[i] + 30 && pixels[i + 3] > 80) n++;
          return n;
        });
      expect(blue).toBeGreaterThan(20);
    }
    await timeline.screenshot({
      path: process.env.GHOST_TIMELINE_SHOT ?? testInfo.outputPath('timeline.png'),
    });
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
    await timeline.screenshot({
      path: (process.env.GHOST_TIMELINE_SHOT ?? testInfo.outputPath('timeline.png')).replace(
        '.png',
        '-zoom.png',
      ),
    });
    await page.getByLabel('Stem audio').uncheck();
    await expect(timeline.locator('[data-row="audio"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fit song' }).click();
    await expect(page.getByLabel('Timeline zoom')).toHaveValue('1');
    // Replacing an opened song with a broken folder releases the timeline too.
    await writeFile(join(folder, 'song.json'), '{}');
    const again = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await again).setFiles(folder);
    await expect(timeline).toBeHidden();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
