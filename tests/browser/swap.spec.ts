import { expect } from '@playwright/test';
import { test, openProgram, play, swap, appSignal } from './helpers';

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test('a live edit is observed when the previous swap leaves retained history during the action', async ({
  page,
}) => {
  await openProgram(page, { source: 'setcpm(480); s("bd*32")' });
  await play(page);
  await swap(page, async () => {
    // Actual triggers roll the capped history over while the action is in flight.
    // The new swap replaces the old one, so the retained count does not increase.
    await appSignal(page, () => !window.odmApp.history.some((e) => e.type === 'swapped'));
    await page.evaluate(() => {
      const doc = window.odmApp.state.doc!;
      window.odmApp.editor!.apply({
        ...doc,
        body: doc.body.map((n) => (n.kind === 'tempo' ? { ...n, cpm: 481 } : n)),
      });
    });
  });
  expect(
    await page.evaluate(
      () => window.odmApp.history.findLast((e) => e.type === 'swapped')?.revision,
    ),
  ).toBe(2);
});
