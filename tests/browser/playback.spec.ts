import { expect } from '@playwright/test';
import { test } from './helpers';
import type {} from '../../src/strudel/playback-harness';

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });
test('whole song warp, stems, live tempo edits, seek, restart and modes share one audio clock', async ({
  page,
}) => {
  await page.route(
    (url) => url.protocol === 'https:',
    (route) => route.abort('internetdisconnected'),
  );
  await page.addInitScript(() => {
    window.playbackInitError = '';
    window.addEventListener('error', (event) => {
      window.playbackInitError = event.message;
    });
  });
  await page.goto('/harness/playback.html');
  await page.waitForFunction(() => !!window.playbackProof || !!window.playbackInitError);
  expect(await page.evaluate(() => window.playbackInitError)).toBe('');
  await page.evaluate(() =>
    window.playbackProof.playback.play({ code: 'setcpm(10);\n' + window.playbackProof.source }),
  );
  await page.waitForFunction(() => window.playbackProof.triggers.length >= 8);
  await page.evaluate(() =>
    window.playbackProof.playback.update('setcpm(999);\n' + window.playbackProof.source),
  );
  await page.waitForFunction(() => !window.playbackProof.playback.state().playing);
  const first = await page.evaluate(() => {
    const p = window.playbackProof;
    return {
      triggers: [...p.triggers],
      stems: [...p.stems],
      events: [...p.events],
      expected: p.expected,
      written: p.written,
      state: p.playback.state(),
    };
  });
  expect(first.triggers).toHaveLength(first.expected.length * 2);
  expect(first.stems.map((s) => s.stem).sort()).toEqual(['bass', 'keys']);
  const origin = first.stems[0].time;
  const times = first.triggers.map((t) => t.time).sort((a, b) => a - b);
  const errors = times.map(
    (t, i) => Math.abs(t - origin - first.expected[Math.floor(i / 2)]) * 1000,
  );
  const gridErrors = times.map((t, i) => Math.abs(t - origin - first.written[i]) * 1000);
  expect(Math.max(...gridErrors)).toBeLessThanOrEqual(1);
  const splits = times
    .filter((_, i) => i % 2 === 1)
    .map((t, i) => Math.abs(t - times[2 * i]) * 1000);
  expect(Math.max(...errors)).toBeLessThanOrEqual(1);
  expect(Math.max(...splits)).toBe(0);
  for (const stem of first.stems) {
    expect(stem.time).toBe(origin);
    expect(stem.offset).toBe(0);
    expect(stem.rate).toBe(1);
    expect(stem.lead).toBeGreaterThan(0);
  }
  expect(Math.min(...first.triggers.map((t) => t.lead))).toBeGreaterThan(0);
  expect(first.events.filter((e) => e.type === 'error')).toEqual([]);
  expect(first.events.filter((e) => e.type === 'swapped')).toHaveLength(2);
  expect(first.state).toMatchObject({ playing: false, mine: false, recording: [], position: null });
  // From bar 2: the 2.5s recording offset and written bar onset share an origin.
  await page.evaluate(() => {
    const p = window.playbackProof;
    p.triggers.length = 0;
    p.stems.length = 0;
    return p.playback.play({ code: p.source, fromBar: 2, mode: 'both', stemIds: ['bass'] });
  });
  await page.waitForFunction(() => window.playbackProof.triggers.length >= 2);
  const seek = await page.evaluate(() => {
    const p = window.playbackProof;
    const result = { triggers: [...p.triggers], stems: [...p.stems], state: p.playback.state() };
    p.playback.stop();
    return result;
  });
  expect(seek.stems).toHaveLength(1);
  expect(seek.stems[0].offset).toBe(2.5);
  expect(seek.triggers[0].time).toBeCloseTo(seek.stems[0].time, 8);
  expect(seek.state).toMatchObject({
    playing: true,
    recording: ['bass'],
    mine: true,
    position: { bar: 2 },
  });
  // Restart includes the fractional pickup again, from its first note.
  await page.evaluate(() => {
    const p = window.playbackProof;
    p.triggers.length = 0;
    p.stems.length = 0;
    return p.playback.play({ code: p.source, mode: 'mine' });
  });
  await page.waitForFunction(() => window.playbackProof.triggers.length >= 4);
  const restart = await page.evaluate(() => {
    const p = window.playbackProof;
    const r = { triggers: [...p.triggers], stems: [...p.stems], state: p.playback.state() };
    p.playback.stop();
    return r;
  });
  expect(restart.stems).toEqual([]);
  expect(restart.state).toMatchObject({ mine: true, recording: [] });
  expect(restart.triggers[2].time - restart.triggers[0].time).toBeCloseTo(0.25, 8);
  await page.evaluate(() => {
    const p = window.playbackProof;
    p.triggers.length = 0;
    p.stems.length = 0;
    return p.playback.play({
      code: 'throw Error("Mine must not evaluate in Recording")',
      mode: 'recording',
      fromBar: 2,
    });
  });
  const recording = await page.evaluate(() => {
    const p = window.playbackProof;
    const r = { triggers: [...p.triggers], stems: [...p.stems], state: p.playback.state() };
    p.playback.stop();
    return r;
  });
  expect(recording.triggers).toEqual([]);
  expect(recording.stems).toHaveLength(2);
  expect(recording.state).toMatchObject({ mine: false, recording: ['bass', 'keys'] });
  const replaced = await page.evaluate(async () => {
    const p = window.playbackProof;
    const previous = p.playback;
    previous.dispose();
    previous.dispose();
    let rejected = false;
    try {
      await previous.play({ code: p.source, mode: 'mine' });
    } catch {
      rejected = true;
    }
    p.playback = await p.reopen();
    p.stems.length = 0;
    await p.playback.play({ code: 'silence', mode: 'recording', fromBar: 2 });
    const result = { rejected, stems: p.stems.length, state: p.playback.state() };
    p.playback.dispose();
    return result;
  });
  expect(replaced.rejected).toBe(true);
  expect(replaced.stems).toBe(2);
  expect(replaced.state).toMatchObject({ playing: true, recording: ['bass', 'keys'] });
  console.log(
    'WARP BROWSER',
    JSON.stringify({
      notes: times.length,
      maxMs: Math.max(...gridErrors),
      sourceMaxMs: Math.max(...errors),
      maxChordSplitMs: Math.max(...splits),
      stemStartDeviationMs: Math.max(...first.stems.map((s) => Math.abs(s.time - origin) * 1000)),
      minimumTriggerLeadMs: Math.min(...first.triggers.map((t) => t.lead)) * 1000,
      seekDeviationMs: Math.abs(seek.triggers[0].time - seek.stems[0].time) * 1000,
    }),
  );
});
