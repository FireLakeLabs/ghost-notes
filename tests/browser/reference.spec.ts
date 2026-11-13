import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { test, expect } from '@playwright/test';
import { referenceFixture } from '../fixtures/reference';

test('real OPFS directory picker, session reopen and retained handle on reload', async ({
  page,
}) => {
  await page.goto('/?inspect');
  const bytes = [...referenceFixture()].map(([path, bytes]) => ({
    path,
    bytes: Array.from(bytes),
  }));
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory();
    for (const item of files) {
      const parts = item.path.split('/'),
        name = parts.pop()!;
      let dir = root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
      const file = await dir.getFileHandle(name, { create: true }),
        writer = await file.createWritable();
      await writer.write(new Uint8Array(item.bytes));
      await writer.close();
    }
    // Only the chooser is stubbed; read and persisted-handle paths use real browser handles.
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => root,
    });
  }, bytes);
  // The adapter captures the chooser at mount; install the same chooser before remount.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => navigator.storage.getDirectory(),
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
  const status = page.locator('[data-summary]');
  await expect(status).toContainText('Invented pickup — 1 stem; 3 bars + pickup; 48.00–120.00 BPM');
  await expect(status).toContainText('gaps: 4.5–6.5 s');
  await expect(status).toContainText('Tempo doubt: synthetic review');
  const pcm = await page.evaluate(() => {
    const audio = window.ghostReference.current!.audio.get('bass')!;
    return {
      channels: audio.buffer.numberOfChannels,
      length: audio.buffer.length,
      rate: audio.buffer.sampleRate,
      min: Math.min(...audio.peaks),
      max: Math.max(...audio.peaks),
      bytes: audio.pcmBytes,
    };
  });
  expect(pcm).toMatchObject({
    channels: 2,
    length: 4410,
    rate: 44100,
    bytes: 35280,
  });
  // Native decoders can normalize positive PCM16 by 32767 and negative by 32768.
  // Permit one PCM16 unit; pure waveform tests require exact extrema.
  expect(Math.abs(pcm.min + 0.5)).toBeLessThan(1 / 32768);
  expect(Math.abs(pcm.max - 0.25)).toBeLessThan(1 / 32768);
  await page.getByRole('button', { name: 'Reopen folder', exact: true }).click();
  await expect(status).toContainText('Audio decoded; waveform peaks ready.');
  await page.reload();
  await page.getByRole('button', { name: 'Reopen folder', exact: true }).click();
  await expect(status).toContainText('Invented pickup');
  await page.screenshot({ path: '/tmp/ghost-notes-reference-open.png', fullPage: true });
  await page.addInitScript(() => {
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'queryPermission', {
      configurable: true,
      value: async () => 'prompt',
    });
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'requestPermission', {
      configurable: true,
      value: async () => {
        sessionStorage.setItem(
          'permission-requests',
          String(Number(sessionStorage.getItem('permission-requests') ?? 0) + 1),
        );
        return 'granted';
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Reopen folder', exact: true }).click();
  await expect(status).toContainText('Invented pickup');
  expect(await page.evaluate(() => sessionStorage.getItem('permission-requests'))).toBe('1');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('song.json');
    const doc = JSON.parse(await (await handle.getFile()).text());
    doc.version = 2;
    const writer = await handle.createWritable();
    await writer.write(JSON.stringify(doc));
    await writer.close();
  });
  await page.getByRole('button', { name: 'Reopen folder', exact: true }).click();
  await expect(status).toContainText('Unsupported reference version');
  expect(await page.evaluate(() => window.ghostReference.current === null)).toBe(true);

  await page.evaluate(() => {
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'queryPermission', {
      configurable: true,
      value: async () => 'prompt',
    });
    Object.defineProperty(FileSystemDirectoryHandle.prototype, 'requestPermission', {
      configurable: true,
      value: async () => 'denied',
    });
  });
  await page.getByRole('button', { name: 'Reopen folder', exact: true }).click();
  await expect(status).toContainText('Read permission was not granted');
});

