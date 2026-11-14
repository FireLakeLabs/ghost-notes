import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { appSignal, scoreReady } from './helpers';
import { readReference } from '../../src/reference/reader';
import { songTime } from '../../src/engine/song-time';
import type {} from '../../src/app/main';

const root = join(homedir(), 'projects/ghost-notes/reference/first-test-session/songs');
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });
test('first local song: complete recorded clock with an eight-bar Mine arrangement', async ({
  page,
}) => {
  test.skip(!existsSync(root), 'Local reference material is absent');
  test.setTimeout(170_000);
  try {
    const folders = (await readdir(root)).sort();
    const name = folders.find((n) => existsSync(join(root, n, 'song.json')));
    if (!name) throw Error('No local fixture');
    const folder = join(root, name);
    const song = await readReference({
      read: async (path) => new Uint8Array(await readFile(join(folder, path))),
      exists: async (path) => existsSync(join(folder, path)),
    });
    const time = songTime(song);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });
      window.rowCapture = { triggers: [], stems: [], ended: false };
      const native = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
        for (const [id, audio] of window.ghostReference?.current?.audio ?? [])
          if (this.buffer === audio.buffer)
            window.rowCapture.stems.push({
              id,
              time: when,
              offset,
              rate: this.playbackRate.value,
              lead: when - this.context.currentTime,
            });
        if (duration === undefined) native.call(this, when, offset);
        else native.call(this, when, offset, duration);
      };
    });
    await page.goto('/?inspect');
    const errors: string[] = [];
    page.on('pageerror', () => errors.push('Runtime error'));
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await chooser).setFiles(folder);
    await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
    const question = page.getByRole('region', { name: 'Check tempo and bars', exact: true });
    if (await question.isVisible())
      await question.getByRole('button', { name: 'Keep current grid', exact: true }).click();
    await page.getByLabel('First bar', { exact: true }).fill('1');
    await page.getByLabel('Last bar', { exact: true }).fill('8');
    await page.locator('#timeline').getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Make section', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Make section', exact: true });
    for (const check of await dialog.getByRole('checkbox').all()) await check.uncheck();
    await dialog.getByRole('button', { name: 'Make section', exact: true }).click();
    await scoreReady(page);
    const expected = await page.evaluate(() =>
      Object.entries(window.odmApp.state.events).flatMap(([id, result]) =>
        result.events.filter((e) => e.hasOnset && e.whole).map((e) => ({ id, event: e })),
      ),
    );
    await page.evaluate(() => {
      window.odmApp.follow(true);
      const seen = new WeakSet<object>();
      window.odmApp.subscribe(() => {
        const engine = window.odmApp.engine;
        if (!engine || seen.has(engine)) return;
        seen.add(engine);
        let started = false;
        engine.subscribe((event) => {
          if (event.type === 'trigger')
            window.rowCapture.triggers.push({ ...event, lead: event.time - engine.audioTime() });
          if (event.type === 'transport') {
            if (event.playing) started = true;
            else if (started) {
              window.rowCapture.ended = true;
              started = false;
            }
          }
        });
      });
    });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await appSignal(page, () => window.rowCapture.ended);
    const actual = await page.evaluate(() => ({
      ...window.rowCapture,
      message: window.odmApp.state.message,
    }));
    const key = (id: string | undefined, cycle: number, value: unknown) =>
      JSON.stringify([
        id,
        Number(cycle.toFixed(6)),
        JSON.stringify(value, (name, v) => {
          if (['duration', 'clip', 'cps'].includes(name)) return undefined;
          return v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
            : v;
        }),
      ]);
    const remaining = new Map<string, typeof expected>();
    for (const entry of expected) {
      const whole = entry.event.whole;
      if (!whole) throw Error('Expected onset missing');
      const k = key(entry.id, whole[0], entry.event.value);
      remaining.set(k, [...(remaining.get(k) ?? []), entry]);
    }
    const origin = actual.stems[0]?.time;
    if (origin === undefined) throw Error('No recorded source');
    let unexpected = 0,
      maxMs = 0;
    const chords = new Map<number, number[]>();
    for (const event of actual.triggers) {
      const match = remaining.get(key(event.instrument, event.cycle, event.value))?.shift();
      if (!match?.event.whole) {
        unexpected++;
        continue;
      }
      const cycle = match.event.whole[0];
      maxMs = Math.max(maxMs, Math.abs(event.time - origin - time.toSeconds(cycle)) * 1000);
      chords.set(cycle, [...(chords.get(cycle) ?? []), event.time]);
    }
    const missing = [...remaining.values()].reduce((n, entries) => n + entries.length, 0);
    const report = {
      input: 'first test session, song 1',
      durationSeconds: song.durationSeconds,
      expected: expected.length,
      triggers: actual.triggers.length,
      stems: actual.stems.length,
      missing,
      unexpected,
      maxAdditionalOnsetMs: maxMs,
      maxChordSplitMs: Math.max(
        0,
        ...[...chords.values()].map((times) => (Math.max(...times) - Math.min(...times)) * 1000),
      ),
      stemDeviationMs: Math.max(...actual.stems.map((s) => Math.abs(s.time - origin) * 1000)),
      minimumLeadMs: Math.min(...actual.triggers.map((e) => e.lead)) * 1000,
      runtimeErrors: errors.length,
      playbackError: !!actual.message,
    };
    await writeFile('/tmp/ghost-notes-playback-report.json', JSON.stringify(report, null, 2));
    console.log('LOCAL ROW PLAYBACK MEASURED', JSON.stringify(report));
    expect(report.missing).toBe(0);
    expect(report.unexpected).toBe(0);
    expect(report.triggers).toBe(report.expected);
    expect(report.expected).toBeGreaterThan(0);
    expect(report.stems).toBe(song.stems.length);
    expect(report.stemDeviationMs).toBeLessThanOrEqual(1);
    expect(report.maxAdditionalOnsetMs).toBeLessThanOrEqual(1);
    expect(report.maxChordSplitMs).toBeLessThanOrEqual(1);
    expect(report.minimumLeadMs).toBeGreaterThan(0);
    expect(report.runtimeErrors).toBe(0);
    expect(report.playbackError).toBe(false);
    for (const source of actual.stems) {
      expect(source.offset).toBe(0);
      expect(source.rate).toBe(1);
    }
    if (process.env.GHOST_PLAYBACK_REAL_SHOT) {
      await scoreReady(page);
      const row = page.locator('[data-row=mine][data-stem=drums]');
      await row.scrollIntoViewIfNeeded();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await row.screenshot({ path: process.env.GHOST_PLAYBACK_REAL_SHOT });
    }
    await page.evaluate(() => window.odmApp.stop());
  } catch {
    await page.goto('about:blank').catch(() => {});
    throw Error(
      'Local row playback failed: first test session, song 1; inspect the anonymous report locally',
    );
  }
});
