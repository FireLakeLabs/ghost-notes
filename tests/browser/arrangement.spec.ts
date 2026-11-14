import { paintTimeline } from './timeline-paint';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test, scoreReady } from './helpers';
import { timelineFixture } from '../fixtures/timeline';

async function openArrangement(page: Page) {
  const folder = await mkdtemp(join(tmpdir(), 'ghost-arrangement-'));
  const errors: string[] = [];
  page.on('pageerror', () => errors.push('Browser runtime error'));
  try {
    await page.setViewportSize({ width: 1440, height: 1100 });
    const files = timelineFixture();
    // Three identical choruses, with deliberate conversion movements and merges.
    const notes = JSON.parse(new TextDecoder().decode(files.get('notes.json')));
    for (const id of Object.keys(notes.stems))
      notes.stems[id] = [0.15, 2.5, 10.5, 18.5].flatMap((start) =>
        id === 'other'
          ? []
          : [
              [start + 0.03, start + 2.02, id === 'drums' ? 35 : 48, 90],
              [start + 0.05, start + 0.3, id === 'drums' ? 35 : 48, 90],
              [start + 0.53, start + 0.8, id === 'drums' ? 38 : 55, 80],
            ],
      );
    files.set('notes.json', new TextEncoder().encode(JSON.stringify(notes)));
    for (const [path, bytes] of files) {
      const file = join(folder, path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, bytes);
    }
    await page.addInitScript(() =>
      Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
    );
    await page.goto('/?inspect');
    async function open(directory = folder) {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
      await (await chooser).setFiles(directory);
      await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
    }
    await open();
    await expect(page.locator('[data-row="notes"]')).toHaveCount(6);
    await expect(page.locator('[data-row="mine"]')).toHaveCount(6);
    await expect(page.locator('[data-row="mine"][data-stem="bass"]')).toContainText('Unarranged');
    await page.getByLabel('First bar', { exact: true }).fill('2');
    await page.getByLabel('Last bar', { exact: true }).fill('2');
    await page.locator('#timeline').getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Make section', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Make section', exact: true });
    await dialog.getByLabel('Name', { exact: true }).fill('Chorus');
    await expect(dialog.getByRole('checkbox')).toHaveCount(2);
    for (const checkbox of await dialog.getByRole('checkbox').all())
      await expect(checkbox).toBeChecked();
    await expect(dialog.locator('[data-error]')).toBeEmpty();
    await expect(dialog.getByRole('button', { name: 'Make section', exact: true })).toBeEnabled();
    if (process.env.GHOST_SECTION_SHOT)
      await dialog.screenshot({ path: process.env.GHOST_SECTION_SHOT });
    await dialog.getByRole('button', { name: 'Make section', exact: true }).click();
    await scoreReady(page);
    await expect(page.locator('[data-place]')).toHaveCount(3);
    await expect(page.locator('#timeline')).toHaveAttribute('data-lens', '2:2');
    const drumsMine = page.getByRole('img', {
      name: 'drums Mine queried arrangement',
      exact: true,
    });
    await expect(drumsMine).toHaveAttribute('aria-description', /^6 notes/);
    await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
    await drumsMine.scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    return { folder, files, open, dialog, drumsMine, errors };
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

