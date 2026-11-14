import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { scoreReady } from './helpers';
import type {} from '../../src/app/main';

// Private input and screenshots stay local. Only anonymous aggregates are emitted.
const root = join(homedir(), 'projects/ghost-notes/reference/first-test-session/songs');
test('first test session, song 1: simplify drums and bass through the eight-bar lens', async ({
  page,
}) => {
  test.skip(!existsSync(root), 'Local reference material is absent');
  const folders = (await readdir(root)).sort();
  const name = folders.find((n) => existsSync(join(root, n, 'song.json')));
  if (!name) throw Error('No local fixture');
  const errors: string[] = [];
  page.on('pageerror', () => errors.push('Browser runtime error'));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
  );
  await page.goto('/?inspect');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
  await (await chooser).setFiles(join(root, name));
  await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
  const question = page.getByRole('region', { name: 'Check tempo and bars', exact: true });
  if (await question.isVisible())
    await question.getByRole('button', { name: 'Keep current grid', exact: true }).click();
  await page.getByLabel('First bar', { exact: true }).fill('1');
  await page.getByLabel('Last bar', { exact: true }).fill('8');
  await page.locator('#timeline').getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Make section', exact: true }).click();
  const make = page.getByRole('dialog', { name: 'Make section', exact: true });
  for (const check of await make.getByRole('checkbox').all()) await check.uncheck();
  await make.getByRole('button', { name: 'Make section', exact: true }).click();
  await scoreReady(page);
  const results = [];
  for (const stem of ['drums', 'bass']) {
    const before = await page.evaluate(() => JSON.stringify(window.odmApp.state.doc));
    await page.getByRole('button', { name: 'Simplify this section', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Simplify section', exact: true });
    await dialog.getByLabel('Instrument to simplify').selectOption(stem);
    const start = performance.now();
    await dialog.getByRole('button', { name: 'Ask for suggestions', exact: true }).click();
    await expect(dialog).toHaveAttribute('data-ready', 'true');
    // Include painting in the person-facing observation, not just the pure algorithm.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const reportMs = performance.now() - start;
    const report = await dialog.locator('[data-report]').textContent();
    const changes = await dialog.locator('[data-counts]').textContent();
    const size = await dialog.locator('[data-size]').textContent();
    const proposals = await dialog.getByLabel('Simplify technique').locator('option').count();
    if (process.env.GHOST_SIMPLIFY_PRIVATE_SHOT)
      await dialog.screenshot({ path: `/tmp/gn-simplify-real-${stem}.png` });
    await dialog.getByRole('button', { name: 'Apply to section', exact: true }).click();
    await scoreReady(page);
    const notes = await page.evaluate(
      (stem) => window.ghostTimeline.materialFor(stem)?.mine.notes.length,
      stem,
    );
    await page.locator('#undo').click();
    await scoreReady(page);
    expect(await page.evaluate(() => JSON.stringify(window.odmApp.state.doc))).toBe(before);
    results.push({ stem, reportMs, report, changes, size, proposals, notes, undo: true });
  }
  expect(errors).toEqual([]);
  await writeFile(
    '/tmp/ghost-notes-simplify-ui-report.json',
    JSON.stringify(
      { session: 'first test session, song 1', range: '1–8', results, errors: errors.length },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      session: 'first test session, song 1',
      range: '1–8',
      results,
      errors: errors.length,
    }),
  );
});
