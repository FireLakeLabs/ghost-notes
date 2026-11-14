import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test, scoreReady } from './helpers';
import { simplifyControlsFixture } from '../fixtures/simplify-controls';

async function open(page: Page) {
  const folder = await mkdtemp(join(tmpdir(), 'ghost-simplify-'));
  for (const [path, bytes] of simplifyControlsFixture()) {
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
  await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
  await page.getByLabel('First bar', { exact: true }).fill('1');
  await page.getByLabel('Last bar', { exact: true }).fill('8');
  await page.locator('#timeline').getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Make section', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Make section', exact: true })
    .getByRole('button', { name: 'Make section', exact: true })
    .click();
  await scoreReady(page);
  return folder;
}
async function count(page: Page, stem: string) {
  return page.evaluate((stem) => window.ghostTimeline.materialFor(stem)?.mine.notes.length, stem);
}
async function expectWrittenNotes(page: Page, stem: string) {
  const notes = await page.evaluate(
    (stem) =>
      window.ghostTimeline
        .materialFor(stem)
        ?.mine.notes.map((n) => [Number(n.startSeconds.toFixed(6)), n.pitch])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    stem,
  );
  expect(notes).toEqual(
    Array.from({ length: 8 }, (_, bar) =>
      [0, 0.5, 1, 1.5].map((step, i) => [
        0.5 + bar * 2 + step,
        (stem === 'drums' ? [35, 42, 38, 42] : [48, 55, 48, 55])[i],
      ]),
    ).flat(),
  );
}
test('pitched suggestion: report, marks, apply and undo from the lens', async ({ page }) => {
  const folder = await open(page);
  try {
    expect(await count(page, 'bass')).toBe(33);
    await page.getByRole('button', { name: 'Simplify this section', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Simplify section', exact: true });
    await dialog.getByLabel('Instrument to simplify').selectOption('bass');
    await dialog.getByRole('button', { name: 'Ask for suggestions', exact: true }).click();
    await dialog.getByLabel('Simplify technique').selectOption('0');
    await expect(dialog).toHaveAttribute('data-ready', 'true');
    await expect(dialog.locator('[data-report]')).toContainText(
      '97.0% of recording notes kept · 100.0%',
    );
    await expect(dialog.locator('[data-counts]')).toContainText('1 dropped');
    const canvas = dialog.getByRole('img');
    await canvas.focus();
    await canvas.press('ArrowDown');
    await expect(dialog.getByRole('tooltip')).toContainText(/Moved|recording/);
    if (process.env.GHOST_SIMPLIFY_SHOT) {
      await dialog.getByRole('button', { name: 'Ask for suggestions', exact: true }).focus();
      await dialog.screenshot({ path: process.env.GHOST_SIMPLIFY_SHOT });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await dialog
        .getByRole('button', { name: 'Apply to section', exact: true })
        .scrollIntoViewIfNeeded();
      await dialog.screenshot({
        path: process.env.GHOST_SIMPLIFY_SHOT.replace('.png', '-phone.png'),
      });
      await page.setViewportSize({ width: 1440, height: 1100 });
    }
    await dialog.getByRole('button', { name: 'Apply to section', exact: true }).click();
    await scoreReady(page);
    expect(await count(page, 'bass')).toBe(32);
    await expectWrittenNotes(page, 'bass');
    expect(await count(page, 'drums')).toBe(33);
    await page.locator('#undo').click();
    await scoreReady(page);
    expect(await count(page, 'bass')).toBe(33);
    await page.getByRole('button', { name: 'Simplify a section', exact: true }).click();
    await dialog.getByRole('button', { name: 'Ask for suggestions', exact: true }).click();
    await expect(dialog).toHaveAttribute('data-ready', 'true');
    await dialog.getByRole('button', { name: 'Limits…', exact: true }).click();
    await page.getByLabel('Maximum dropped share').fill('0');
    await page.getByLabel('Maximum dropped share').press('Tab');
    await page
      .getByRole('dialog', { name: 'Settings', exact: true })
      .getByRole('button', { name: 'Done', exact: true })
      .click();
    await expect(
      dialog.getByRole('button', { name: 'Apply to section', exact: true }),
    ).toBeDisabled();
    await expect(dialog.locator('[data-status]')).toContainText('settings changed');
    await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('drum suggestion: session limits, discard and apply from the timeline', async ({ page }) => {
  const folder = await open(page);
  try {
    await page.getByRole('button', { name: 'Simplify a section', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Simplify section', exact: true });
    await dialog.getByLabel('Instrument to simplify').selectOption('drums');
    await dialog.getByRole('button', { name: 'Limits…', exact: true }).click();
    await page.getByLabel('Protect fills').uncheck();
    await page
      .getByRole('dialog', { name: 'Settings', exact: true })
      .getByRole('button', { name: 'Done', exact: true })
      .click();
    await dialog.getByRole('button', { name: 'Ask for suggestions', exact: true }).click();
    await expect(dialog).toHaveAttribute('data-ready', 'true');
    await expect(dialog.locator('[data-counts]')).toContainText('1 dropped');
    await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
    expect(await count(page, 'drums')).toBe(33);
    await page.getByRole('button', { name: 'Simplify a section', exact: true }).click();
    await dialog.getByRole('button', { name: 'Ask for suggestions', exact: true }).click();
    await expect(dialog).toHaveAttribute('data-ready', 'true');
    await dialog.getByRole('button', { name: 'Apply to section', exact: true }).click();
    await scoreReady(page);
    expect(await count(page, 'drums')).toBe(32);
    await expectWrittenNotes(page, 'drums');
    expect(await count(page, 'bass')).toBe(33);
    await expect(page.locator('#redo')).toBeDisabled();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