test('make a linked section, edit shared places, split, warn, copy and reopen', async ({
  page,
}) => {
  const { folder, files, open, dialog, drumsMine, errors } = await openArrangement(page);
  let otherFolder: string | undefined;
  try {
    const before = await page.evaluate(() => window.odmApp.state.sections.filter((p) => p.source));
    expect(before.map((p) => p.source?.fromBar)).toEqual([2, 6, 10]);
    const grid = page.getByRole('grid', { name: 'Edit drums in the lens', exact: true });
    await expect(grid).toBeVisible();
    await expect(page.locator('[data-lens-host] #score-workspace')).toBeVisible();
    await expect(
      page.locator('#score').getByRole('button', { name: 'Make sections', exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('Instrument to edit', { exact: true }).selectOption('drums');
    await page.getByRole('button', { name: 'Mute drums', exact: true }).click();
    await scoreReady(page);
    expect(
      await page.evaluate(() => window.ghostTimeline.materialFor('drums')?.places.length),
    ).toBe(3);
    await expect(drumsMine).toHaveAttribute('aria-description', /^0 notes/);
    await expect(
      page.locator('[data-row-status="mine"]').filter({ hasText: 'unmuting' }),
    ).toBeVisible();
    await page.locator('#undo').click();
    await scoreReady(page);
    await page.getByLabel('Instrument to edit', { exact: true }).selectOption('bass');
    await drumsMine.scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await grid.focus();
    await expect(grid.getByRole('gridcell')).toContainText('Kick, bar 2, step 1: in both');
    await grid.press('Enter');
    await scoreReady(page);
    await expect(drumsMine).toHaveAttribute('aria-description', /^3 notes/);
    const drumCounts = () =>
      page.evaluate(() => {
        const app = window.odmApp;
        const row = app.state.rows.find((r) => r.pattern.stem === 'drums')!;
        return app.state.sections
          .filter((p) => p.name === 'Chorus')
          .map(
            (p) =>
              app.state.events[row.id].events.filter(
                (e) =>
                  e.hasOnset &&
                  e.whole &&
                  e.whole[0] >= p.start &&
                  e.whole[0] < p.start + p.cycles &&
                  (e.value as { s?: string }).s === 'bd',
              ).length,
          );
      });
    expect(await drumCounts()).toEqual([0, 0, 0]);
    await expect(grid).toBeFocused();
    await page.locator('#undo').click();
    await scoreReady(page);
    expect(await drumCounts()).toEqual([1, 1, 1]);
    await page.getByLabel('Split off bars 6–6').click();
    await scoreReady(page);
    await expect(page.locator('[data-place]')).toHaveCount(3);
    // Replacing the selected place requires the visible whole-place acknowledgment.
    await page
      .locator('.tl-sections')
      .getByRole('button', { name: 'Make section', exact: true })
      .click();
    const takeover = dialog.locator('[data-takeover]');
    await expect(takeover).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Make section', exact: true })).toBeDisabled();
    await dialog.getByLabel('Name', { exact: true }).fill('');
    await expect(dialog.locator('[data-takeover]')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Make section', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    // A real pointer edit changes the two remaining shared places, keeping the split copy.
    await grid.scrollIntoViewIfNeeded();
    const gridBox = await grid.boundingBox();
    await grid.click({ position: { x: gridBox!.width / 32, y: gridBox!.height * 0.9 } });
    await scoreReady(page);
    expect(await drumCounts()).toEqual([0, 1, 0]);
    await expect(page.locator('[data-place]').first()).toContainText('edited');
    const bassId = await page.evaluate(
      () => window.odmApp.state.rows.find((r) => r.pattern.stem === 'bass')!.id,
    );
    await page.locator(`#score tr[data-node-id="${bassId}"] td[data-control="rhythm"]`).click();
    await expect(page.locator('[data-lens-host] #editor')).toHaveAttribute(
      'data-editor-kind',
      'rhythm',
    );
    await page.getByLabel('Note value', { exact: true }).fill('60');
    await page.getByLabel('Note value', { exact: true }).press('Enter');
    await scoreReady(page);
    await page.locator('#editor .editor-done').click();
    const editedScore = () =>
      page.evaluate(() =>
        Object.fromEntries(
          window.odmApp.state.rows.map((row) => [
            row.pattern.stem,
            window.odmApp.state.events[row.id].events
              .filter((e) => e.hasOnset)
              .map((e) => [e.whole, e.value])
              .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
          ]),
        ),
      );
    const edited = await editedScore();
    const pitches = await page.evaluate(() => {
      const app = window.odmApp,
        row = app.state.rows.find((r) => r.pattern.stem === 'bass')!;
      return app.state.sections
        .filter((p) => p.name === 'Chorus')
        .map((p) =>
          app.state.events[row.id].events
            .filter((e) => e.hasOnset && e.whole?.[0] === p.start)
            .map((e) => (e.value as { note: number }).note),
        );
    });
    expect(pitches).toEqual([[60], [48], [60]]);
    const bassRhythm = page.locator(
      `#score tr[data-node-id="${bassId}"] td[data-control="rhythm"]`,
    );
    await bassRhythm.click();
    await page
      .locator('#editor')
      .getByRole('button', { name: 'Edit as source', exact: true })
      .click();
    const sourceDraft = 'note("62").gain(0.7)';
    await page.getByLabel('Source text', { exact: true }).fill(sourceDraft);
    await page.locator('[data-close]').click();
    await expect(page.locator('#source')).toBeEnabled();
    await page.locator('[data-place]').first().click();
    await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
    await bassRhythm.click();
    await page
      .locator('#editor')
      .getByRole('button', { name: 'Edit as source', exact: true })
      .click();
    await expect(page.getByLabel('Source text', { exact: true })).toHaveValue(sourceDraft);
    await page.locator('#editor').getByRole('button', { name: 'Revert', exact: true }).click();
    await page.locator('#editor .editor-done').click();
    expect(await editedScore()).toEqual(edited);
    if (process.env.GHOST_LENS_EDIT_SHOT) {
      await paintTimeline(page);
      await page.locator('#timeline').screenshot({ path: process.env.GHOST_LENS_EDIT_SHOT });
    }
    await page.locator('#copy').click();
    const copy = page.getByRole('dialog', { name: 'Copy arrangement', exact: true });
    const text = await copy.locator('textarea').inputValue();
    await page.keyboard.press('Escape');
    await page.goto('/?inspect');
    await page.evaluate(async (text) => {
      await window.odmApp.load(text);
    }, text);
    await scoreReady(page);
    await open();
    expect(await editedScore()).toEqual(edited);
    await expect(
      page.getByRole('img', { name: 'bass Mine queried arrangement', exact: true }),
    ).toHaveAttribute('aria-description', /^6 notes/);
    await expect(page.locator('[data-place]')).toHaveCount(3);
    expect(
      await page.evaluate(() =>
        window.odmApp.state.sections
          .filter((p) => p.source && p.name === 'Chorus')
          .map((p) => p.tempo),
      ),
    ).toEqual(before.map((p) => p.tempo));
    await page.locator('[data-place]').last().click();
    await expect(page.locator('#timeline')).toHaveAttribute('data-lens', '10:10');
    await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
    if (process.env.GHOST_ROWS_SHOT) {
      await paintTimeline(page);
      await page.locator('#timeline').screenshot({
        path: process.env.GHOST_ROWS_SHOT.replace('.png', '-places.png'),
      });
    }
    await page.getByLabel('First bar', { exact: true }).fill('3');
    await page.getByLabel('Last bar', { exact: true }).fill('4');
    await page.locator('#timeline').getByRole('button', { name: 'Select', exact: true }).click();
    await page
      .locator('.tl-sections')
      .getByRole('button', { name: 'Make section', exact: true })
      .click();
    await expect(dialog.locator('[data-takeover]')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Make section', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    // Copied literal fills remain unarranged, but their actual Mine notes stay visible
    // when a lens also contains editable section cells.
    await page.locator('#copy').click();
    await copy.locator('[data-unarranged]').selectOption('literal');
    const withFills = await copy.locator('textarea').inputValue();
    await page.keyboard.press('Escape');
    await page.evaluate(async (text) => window.odmApp.load(text), withFills);
    await scoreReady(page);
    await page.evaluate(() => window.ghostTimeline.openLens({ firstBar: 0, lastBar: 2 }));
    await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
    await drumsMine.scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const unarrangedPaint = await drumsMine.evaluate((canvas: HTMLCanvasElement) => {
      const first = document.querySelector<HTMLElement>('[data-bar="1"]')!;
      const last = document.querySelector<HTMLElement>('[data-bar="2"]')!;
      const a = Math.ceil(parseFloat(first.style.left)) + 2;
      const b = Math.floor(parseFloat(last.style.left)) - 2;
      const data = canvas.getContext('2d')!.getImageData(a, 6, b - a, 74).data;
      let notes = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i] > 140 &&
          data[i + 1] > 130 &&
          data[i + 2] > 100 &&
          data[i] >= data[i + 1] &&
          data[i] - data[i + 1] < 40 &&
          data[i + 1] > data[i + 2]
        )
          notes++;
      return notes;
    });
    expect(unarrangedPaint).toBeGreaterThan(0);
    otherFolder = await mkdtemp(join(tmpdir(), 'ghost-short-reference-'));
    const shortened = JSON.parse(new TextDecoder().decode(files.get('beats.json')));
    shortened.beats = shortened.beats.slice(0, 10);
    shortened.downbeats = shortened.downbeats.filter((s: number) => s <= 4.5);
    shortened.coverage.last_beat_seconds = 4.5;
    shortened.coverage.trailing_seconds = 47.5;
    shortened.coverage.gaps = [];
    files.set('beats.json', new TextEncoder().encode(JSON.stringify(shortened)));
    for (const [path, bytes] of files) {
      const file = join(otherFolder, path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, bytes);
    }
    await open(otherFolder);
    await expect(page.locator('[data-row="mine"]')).toHaveCount(6);
    await expect(page.locator('[data-row="mine"][data-stem="bass"]')).toContainText(
      'no linked arrangement',
    );
    expect(errors).toEqual([]);
  } finally {
    await rm(folder, { recursive: true, force: true });
    if (otherFolder) await rm(otherFolder, { recursive: true, force: true });
  }
});

test('linked rows explain all differences and preserve views and visible drawing', async ({
  page,
}) => {
  const { folder, drumsMine, errors } = await openArrangement(page);
  try {
    const literal = page.getByRole('img', { name: 'drums Notes literal conversion', exact: true });
    await literal.scrollIntoViewIfNeeded();
    await literal.focus();
    const explanations = new Set<string>();
    let previousExplanation = '';
    for (let i = 0; i < 40; i++) {
      await literal.press('ArrowDown');
      const text = await page.getByRole('tooltip').textContent();
      expect(text).not.toBe(previousExplanation);
      previousExplanation = text ?? '';
      for (const name of ['Moved:', 'Moved across a bar line:', 'Shortened:', 'Merged:'])
        if (text?.includes(name)) explanations.add(name);
      if (explanations.size === 4) break;
    }
    expect(explanations.size).toBe(4);
    await literal.press('Escape');
    const orange = await literal.evaluate((c: HTMLCanvasElement) => {
      const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] > 230 && pixels[i + 1] > 100 && pixels[i + 1] < 180 && pixels[i + 2] < 140)
          return {
            x: (((i / 4) % c.width) + 0.5) / c.width,
            y: (Math.floor(i / 4 / c.width) + 0.5) / c.height,
          };
      throw Error('Expected a painted difference');
    });
    const box = await literal.boundingBox();
    await page.mouse.move(box!.x + orange.x * box!.width, box!.y + orange.y * box!.height);
    await expect(page.getByRole('tooltip')).toContainText(/Moved|Shortened|Merged/);
    async function inputPaints(stage: 'animating' | 'quiet') {
      return page.evaluate((stage) => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-stem="drums"] [data-layer="notes"]',
        )!;
        const overview = document.querySelector<HTMLCanvasElement>('.tl-overview canvas')!;
        const original = CanvasRenderingContext2D.prototype.clearRect;
        let paints = 0;
        CanvasRenderingContext2D.prototype.clearRect = function (...args) {
          paints++;
          original.apply(this, args);
        };
        try {
          if (stage === 'animating') {
            window.ghostTimeline.openLens({ firstBar: 13, lastBar: 13 });
            window.dispatchEvent(new Event('scroll'));
          }
          for (let i = 0; i < 8; i++) {
            for (const target of [canvas, overview]) {
              const rect = target.getBoundingClientRect();
              target.dispatchEvent(
                new PointerEvent('pointermove', {
                  bubbles: true,
                  clientX: rect.left + 20 + i,
                  clientY: rect.top + 10,
                }),
              );
            }
            if (stage === 'quiet')
              canvas.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
              );
          }
          return paints;
        } finally {
          CanvasRenderingContext2D.prototype.clearRect = original;
        }
      }, stage);
    }
    expect(await inputPaints('animating')).toBe(0);
    await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    expect(await inputPaints('quiet')).toBe(0);
    await page.evaluate(() => window.ghostTimeline.openLens(null));
    await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
    await page.evaluate(() => {
      const slider = document.querySelector<HTMLInputElement>('[data-zoom]')!;
      slider.value = '4';
      slider.dispatchEvent(new Event('input'));
      document.querySelector('.tl-scroll')!.scrollLeft = 0;
    });
    await literal.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await literal.focus();
    let chosenExplanation = '';
    for (let i = 0; i < 40; i++) {
      await literal.press('ArrowDown');
      const text = await page.getByRole('tooltip').textContent();
      if (text?.includes('2.530')) {
        chosenExplanation = text;
        break;
      }
    }
    expect(chosenExplanation).not.toBe('');
    await page.evaluate(() => {
      document.querySelector('.tl-scroll')!.scrollLeft = 40;
    });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await expect(page.getByRole('tooltip')).toHaveText(chosenExplanation);
    await literal.press('Escape');
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-fit]')!.click();
      window.ghostTimeline.openLens({ firstBar: 2, lastBar: 2 });
    });
    await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
    // An actual queried rewrite changes Mine, then the existing match setting
    // changes the comparison without changing the arrangement or its answers.
    await page.evaluate(() => {
      const app = window.odmApp,
        doc = structuredClone(app.state.doc!);
      doc.body.push({
        kind: 'transform',
        id: 'comparison-transpose',
        tier: 3,
        name: 'all',
        args: [
          {
            kind: 'opaque',
            code: 'p=>p.fmap(v=>v.note===undefined?v:{...v,note:Number(v.note)+12})',
          },
        ],
      });
      app.editor!.apply(doc);
    });
    await scoreReady(page);
    const bassMine = page.getByRole('img', { name: 'bass Mine queried arrangement', exact: true });
    await expect(bassMine).toHaveAttribute('aria-description', /Bar 2: 0% match/);
    await bassMine.scrollIntoViewIfNeeded();
    await bassMine.focus();
    const mineExplanations = new Set<string>();
    for (let i = 0; i < 30; i++) {
      await bassMine.press('ArrowDown');
      const text = await page.getByRole('tooltip').textContent();
      if (text?.includes('Only in yours:')) mineExplanations.add('yours');
      if (text?.includes('Only in the recording:')) mineExplanations.add('recording');
      if (mineExplanations.size === 2) break;
    }
    expect([...mineExplanations].sort()).toEqual(['recording', 'yours']);
    const beforeMatch = await bassMine.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    if (process.env.GHOST_DIFFERENCES_SHOT) {
      await paintTimeline(page);
      await page.locator('#timeline').screenshot({ path: process.env.GHOST_DIFFERENCES_SHOT });
    }
    const queried = await page.evaluate(() => JSON.stringify(window.odmApp.state.events));
    await page.locator('#settings').click();
    await page.getByLabel('Pitch match').selectOption('any-octave');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(bassMine).toHaveAttribute('aria-description', /Bar 2: 67% match/);
    await bassMine.scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    expect(await bassMine.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(beforeMatch);
    expect(await page.evaluate(() => JSON.stringify(window.odmApp.state.events))).toBe(queried);
    await page.locator('#settings').click();
    await page.getByLabel('Pitch match').selectOption('exact');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.evaluate(() => window.odmApp.editor!.undo());
    await scoreReady(page);
    await drumsMine.scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    const pixels = await drumsMine.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.getByLabel('keys view', { exact: true }).selectOption('layers');
    await expect(page.locator('[data-row="layers"][data-stem="keys"]')).toHaveCount(1);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(await drumsMine.evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(pixels);
    await page.locator('#settings').click();
    await page.evaluate(() => {
      scrollTo(0, 0);
      document.getElementById('reference-panel')!.style.height = '1200px';
    });
    await page.getByLabel('All instrument views', { exact: true }).selectOption('layers');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('[data-row="layers"]')).toHaveCount(6);
    const isPainted = () =>
      drumsMine.evaluate((c: HTMLCanvasElement) =>
        c
          .getContext('2d')!
          .getImageData(0, 0, c.width, c.height)
          .data.some((v) => v !== 0),
      );
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(await isPainted()).toBe(false);
    await page.evaluate(() => (document.getElementById('reference-panel')!.style.height = ''));
    expect(await drumsMine.evaluate((c) => c.getBoundingClientRect().top < innerHeight)).toBe(true);
    await expect.poll(isPainted).toBe(true);
    await drumsMine.focus();
    await drumsMine.press('ArrowDown');
    await expect(page.getByRole('tooltip')).toContainText(/Moved|Shortened|Merged/);
    await drumsMine.press('Escape');
    await expect(
      page.getByRole('img', { name: 'bass Mine queried arrangement', exact: true }),
    ).toHaveAttribute('aria-description', /^6 notes/);
    if (process.env.GHOST_ROWS_SHOT) {
      await paintTimeline(page);
      await page.locator('#timeline').screenshot({ path: process.env.GHOST_ROWS_SHOT });
    }
    await page.locator('#settings').click();
    await page.getByLabel('All instrument views', { exact: true }).selectOption('rows');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('[data-row="mine"]')).toHaveCount(6);
    if (process.env.GHOST_ROWS_SHOT) {
      await paintTimeline(page);
      await page.locator('#timeline').screenshot({
        path: process.env.GHOST_ROWS_SHOT.replace('.png', '-rows.png'),
      });
    }
    expect(errors).toEqual([]);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
