import type {} from '../../src/copy/harness';
import { expect } from '@playwright/test';
import { test, openProgram } from './helpers';

test('copy panel, successful-copy marker, leave warning and session settings', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openProgram(page, { source: 'note("60 64").s("sine")' });
  const button = page.getByRole('button', {
    name: 'Copy arrangement (uncopied changes)',
    exact: true,
  });
  await expect(button).toBeVisible();
  expect(
    await page.evaluate(() => !dispatchEvent(new Event('beforeunload', { cancelable: true }))),
  ).toBe(true);
  const leave = page.waitForEvent('dialog');
  await page.evaluate(() => setTimeout(() => location.assign('/?leave'), 0));
  const warning = await leave;
  expect(warning.type()).toBe('beforeunload');
  await warning.dismiss();
  await expect(page).toHaveURL(/inspect/);
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Copy arrangement', exact: true });
  await expect(dialog.getByRole('combobox')).toHaveCount(2);
  await expect(dialog).toContainText('No reference open');
  await dialog.getByRole('button', { name: 'Copy text', exact: true }).click();
  await expect(dialog).toContainText('Copied. Paste into Strudel.');
  await expect(dialog.getByRole('button', { name: 'Copy text', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Copy text', exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('60 64');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#copy')).toHaveAttribute('data-changed', 'false');
  expect(
    await page.evaluate(() => !dispatchEvent(new Event('beforeunload', { cancelable: true }))),
  ).toBe(false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings.getByLabel('Notes grid (steps per beat)').selectOption('exact');
  await settings.getByLabel('Maximum dropped share').fill('0.2');
  await settings.getByRole('heading').click();
  await page.screenshot({ path: info.outputPath('settings.png') });
  await settings.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#copy')).toHaveAttribute('data-changed', 'true');
  await page
    .getByRole('button', { name: 'Copy arrangement (uncopied changes)', exact: true })
    .click();
  await page.screenshot({ path: info.outputPath('copy-panel.png') });
  await dialog.getByRole('button', { name: 'Copy text', exact: true }).click();
  await expect(dialog).toContainText('Copied.');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(settings.getByLabel('Notes grid (steps per beat)')).toHaveValue('exact');
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(settings.getByLabel('Notes grid (steps per beat)')).toHaveValue('4');
});

test('reopening Copy shows a changed arrangement, including linked fills', async ({
  page,
  context,
}) => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  await page.goto('/harness/copy.html');
  await page.waitForFunction(() => !!window.copyProof);
  const { files, source } = await page.evaluate(() => ({
    files: window.copyProof.files,
    source: window.copyProof.source,
  }));
  const folder = await mkdtemp(join(tmpdir(), 'ghost-copy-'));
  try {
    for (const { path, bytes } of files) {
      const target = join(folder, path);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, new Uint8Array(bytes));
    }
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() =>
      Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
    );
    await page.goto('/?inspect');
    const choose = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await choose).setFiles(folder);
    await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
    // Copy links use the selected basename, independently of the song display name.
    const { basename } = await import('node:path');
    await page
      .locator('#source')
      .fill(
        source.replaceAll(
          '"folder":"Invented copy"',
          `"folder":${JSON.stringify(basename(folder))}`,
        ),
      );
    await page.locator('#load').click();
    await page.waitForFunction(
      () =>
        window.odmApp.state.doc &&
        window.odmApp.pendingRows.size === 0 &&
        window.odmApp.state.message !== 'Asking the score…',
    );
    await page.locator('#copy').click();
    const dialog = page.getByRole('dialog', { name: 'Copy arrangement', exact: true });
    await expect(dialog).toContainText('first pass only');
    await expect(dialog.locator('[data-copy-summary]')).toContainText('will be silent');
    await dialog.locator('[data-unarranged]').selectOption('literal');
    await expect(dialog.locator('[data-copy-summary]')).toHaveText(
      '0 unarranged bars will be silent.',
    );
    await dialog.getByRole('button', { name: 'Copy text', exact: true }).click();
    await expect(dialog).toContainText('Copied.');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('#source').fill('note("72").s("sine")');
    await page.locator('#load').click();
    await expect(page.locator('#copy')).toHaveAttribute('data-changed', 'true');
    await page.locator('#copy').click();
    await expect(dialog.locator('[data-text]')).toHaveValue(/72/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
