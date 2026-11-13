import { expect, test } from 'vitest';
import { Cyclist, pure } from '@strudel/core';
import { recoverSkipped } from './audio-pattern';

// Advance a real Cyclist's audio clock between timer callbacks, without sleeping.
// Its web-bundle copy also runs under playback-safety's throttled playback.
test('a late clock callback retains future onsets, without duplicates or a burst of past notes', async () => {
  let now = 10;
  let tick = () => {};
  const triggers: { cycle: number; time: number }[] = [];
  const scheduler = new Cyclist({
    getTime: () => now,
    setInterval: (callback: () => void) => {
      tick = callback;
      return 1;
    },
    clearInterval: () => {},
    onTrigger: (hap, _deadline, _duration, _cps, time) => {
      triggers.push({ cycle: Number(hap.whole!.begin), time });
    },
  });
  await scheduler.setPattern(recoverSkipped(pure({ s: 'hh' }).fast(16), scheduler), true);
  try {
    now = 10.27; // Cyclist skips [0.1, 0.15), including the still-future 0.125 onset.
    tick();
    expect(triggers.map((e) => e.cycle)).toEqual([0, 0.0625, 0.125, 0.1875]);
    expect(triggers[2].time).toBeCloseTo(10.36);
    now = 10.37;
    tick();
    expect(triggers.map((e) => e.cycle)).toEqual([0, 0.0625, 0.125, 0.1875, 0.25]);
    const before = triggers.length;
    now = 12; // Too late to deliver old notes: recover only deadlines still ahead.
    tick();
    expect(triggers.slice(before).map((e) => e.cycle)).toEqual([1, 1.0625]);
    expect(triggers.slice(before).every((e) => e.time > now)).toBe(true);
  } finally {
    scheduler.stop();
  }
});
