import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test, scoreReady, appSignal } from './helpers';
import { generatedWav, referenceFixture } from '../fixtures/reference';
import type { EngineEvent } from '../../src/contract';
import type {} from '../../src/app/main';

type Trigger = Extract<EngineEvent, { type: 'trigger' }> & { lead: number };
type Start = { id: string; time: number; offset: number; rate: number; lead: number };
declare global {
  interface Window {
    rowCapture: { triggers: Trigger[]; stems: Start[]; ended: boolean };
  }
}
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

async function fixture(page: Page, skew = false) {
  const folder = await mkdtemp(join(tmpdir(), 'ghost-speakers-'));
  const files = referenceFixture();
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const manifest = JSON.parse(new TextDecoder().decode(files.get('song.json')));
  files.set(
    'song.json',
    encode({
      ...manifest,
      name: 'Invented row playback',
      duration_seconds: 4,
      stems: [
        manifest.stems[0],
        { ...manifest.stems[0], id: 'keys', audio: 'stems/keys.wav', midi: 'stems/keys.mid' },
      ],
    }),
  );
  const beats = JSON.parse(new TextDecoder().decode(files.get('beats.json')));
  files.set(
    'beats.json',
    encode({
      ...beats,
      duration_seconds: 4,
      beats: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75],
      downbeats: [0.25, 1.25, 3.25],
      coverage: { ...beats.coverage, last_beat_seconds: 3.75, trailing_seconds: 0.25, gaps: [] },
      tempo_review: { ...beats.tempo_review, flagged: false, reasons: [] },
    }),
  );
  const times = [0.25, 0.5, 0.75, 1, 1.25, 1.75, 2.25, 2.75];
  files.set(
    'notes.json',
    encode({
      version: 1,
      time_unit: 'seconds',
      stems: {
        bass: times.flatMap((t, i) =>
          [60, 64].map((p) => [
            t + (skew && i === 0 ? 0.03 : 0),
            t + 0.1 + (skew && i === 0 ? 0.03 : 0),
            p,
            100,
          ]),
        ),
        keys: times.map((t) => [t, t + 0.1, 72, 80]),
      },
    }),
  );
  files.set('stems/bass.wav', generatedWav(4));
  files.set('stems/keys.wav', generatedWav(4));
  files.set('stems/keys.mid', files.get('stems/bass.mid')!);
  try {
    await page.setViewportSize({ width: 1440, height: 1100 });
    for (const [path, bytes] of files) {
      const file = join(folder, path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, bytes);
    }
    await page.route(
      (url) => url.protocol === 'https:',
      (route) => route.abort('internetdisconnected'),
    );
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });
      window.rowCapture = { triggers: [], stems: [], ended: false };
      const native = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (time = 0, offset = 0, duration?: number) {
        for (const [id, audio] of window.ghostReference?.current?.audio ?? [])
          if (this.buffer === audio.buffer)
            window.rowCapture.stems.push({
              id,
              time,
              offset,
              rate: this.playbackRate.value,
              lead: time - this.context.currentTime,
            });
        if (duration === undefined) native.call(this, time, offset);
        else native.call(this, time, offset, duration);
      };
    });
    await page.goto('/?inspect');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open song folder', exact: true }).click();
    await (await chooser).setFiles(folder);
    await expect(page.locator('#timeline')).toHaveAttribute('data-drawn', 'true');
    const question = page.getByRole('region', { name: 'Check tempo and bars', exact: true });
    if (await question.isVisible())
      await question.getByRole('button', { name: 'Keep current grid', exact: true }).click();
    await page.getByLabel('First bar', { exact: true }).fill('1');
    await page.getByLabel('Last bar', { exact: true }).fill('2');
    await page.locator('#timeline').getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Make section', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Make section', exact: true });
    for (const check of await dialog.getByRole('checkbox').all()) await check.uncheck();
    await dialog.getByRole('button', { name: 'Make section', exact: true }).click();
    await scoreReady(page);
    await page.getByLabel('bass sound', { exact: true }).selectOption('sine');
    await scoreReady(page);
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
    return { folder, times };
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

