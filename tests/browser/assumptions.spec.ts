import { test } from './helpers';
import { expect } from '@playwright/test';
import type {} from '../../src/strudel/assumptions-harness';
import {
  placeSource,
  pickupSource,
  followingSource,
  beatTimes,
  barSeconds,
  chordSource,
  heldBarSeconds,
  ALIGNMENT_SECONDS,
} from '../../src/strudel/assumptions';
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.protocol === 'https:',
    (route) => route.abort('internetdisconnected'),
  );
  await page.goto('/harness/assumptions.html');
  await page.waitForFunction(() => !!window.strudelProof);
});
for (const kind of ['place', 'pickup'] as const) {
  test(`G28/G29 scheduled ${kind}: fractional lengths and following pattern`, async ({ page }) => {
    await page.evaluate(
      (source) => window.strudelProof.play(source),
      kind === 'place' ? placeSource : pickupSource,
    );
    const count = kind === 'place' ? 24 : 10;
    await page.waitForFunction((n) => window.strudelProof.triggers.length >= n, count);
    const events = await page.evaluate((n) => {
      window.strudelProof.stop();
      return window.strudelProof.triggers.slice(0, n);
    }, count);
    expect(events).toHaveLength(count);
    for (const e of events) expect(e.lead).toBeGreaterThan(0);
    const origin = events[0].time;
    for (let i = 0; i < count; i++) {
      const local = kind === 'place' ? i % 12 : i % 5;
      const cycle =
        kind === 'place'
          ? Math.floor(i / 12) * 2.75 + (local < 8 ? local * 0.1875 : 1.5 + (local - 8) * 0.3125)
          : i * 0.25;
      const note =
        kind === 'place'
          ? ['c3', 'd3', 'e3', 'f3', 'c3', 'd3', 'e3', 'f3', 'g3', 'a3', 'b3', 'c4'][local]
          : [i < 5 ? 'c3' : 'd3', 'g3', 'a3', 'b3', 'c4'][local];
      expect(events[i].cycle).toBe(cycle);
      expect(events[i].value).toMatchObject({ note });
      expect(events[i].time - origin).toBeCloseTo(cycle / 2, 8);
      expect(events[i].duration).toBeCloseTo(
        (kind === 'place' ? (local < 8 ? 0.1875 : 0.3125) : 0.25) / 2,
        8,
      );
    }
    console.log(
      `STRUDEL ${kind} MEASURED`,
      JSON.stringify({
        count,
        maxSecondsError: Math.max(...events.map((e) => Math.abs(e.time - origin - e.cycle / 2))),
        minimumLead: Math.min(...events.map((e) => e.lead)),
      }),
    );
  });
}
test('G28 monophonic diagnostic: actual bar tempos track the map within one 50 ms query window', async ({
  page,
}) => {
  const results = [];
  for (const source of [
    followingSource,
    `setcps(${4 / beatTimes[16]}); note("c3 d3 e3 f3").s("sine")`,
  ]) {
    await page.evaluate((source) => window.strudelProof.play(source), source);
    await page.waitForFunction(() => window.strudelProof.triggers.length >= 16);
    const events = await page.evaluate(() => {
      window.strudelProof.stop();
      return window.strudelProof.triggers.slice(0, 16);
    });
    expect(events.map((e) => e.cycle)).toEqual(Array.from({ length: 16 }, (_, i) => i / 4));
    const origin = events[0].time;
    results.push({
      errors: events.map((e, i) => e.time - origin - beatTimes[i]),
      minimumLead: Math.min(...events.map((e) => e.lead)),
    });
    if (source.includes('.cps(')) {
      const scheduleErrors = events.map((e, i) => {
        const bar = Math.floor(i / 4);
        const ideal = beatTimes[bar * 4] + ((i % 4) * barSeconds[bar]) / 4;
        // Cyclist applies an onset's cps *after* dispatching it. The bar's
        // first beat reports the preceding cps; subsequent beats report the new one.
        const activeBar = i > 0 && i % 4 === 0 ? bar - 1 : bar;
        expect(e.cps).toBeCloseTo(1 / barSeconds[activeBar], 10);
        expect(e.value).toMatchObject({ cps: 1 / barSeconds[bar] });
        expect(e.lead).toBeGreaterThan(0);
        expect(Math.abs(e.time - origin - ideal)).toBeLessThan(0.003);
        return e.time - origin - ideal;
      });
      console.log(
        'STRUDEL BAR SCHEDULE MEASURED',
        JSON.stringify({ maxError: Math.max(...scheduleErrors.map(Math.abs)) }),
      );
    } else {
      for (const e of events) expect(e.time - origin).toBeCloseTo((e.cycle * beatTimes[16]) / 4, 8);
    }
  }
  const maxError = Math.max(...results[0].errors.map(Math.abs));
  console.log(
    'STRUDEL FOLLOWING MEASURED',
    JSON.stringify({ tolerance: ALIGNMENT_SECONDS, maxError, results }),
  );
  expect(maxError).toBeLessThan(ALIGNMENT_SECONDS);
});

test('G19: the pinned web bundle does not register General MIDI', async ({ page }) => {
  expect(await page.evaluate(() => window.strudelProof.hasSound('sine'))).toBe(true);
  expect(await page.evaluate(() => window.strudelProof.hasSound('gm_piano'))).toBe(false);
});

for (const held of [false, true])
  test(`G28 limit: simultaneous downbeats split at ${held ? 'held' : 'drifting'} tempo changes; constant fallback preserves them`, async ({
    page,
  }) => {
    const bars = held ? heldBarSeconds : barSeconds;
    const rows = [];
    for (const source of [
      chordSource(bars),
      `setcps(${4 / bars.reduce((a, b) => a + b, 0)}); note("[c3,e3] d3 e3 f3").s("sine")`,
    ]) {
      await page.evaluate((source) => window.strudelProof.play(source), source);
      await page.waitForFunction(() => window.strudelProof.triggers.length >= 20);
      const events = await page.evaluate(() => {
        window.strudelProof.stop();
        return window.strudelProof.triggers.slice(0, 20);
      });
      expect(events).toHaveLength(20);
      const origin = events[0].time;
      const splits = [];
      for (let bar = 0; bar < 4; bar++) {
        const pair = events.filter((e) => e.cycle === bar);
        expect(pair).toHaveLength(2);
        expect(pair.map((e) => e.value)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ note: 'c3' }),
            expect.objectContaining({ note: 'e3' }),
          ]),
        );
        splits.push(Math.abs(pair[1].time - pair[0].time));
      }
      rows.push({ splits, maxSplit: Math.max(...splits) });
      if (!source.includes('.cps(')) {
        for (const e of events)
          expect(e.time - origin).toBeCloseTo((e.cycle * bars.reduce((a, b) => a + b, 0)) / 4, 8);
        expect(rows.at(-1)!.maxSplit).toBeLessThan(1e-9);
      }
    }
    console.log('STRUDEL CHORD LIMIT MEASURED', JSON.stringify({ held, rows }));
    expect(rows[0].maxSplit).toBeCloseTo(held ? 0.12 : 0.04, 3);
    expect(rows[0].maxSplit).toBeGreaterThan(0.003);
    if (held) expect(rows[0].maxSplit).toBeGreaterThan(ALIGNMENT_SECONDS);
  });
