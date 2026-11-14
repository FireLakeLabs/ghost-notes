import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test, scoreReady } from './helpers';
import { timelineFixture } from '../fixtures/timeline';

let folder = '';
test.beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'ghost-lens-editing-'));
  const files = timelineFixture();
  const notes = JSON.parse(new TextDecoder().decode(files.get('notes.json')));
  for (const id of Object.keys(notes.stems))
    notes.stems[id] = Array.from({ length: 20 }, (_, i) => [
      0.5 + i * 2,
      0.7 + i * 2,
      id === 'drums' ? 35 : 48,
      90,
    ]);
  files.set('notes.json', new TextEncoder().encode(JSON.stringify(notes)));
  for (const [path, bytes] of files) {
    await mkdir(join(folder, path, '..'), { recursive: true });
    await writeFile(join(folder, path), bytes);
  }
});
test.afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});
async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
  );
  await page.goto('/?inspect');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
  await (await chooser).setFiles(folder);
  await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
  await page.getByLabel('First bar', { exact: true }).fill('1');
  await page.getByLabel('Last bar', { exact: true }).fill('4');
  await page.locator('#timeline').getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Make section', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Make section', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Verse');
  await dialog.getByRole('button', { name: 'Make section', exact: true }).click();
  await scoreReady(page);
  await page.getByLabel('Split off bars 5–8', { exact: true }).click();
  await scoreReady(page);
  const id = await page.evaluate(
    () => window.odmApp.state.sections.find((p) => p.source?.fromBar === 5)!.id,
  );
  await page.locator(`[data-place="${id}"]`).click();
  await page.evaluate(() => window.ghostTimeline.openLens({ firstBar: 5, lastBar: 7 }));
  await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
  await page.getByLabel('Bar to edit', { exact: true }).selectOption('6');
}
const bassAnswers = (page: Page) =>
  page.evaluate(() => {
    const app = window.odmApp,
      row = app.state.rows.find((r) => r.pattern.stem === 'bass')!;
    return app.state.sections
      .filter((p) => p.source)
      .map((p) =>
        app.state.events[row.id].events
          .filter(
            (e) =>
              e.hasOnset && e.whole && e.whole[0] >= p.start && e.whole[0] < p.start + p.cycles,
          )
          .map((e) => [e.whole, e.value]),
      );
  });
test('adding and removing a lens rewrite addresses only the chosen bar of the split place', async ({
  page,
}) => {
  await open(page);
  const before = await bassAnswers(page);
  await page.getByRole('button', { name: 'Add rewrite to bass', exact: true }).click();
  await page.locator('#editor').getByRole('button', { name: 'Add rev', exact: true }).click();
  await scoreReady(page);
  const after = await bassAnswers(page);
  expect(after[0]).toEqual(before[0]);
  expect(after[1]).not.toEqual(before[1]);
  expect(
    after[1].filter((e, i) => JSON.stringify(e) !== JSON.stringify(before[1][i])),
  ).toHaveLength(1);
  await expect(page.locator('#editor ol').first()).toContainText('rev');
  await page
    .locator('#editor')
    .getByRole('button', { name: 'Remove rewrite', exact: true })
    .click();
  await scoreReady(page);
  expect(await bassAnswers(page)).toEqual(before);
  await expect(
    page.locator('#editor').getByRole('button', { name: 'Add rev', exact: true }),
  ).toBeVisible();
});
test('moving a lens closes an interior-bar editor and retains its unapplied source', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => window.ghostTimeline.openLens({ firstBar: 3, lastBar: 8 }));
  await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
  await page.locator('#score [data-control="rhythm"]').click();
  await page
    .locator('#editor')
    .getByRole('button', { name: 'Edit as source', exact: true })
    .click();
  await page.getByLabel('Source text', { exact: true }).fill('note("62").s("triangle")');
  await page.evaluate(() =>
    window.odmApp.select(window.odmApp.state.sections.find((p) => p.source?.fromBar === 1)!.id),
  );
  await expect(page.getByLabel('Bar to edit', { exact: true })).toHaveValue('6');
  await expect(page.getByLabel('Source text', { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.odmApp.select(window.odmApp.state.sections.find((p) => p.source?.fromBar === 5)!.id),
  );
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-later]')!.click());
  await expect(page.locator('#timeline')).toHaveAttribute('data-animating', 'false');
  await expect(page.getByLabel('Bar to edit', { exact: true })).toHaveValue('6');
  await expect(page.locator('#editor')).toBeHidden();
  await page.locator('#score [data-control="rhythm"]').click();
  await page
    .locator('#editor')
    .getByRole('button', { name: 'Edit as source', exact: true })
    .click();
  await expect(page.getByLabel('Source text', { exact: true })).toHaveValue(
    'note("62").s("triangle")',
  );
});

test('drum cells ignore rapid clicks while a playback edit is still queued', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const app = window.odmApp;
    app.follow(false);
    await app.play();
    if (!app.engine?.playing) throw Error(app.state.message || 'Playback did not start');
    const engine = app.engine!,
      original = engine.play.bind(engine);
    const release = document.createElement('button');
    release.id = 'release-lens-swap';
    document.body.append(release);
    engine.play = (...args) =>
      new Promise((resolve, reject) => {
        release.dataset.held = 'true';
        release.onclick = () => {
          engine.play = original;
          original(...args).then(
            (value) => {
              release.dataset.done = 'true';
              resolve(value);
            },
            (error) => {
              release.dataset.failed = 'true';
              reject(error);
            },
          );
        };
      });
  });
  await page.getByRole('button', { name: 'Mute bass', exact: true }).click();
  try {
    await scoreReady(page);
    await page
      .getByRole('img', { name: 'drums Mine queried arrangement', exact: true })
      .scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await expect(
      page.getByRole('grid', { name: 'Edit drums in the lens', exact: true }),
    ).toBeVisible();
    const ignored = await page.evaluate(() => {
      const app = window.odmApp;
      if (
        !Object.values(app.editor!.state.entries).some(
          (e) => e.status === 'pending' && e.revision === undefined,
        )
      )
        throw Error('The swap must still be queued');
      const doc = app.state.doc;
      const host = document.querySelector<HTMLElement>('.tl-drum-grid')!;
      const box = host.getBoundingClientRect();
      for (let i = 0; i < 2; i++)
        host.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: box.left + 2,
            clientY: box.top + box.height / 2,
          }),
        );
      return app.state.doc === doc;
    });
    expect(ignored).toBe(true);
    await expect(page.getByRole('gridcell')).toContainText('Snare, bar 5, step 1');
  } finally {
    const held = await page.evaluate(() => {
      const release = document.querySelector<HTMLButtonElement>('#release-lens-swap')!;
      release.click();
      return release.dataset.held === 'true';
    });
    if (held)
      await page
        .locator('#release-lens-swap[data-done], #release-lens-swap[data-failed]')
        .waitFor({ state: 'attached' });
    await page.evaluate(() => window.odmApp.stop());
  }
});
