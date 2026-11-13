import { expect, test } from 'vitest';
import { secondsToPosition } from '../src/reference/beats';
import { songTime } from '../src/engine/song-time';
import { plainEvent, query } from '../src/strudel';
import { warpPattern } from '../src/strudel/warp';
import { convertInstrument } from '../src/convert';

import { fixtureSong, evaluatedPattern } from './playback-fixture';
test('warped queries follow every beat through pickup, tempo changes, drift, gap and uncovered edges', async () => {
  const song = await fixtureSong();
  // Include off-beat chords, duplicate notes and a sustain across the tempo change.
  const seconds = [0, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4.5, 5.5, 6.5, 7.5, 7.9];
  song.stems = [
    {
      ...song.stems[0],
      notes: seconds.flatMap((t) =>
        [60, 64].map((pitch) => ({
          startSeconds: t,
          endSeconds: t + 0.7,
          pitch,
          velocity: 100,
          start: secondsToPosition(song.beatMap, t),
          end: secondsToPosition(song.beatMap, t + 0.7),
        })),
      ),
    },
  ];
  const conversion = convertInstrument({ song, stemId: 'bass' });
  const time = songTime(song);
  const original = await evaluatedPattern(conversion.source);
  const warped = warpPattern(original, time);
  const events = query(warped, 0, time.end).filter((h) => h.hasOnset());
  expect(events).toHaveLength(seconds.length * 2);
  let maxMs = 0;
  for (const [i, hap] of events.entries()) {
    const expected = seconds[Math.floor(i / 2)];
    maxMs = Math.max(maxMs, Math.abs(Number(hap.whole?.begin) - expected) * 1000);
    expect(Number(hap.duration)).toBeCloseTo(0.7, 7);
    if (i % 2) expect(Number(hap.whole?.begin)).toBe(Number(events[i - 1].whole?.begin));
  }
  expect(maxMs).toBeLessThanOrEqual(1);
  // Query through many scheduler-sized windows: no dropped or repeated boundary onsets.
  const fragments = [];
  for (let i = 0; i < Math.ceil(time.end / 0.05); i++)
    fragments.push(
      ...query(warped, i * 0.05, (i + 1) * 0.05)
        .filter((h) => h.hasOnset())
        .map(plainEvent),
    );
  expect(fragments.map((h) => h.whole)).toEqual(events.map(plainEvent).map((h) => h.whole));
  expect(query(warped, time.end, time.end + 10)).toEqual([]);
  console.log('WARP NODE', JSON.stringify({ notes: events.length, maxMs }));
});

test('warp uses beat timing inside the bar, ignores score tempo controls and preserves tags', async () => {
  const song = await fixtureSong();
  const time = songTime(song);
  const p = warpPattern(
    await evaluatedPattern(
      '// mini-off\nnote("[60,64] 62 65 67").s("sine").cps(99).tag("odm:instrument:bass")',
    ),
    time,
  );
  const events = query(p, 2.5, 7.5).filter((h) => h.hasOnset());
  expect(events.map((h) => Number(h.whole?.begin)).sort((a, b) => a - b)).toEqual([
    2.5, 3.5, 4.5, 6.5, 6.5,
  ]);
  for (const hap of events) {
    expect(hap.value).not.toHaveProperty('cps');
    expect(hap.context).toMatchObject({ tags: ['odm:instrument:bass'] });
  }
});

test('non-onset fragments never become triggers when mapping collapses their times', async () => {
  const pattern = await evaluatedPattern('note("60").s("sine")');
  const warped = warpPattern(pattern, {
    start: 0,
    end: 2,
    toCycle: (s) => s,
    toSeconds: (c) => Math.round(c),
  });
  expect(query(warped, 0.01, 0.1)).toEqual([]);
});

test('plain samples retain their unset clip and duration so full slices can play', async () => {
  const time = songTime(await fixtureSong());
  const events = query(warpPattern(await evaluatedPattern('s("bd sd")'), time), 0, time.end);
  expect(events.length).toBeGreaterThan(0);
  for (const event of events) {
    expect(event.value).not.toHaveProperty('clip');
    expect(event.value).not.toHaveProperty('duration');
  }
});