async function fixtureDirectory() {
  const root = await mkdtemp(join(tmpdir(), 'ghost-reference-'));
  for (const [path, bytes] of referenceFixture()) {
    const dest = join(root, 'songs', 'invented', path);
    await mkdir(join(dest, '..'), { recursive: true });
    await writeFile(dest, bytes);
  }
  await writeFile(
    join(root, 'manifest.json'),
    JSON.stringify({
      version: 1,
      pieces: [{ folder: 'songs/invented' }, { folder: 'songs/invented' }],
    }),
  );
  return root;
}
test('native folder drop chooses a source song; fallback folder input works without picker', async ({
  page,
  context,
}) => {
  const folder = await fixtureDirectory();
  try {
    await page.addInitScript(() =>
      Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
    );
    await page.goto('/?inspect');
    const box = await page.getByRole('region', { name: 'Open reference folder' }).boundingBox();
    if (!box) throw Error('Missing reference region');
    const cdp = await context.newCDPSession(page);
    const data = { items: [], files: [folder], dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver', 'drop'] as const)
      await cdp.send('Input.dispatchDragEvent', { type, x: box.x + 20, y: box.y + 20, data });
    await expect(page.locator('[data-summary]')).toHaveText(
      '2 songs found. Choose a song to open.',
    );
    await page.getByLabel('Song', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Open selected song' }).click();
    await expect(page.locator('[data-summary]')).toContainText('Invented pickup');
    // Input change is driven through the actual Open control.
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await chooser).setFiles(join(folder, 'songs', 'invented'));
    await expect(page.locator('[data-summary]')).toContainText(
      'Audio decoded; waveform peaks ready.',
    );
    const beforeCancel = await page.locator('[data-summary]').textContent();
    const cancelChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await cancelChooser;
    await page.locator('input[type=file]').dispatchEvent('cancel');
    await expect(page.getByRole('button', { name: 'Open song folder', exact: true })).toBeEnabled();
    expect(await page.locator('[data-summary]').textContent()).toBe(beforeCancel);
    await cdp.detach();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

const localRoot = join(homedir(), 'projects/ghost-notes/reference');
test('six local references decode and retain audio (anonymous report)', async ({ page }) => {
  test.skip(!existsSync(localRoot), 'Local reference material is absent');
  test.setTimeout(90_000);
  await page.addInitScript(() =>
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined }),
  );
  await page.goto('/?inspect');
  const report = [];
  for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
    const songs = join(localRoot, source, 'songs');
    let number = 0;
    for (const name of (await readdir(songs)).sort()) {
      const folder = join(songs, name);
      if (!existsSync(join(folder, 'song.json'))) continue;
      number++;
      const input = source === 'first-test-session' ? `first test session, song ${number}` : source;
      try {
        const started = performance.now();
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
        await (await chooser).setFiles(folder);
        await page.waitForFunction(
          () =>
            !document
              .querySelector('[aria-label="Open reference folder"]')!
              .hasAttribute('aria-busy'),
        );
        const row = await page.evaluate(() => {
          const ref = window.ghostReference.current;
          if (!ref) return null;
          const { song, audio } = ref;
          const tempos = song.bars.flatMap((b) => (b.bpm === null ? [] : [b.bpm]));
          return {
            bars: song.bars.filter((b) => b.number > 0).length,
            tempoMin: Math.min(...tempos),
            tempoMax: Math.max(...tempos),
            gaps: song.beatMap.coverage.gaps.length,
            stems: audio.size,
            decodeMs: [...audio.values()].reduce((n, a) => n + a.decodeMs, 0),
            peaksMs: [...audio.values()].reduce((n, a) => n + a.peaksMs, 0),
            encodedBytes: [...audio.values()].reduce((n, a) => n + a.encodedBytes, 0),
            pcmBytes: [...audio.values()].reduce((n, a) => n + a.pcmBytes, 0),
            peakBytes: [...audio.values()].reduce((n, a) => n + a.peaks.byteLength, 0),
            frames: [...audio.values()].map((a) => a.buffer.length),
            durations: [...audio.values()].map((a) => a.buffer.duration),
            duration: song.durationSeconds,
          };
        });
        if (!row || row.stems !== 6 || row.durations.some((d) => Math.abs(d - row.duration) > 0.01))
          throw Error('Audio validation failed');
        report.push({ input, ...row, openMs: performance.now() - started });
      } catch {
        await page.goto('about:blank').catch(() => {});
        throw Error(`Local browser import failed: ${input}`);
      }
    }
  }
  await page.goto('about:blank');
  expect(report.length).toBe(6);
  await writeFile(
    '/tmp/ghost-notes-reference-report.json',
    JSON.stringify({ browser: await page.context().browser()!.version(), report }, null, 2),
  );
});

test('Chromium reopens the folder just dropped, including after reload', async ({
  page,
  context,
}) => {
  const folder = await fixtureDirectory();
  try {
    await page.goto('/?inspect');
    const box = await page.getByRole('region', { name: 'Open reference folder' }).boundingBox();
    if (!box) throw Error('Missing reference region');
    const cdp = await context.newCDPSession(page);
    const data = { items: [], files: [join(folder, 'songs', 'invented')], dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver', 'drop'] as const)
      await cdp.send('Input.dispatchDragEvent', { type, x: box.x + 20, y: box.y + 20, data });
    await expect(page.locator('[data-summary]')).toContainText('Invented pickup');
    await page.reload();
    await page.getByRole('button', { name: 'Reopen folder', exact: true }).click();
    await expect(page.locator('[data-summary]')).toContainText('Invented pickup');
    await cdp.detach();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
