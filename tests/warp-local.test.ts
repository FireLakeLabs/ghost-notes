import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { convertInstrument, cycleToSeconds } from '../src/convert';
import { songTime } from '../src/engine/song-time';
import { readReference } from '../src/reference/reader';
import { plainEvent, query } from '../src/strudel';
import { warpPattern } from '../src/strudel/warp';
import { evaluatedPattern } from './playback-fixture';

const root = process.env.GHOST_CONVERT_ROOT;
test.skipIf(!root || !existsSync(root))(
  'six local songs: every converted onset scheduled against its grid',
  async () => {
    if (!root) throw Error('Expected local corpus');
    let count = 0;
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      const songs = join(root, source, 'songs');
      let number = 0;
      for (const name of (await readdir(songs)).sort()) {
        const folder = join(songs, name);
        if (!existsSync(join(folder, 'song.json'))) continue;
        const label =
          source === 'first-test-session' ? `first test session, song ${++number}` : source;
        const song = await readReference({
          read: async (p) => new Uint8Array(await readFile(join(folder, p))),
          exists: async (p) => existsSync(join(folder, p)),
        });
        const timing = songTime(song);
        const errors: number[] = [],
          sourceErrors: number[] = [];
        let chords = 0,
          maxSplitMs = 0;
        for (const stem of song.stems) {
          const conversion = convertInstrument({ grid: 'exact', song, stemId: stem.id });
          const pattern = await evaluatedPattern(conversion.source);
          const original = query(pattern, 0, timing.toCycle(timing.end))
            .filter((h) => h.hasOnset())
            .map(plainEvent);
          const warped = query(warpPattern(pattern, timing), 0, timing.end)
            .filter((h) => h.hasOnset())
            .map(plainEvent);
          expect(warped.length).toBe(stem.notes.length);
          expect(warped.length).toBe(original.length);
          const chordTimes = new Map<number, number>();
          for (let i = 0; i < original.length; i++) {
            const cycle = original[i].whole?.[0];
            const actual = warped[i].whole?.[0];
            if (cycle === undefined || actual === undefined) throw Error('Expected onset');
            const musicalValue = (value: unknown) => {
              if (!value || typeof value !== 'object') return value;
              const {
                duration: _duration,
                clip: _clip,
                ...rest
              } = value as Record<string, unknown>;
              return rest;
            };
            expect(musicalValue(warped[i].value)).toEqual(musicalValue(original[i].value));
            errors.push(Math.abs(actual - cycleToSeconds(song, conversion.grid, cycle)) * 1000);
            const previous = chordTimes.get(cycle);
            if (previous !== undefined) {
              chords++;
              maxSplitMs = Math.max(maxSplitMs, Math.abs(actual - previous) * 1000);
            }
            chordTimes.set(cycle, actual);
          }
          // Multiset ordering by onset compares source timing without exposing music.
          const onsets = warped.map((h) => h.whole?.[0] ?? NaN).sort((a, b) => a - b);
          const expected = stem.notes.map((n) => n.startSeconds).sort((a, b) => a - b);
          for (let i = 0; i < expected.length; i++)
            sourceErrors.push(Math.abs(onsets[i] - expected[i]) * 1000);
        }
        const stats = (values: number[]) => {
          values.sort((a, b) => a - b);
          return {
            median: values[Math.ceil(values.length * 0.5) - 1] ?? 0,
            p95: values[Math.ceil(values.length * 0.95) - 1] ?? 0,
            max: values.at(-1) ?? 0,
          };
        };
        expect(stats(errors).max).toBeLessThan(0.001);
        expect(stats(sourceErrors).max).toBeLessThanOrEqual(1.00001);
        expect(maxSplitMs).toBe(0);
        console.log(
          JSON.stringify({
            input: label,
            notes: errors.length,
            warpMs: stats(errors),
            sourceMs: stats(sourceErrors),
            chords,
            maxSplitMs,
          }),
        );
        count++;
      }
    }
    expect(count).toBe(6);
  },
  55000,
);