for (const preset of ['Recording', 'Mine', 'Both'] as const)
  test(`${preset} schedules exactly its selected sources on the beat-map clock`, async ({
    page,
  }) => {
    test.setTimeout(20_000);
    const { folder, times } = await fixture(page);
    try {
      await page
        .getByRole('group', { name: 'What Play plays', exact: true })
        .getByRole('button', { name: preset, exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Play bass audio', exact: true }),
      ).toHaveAttribute('aria-pressed', String(preset !== 'Mine'));
      await expect(
        page.getByRole('button', { name: 'Play bass Mine', exact: true }),
      ).toHaveAttribute('aria-pressed', String(preset !== 'Recording'));
      if (preset === 'Both') {
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('checkbox', { name: 'Stem audio', exact: true }).uncheck();
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await expect(page.locator('[data-row=audio]')).toHaveCount(0);
      }
      await page.evaluate(() => {
        window.rowCapture = { triggers: [], stems: [], ended: false };
      });
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await appSignal(page, () => window.rowCapture.ended);
      await scoreReady(page);
      expect(
        await page.evaluate(() => window.ghostTimeline.materialFor('bass')?.mine.notes.length),
      ).toBe(16);
      const result = await page.evaluate(() => ({
        ...window.rowCapture,
        sounds: window.odmApp.engine!.sounds(),
        message: window.odmApp.state.message,
      }));
      expect(result.message).toBe('');
      expect(result.stems).toHaveLength(preset === 'Mine' ? 0 : 2);
      expect(result.triggers).toHaveLength(preset === 'Recording' ? 0 : 24);
      if (result.stems.length) {
        expect(result.stems.map((s) => s.id).sort()).toEqual(['bass', 'keys']);
        for (const source of result.stems) {
          expect(source.offset).toBe(0);
          expect(source.rate).toBe(1);
          expect(source.lead).toBeGreaterThan(0);
        }
        expect(result.stems[0].time).toBe(result.stems[1].time);
      }
      const origin = result.stems[0]?.time ?? result.triggers[0].time - times[0];
      const actual = result.triggers.map((e) => ({
        seconds: Number((e.time - origin).toFixed(8)),
        value: e.value,
      }));
      const expected =
        preset === 'Recording'
          ? []
          : times.flatMap((seconds) => [
              { seconds, value: expect.objectContaining({ note: 60, s: 'sine' }) },
              { seconds, value: expect.objectContaining({ note: 64, s: 'sine' }) },
              { seconds, value: expect.objectContaining({ note: 72, s: 'triangle' }) },
            ]);
      expect(actual).toEqual(expected);
      for (const event of result.triggers) expect(event.lead).toBeGreaterThan(0);
      expect(result.sounds.every((s) => s.state === 'ready')).toBe(true);
      console.log(
        'ROW PRESET MEASURED',
        JSON.stringify({
          preset,
          triggers: result.triggers.length,
          stems: result.stems.length,
          maxMs: result.triggers.length
            ? Math.max(
                ...result.triggers.map(
                  (e, i) => Math.abs(e.time - origin - times[Math.floor(i / 3)]) * 1000,
                ),
              )
            : 0,
          minLeadMs: result.triggers.length
            ? Math.min(...result.triggers.map((e) => e.lead)) * 1000
            : null,
        }),
      );
      if (preset === 'Recording') {
        await page.evaluate(() => {
          const app = window.odmApp;
          if (!app.state.doc || !app.editor) throw Error('Missing arrangement');
          app.editor.apply({
            ...app.state.doc,
            body: [
              ...app.state.doc.body,
              {
                id: 'fixture-unmapped-voice',
                tier: 1,
                kind: 'voice',
                name: 'Unmapped',
                nameSource: 'author',
                muted: false,
                pattern: {
                  id: 'fixture-unmapped-pattern',
                  tier: 1,
                  core: { kind: 'generator', name: 'note', args: [{ kind: 'literal', value: 60 }] },
                  layers: [],
                },
              },
            ],
          });
        });
        const presets = page.getByRole('group', { name: 'What Play plays', exact: true });
        await presets.getByRole('button', { name: 'Mine', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
        await expect(presets.getByRole('status')).toContainText('without matching reference stems');
        await presets.getByRole('button', { name: 'Recording', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
      }
      if (preset === 'Both' && process.env.GHOST_PLAYBACK_SHOT) {
        for (const canvas of await page.locator('#timeline [data-layer=mine]').all()) {
          await canvas.scrollIntoViewIfNeeded();
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
        }
        await page.screenshot({ path: process.env.GHOST_PLAYBACK_SHOT, fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => window.scrollTo(0, 0));
        for (const picker of await page.locator('[data-row-sound]').all()) {
          const box = await picker.boundingBox();
          if (!box) throw Error('Sound picker is hidden');
          expect(box.width).toBe(120);
          expect(box.x + box.width).toBeLessThanOrEqual(376);
        }
        await page.screenshot({
          path: process.env.GHOST_PLAYBACK_SHOT.replace('.png', '-phone.png'),
          fullPage: true,
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
      }
    } finally {
      await page.evaluate(() => window.odmApp.stop()).catch(() => {});
      await rm(folder, { recursive: true, force: true });
    }
  });

test('individual speakers mix unsnapped MIDI and Notes, survive Layers, and stop a running selection', async ({
  page,
}) => {
  test.setTimeout(20_000);
  const { folder, times } = await fixture(page, true);
  try {
    await page
      .getByRole('group', { name: 'What Play plays', exact: true })
      .getByRole('button', { name: 'Mine', exact: true })
      .click();
    await page.getByRole('button', { name: 'Play bass Mine', exact: true }).click();
    await page.getByRole('button', { name: 'Play keys Mine', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
    for (const name of ['Play bass MIDI', 'Play bass Notes', 'Play keys Notes'])
      await page.getByRole('button', { name, exact: true }).click();
    await page.getByLabel('bass view', { exact: true }).selectOption('layers');
    await expect(page.getByRole('button', { name: 'Play bass MIDI', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const selection = await page.evaluate(() => JSON.stringify(window.ghostTimeline.selection));
    await page.evaluate(() => {
      window.rowCapture = { triggers: [], stems: [], ended: false };
    });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await appSignal(page, () => window.rowCapture.triggers.length > 0);
    await page.getByRole('button', { name: 'Play bass MIDI', exact: true }).click();
    expect(await page.evaluate(() => window.odmApp.state.playing)).toBe(false);
    expect(await page.evaluate(() => JSON.stringify(window.ghostTimeline.selection))).toBe(
      selection,
    );
    await page.getByRole('button', { name: 'Play bass MIDI', exact: true }).click();
    await page.evaluate(() => {
      window.rowCapture = { triggers: [], stems: [], ended: false };
    });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await appSignal(page, () => window.rowCapture.ended);
    const result = await page.evaluate(() => window.rowCapture);
    expect(result.stems).toEqual([]);
    expect(result.triggers).toHaveLength(40);
    const origin = Math.min(...result.triggers.map((e) => e.time)) - 0.25;
    for (const [id, count] of [
      ['reference:bass:midi', 16],
      ['reference:bass:notes', 16],
      ['reference:keys:notes', 8],
    ] as const) {
      const events = result.triggers
        .filter((e) => e.instrument === id)
        .sort((a, b) => a.time - b.time);
      expect(events).toHaveLength(count);
      events.forEach((e, i) =>
        expect(e.time - origin).toBeCloseTo(
          times[Math.floor(i / (count === 8 ? 1 : 2))] +
            (id === 'reference:bass:midi' && i < 2 ? 0.03 : 0),
          8,
        ),
      );
    }
    expect(await page.locator('#message').textContent()).toBe('');
    await page
      .getByRole('group', { name: 'What Play plays', exact: true })
      .getByRole('button', { name: 'Both', exact: true })
      .click();
    await page.getByRole('button', { name: 'Play keys Mine', exact: true }).click();
    await page.evaluate(() => {
      const keys = window.odmApp.state.rows.find((r) => r.patterns.some((p) => p.stem === 'keys'));
      if (!keys) throw Error('Missing keys');
      window.odmApp.solo(keys.id);
      window.rowCapture = { triggers: [], stems: [], ended: false };
    });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await appSignal(page, () => window.odmApp.state.playing);
    await page.evaluate(() => window.odmApp.solo(null));
    await appSignal(page, () => window.rowCapture.ended);
    const released = await page.evaluate(() => ({
      ...window.rowCapture,
      bassId: window.odmApp.state.rows.find((r) => r.patterns.some((p) => p.stem === 'bass'))?.id,
    }));
    expect(released.stems).toHaveLength(2);
    expect(released.triggers.length).toBeGreaterThanOrEqual(2);
    for (const e of released.triggers) expect(e.instrument).toBe(released.bassId);
  } finally {
    await page.evaluate(() => window.odmApp.stop()).catch(() => {});
    await rm(folder, { recursive: true, force: true });
  }
});
