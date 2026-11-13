import { scoreReady, play, openProgram, installEngineSignals, signal } from './helpers';
import { expect, test } from '@playwright/test';
import type {} from '../../src/app/main';
import type {} from '../../src/engine/harness';
import type {} from '../../src/strudel/assumptions-harness';

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });
for (const drum of ['bd', 'hh', 'cp'])
  test(`online ${drum}: loads and renders isolated PCM`, async ({ page, request }) => {
    test.skip(
      process.env.ODM_BROWSER_MODE !== 'online',
      'Local online mode only: npm run test:browser:online',
    );
    test.skip(!!process.env.CI, 'Online samples are never fetched in CI');
    try {
      const probe = await request.get(
        'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json',
        { timeout: 6500 },
      );
      test.skip(!probe.ok(), 'Offline: default sample host unavailable');
    } catch {
      test.skip(true, 'Offline: default sample host unavailable');
    }
    // Preserve the combined default-bank readiness check, then navigate to a
    // fresh document so no prior voice can contaminate the isolated PCM window.
    await openProgram(page, { source: 's("bd*2, hh*4, ~ cp")', offline: false });
    await play(page);
    for (const name of ['bd', 'hh', 'cp'])
      await expect(page.getByText(`${name}: ready`, { exact: true })).toBeVisible();
    await page.goto('/?inspect');
    await page.getByLabel('Your Strudel program').fill(`stack(s("${drum}*4"),s("~"),s("~"))`);
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await scoreReady(page);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await play(page);
    await expect(page.getByText(`${drum}: ready`, { exact: true })).toBeVisible();
    const measured = await page.evaluate(async (drum) => {
      const app = window.odmApp,
        e = app.engine!,
        tap = e.tap();
      const trigger = app.history.find((t) => t.type === 'trigger')!;
      const background = await tap.rms(trigger.time - 0.12, trigger.time - 0.02);
      const rms = await tap.rms(trigger.time + 0.005, trigger.time + 0.105);
      e.stop();
      return [{ drum, background, rms, triggerTime: trigger.time, sounds: e.sounds() }];
    }, drum);
    for (const result of measured) {
      console.log('ONLINE DRUM MEASURED (rendered PCM, threshold 0.001)', JSON.stringify(result));
      expect(result.sounds).toContainEqual({ name: result.drum, state: 'ready' });
      expect(result.rms).toBeGreaterThan(0.001);
      expect(result.rms).toBeGreaterThan(result.background * 10);
    }
  });

// Step 3: each bank is registered alone; overlapping bd names cannot hide a failure.
for (const [bank, name] of [
  ['tidal-drum-machines', 'AJKPercusyn_bd'],
  ['piano', 'piano'],
  ['Dirt-Samples', 'casio'],
  ['EmuSP12', 'bd'],
  ['vcsl', 'ballwhistle'],
  ['mridangam', 'gumki'],
  ['full-Dirt', 'arpy'],
])
  test(`online bank ${bank}: decode a representative sample and schedule it`, async ({ page }) => {
    test.skip(
      process.env.ODM_BROWSER_MODE !== 'online' || !!process.env.CI,
      'Online only; never CI',
    );
    await page.goto('/harness/assumptions.html');
    await page.waitForFunction(() => !!window.strudelProof);
    const url =
      bank === 'full-Dirt'
        ? 'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json'
        : `https://raw.githubusercontent.com/felixroos/dough-samples/main/${bank}.json`;
    const decoded = await page.evaluate(({ url, name }) => window.strudelProof.bank(url, name), {
      url,
      name,
    });
    expect(decoded.frames).toBeGreaterThan(0);
    await page.evaluate(
      (name) => window.strudelProof.play(`setcpm(120); note("c3").s("${name}")`),
      name,
    );
    await page.waitForFunction(() => window.strudelProof.triggers.length >= 2);
    const events = await page.evaluate(() => {
      window.strudelProof.stop();
      return window.strudelProof.triggers.slice(0, 2);
    });
    expect(events.map((e) => e.cycle)).toEqual([0, 1]);
    expect(events[1].time - events[0].time).toBeCloseTo(0.5, 8);
    expect(events[0].value).toMatchObject({ s: name });
    console.log('ONLINE BANK MEASURED', JSON.stringify({ bank, name, ...decoded }));
  });

test('online General MIDI: pinned soundfonts loads a real preset and schedules two pitches', async ({
  page,
}) => {
  test.skip(process.env.ODM_BROWSER_MODE !== 'online' || !!process.env.CI, 'Online only; never CI');
  await page.addInitScript(installEngineSignals);
  await page.goto('/harness/engine.html');
  await page.getByRole('button').click();
  await signal(() => page.evaluate(() => window.odm.error || !!window.odm.engine)).toBe(true);
  const result = await page.evaluate(async () => {
    const e = window.odm.engine!;
    window.odmProfileEngine(e);
    await e.play('setcps(1); note("c4 c5").s("gm_piano")');
    const ready = e.sounds();
    await window.odmUntil(
      e,
      () => window.odm.events.filter((t) => t.type === 'trigger').length >= 2,
    );
    const triggers = window.odm.events.filter((t) => t.type === 'trigger').slice(0, 2);
    const errors = window.odm.events.filter((t) => t.type === 'error');
    e.stop();
    return { ready, triggers, errors };
  });
  expect(result.ready).toEqual([{ name: 'gm_piano', state: 'ready' }]);
  expect(result.errors).toEqual([]);
  expect(result.triggers.map((t) => t.cycle)).toEqual([0, 0.5]);
  expect(result.triggers[1].time - result.triggers[0].time).toBeCloseTo(0.5, 8);
  console.log('GENERAL MIDI ONLINE MEASURED', JSON.stringify(result));
});
