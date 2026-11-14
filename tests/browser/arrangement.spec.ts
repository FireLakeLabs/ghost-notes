import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test, scoreReady } from './helpers';
import { timelineFixture } from '../fixtures/timeline';

test('make a linked section, reuse, split, warn, copy and reopen', async ({ page }, info) => {
  const folder = await mkdtemp(join(tmpdir(), 'ghost-arrangement-'));
  try {
    const files = timelineFixture();
    // Three identical choruses, with deliberate conversion movements and merges.
    const notes = JSON.parse(new TextDecoder().decode(files.get('notes.json')));
    for (const id of Object.keys(notes.stems))
      notes.stems[id] = [0.15, 2.5, 10.5, 18.5].flatMap((start) =>
        id === 'other'
          ? []
          : [
              [start + 0.03, start + 0.2, id === 'drums' ? 35 : 48, 90],
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
    async function open() {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
      await (await chooser).setFiles(folder);
      await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
    }
    await open();
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
    await dialog.screenshot({
      path: process.env.GHOST_SECTION_SHOT ?? info.outputPath('make-section.png'),
    });
    await dialog.getByRole('button', { name: 'Make section', exact: true }).click();
    await scoreReady(page);
    await expect(page.locator('[data-place]')).toHaveCount(3);
    await expect(page.locator('#timeline')).toHaveAttribute('data-lens', '2:2');
    const before = await page.evaluate(() => window.odmApp.state.sections.filter((p) => p.source));
    expect(before.map((p) => p.source?.fromBar)).toEqual([2, 6, 10]);
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
    await page.locator('#copy').click();
    const copy = page.getByRole('dialog', { name: 'Copy arrangement', exact: true });
    const text = await copy.locator('textarea').inputValue();
    await page.keyboard.press('Escape');
    await page.evaluate(async (text) => {
      await window.odmApp.load(text);
    }, text);
    await scoreReady(page);
    await open();
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
    await page.locator('#timeline').screenshot({ path: info.outputPath('linked-places.png') });
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
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
