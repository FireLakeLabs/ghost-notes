import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { conversionGrids, convertInstrument, timingError, type WrittenNote } from '../src/convert';
import { readReference } from '../src/reference/reader';
import { generate } from '../src/generate';
import { importStrudel } from '../src/import';
import { gridRoundTripProof } from './convert-proof';
import { queryEventsNode } from './node-query';

const root = process.env.GHOST_CONVERT_ROOT;
// Select one grid and optionally one anonymous song to fit the Node wall budget.
const grid = conversionGrids.find((g) => String(g) === process.env.GHOST_CONVERT_GRID);
test.skipIf(!root || !existsSync(root) || grid === undefined)(
  'chosen grid: every stem of six anonymous songs, queried before and after ODM round trip',
  async () => {
    if (!root || grid === undefined) throw Error('Expected corpus and grid');
    let count = 0,
      ordinal = 0;
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      const songs = join(root, source, 'songs');
      let sourceSong = 0;
      for (const name of (await readdir(songs)).sort()) {
        const folder = join(songs, name);
        if (!existsSync(join(folder, 'song.json'))) continue;
        sourceSong++;
        ordinal++;
        if (process.env.GHOST_CONVERT_SONG && Number(process.env.GHOST_CONVERT_SONG) !== ordinal)
          continue;
        const label =
          source === 'first-test-session' ? `first test session, song ${sourceSong}` : source;
        const song = await readReference({
          read: async (p) => new Uint8Array(await readFile(join(folder, p))),
          exists: async (p) => existsSync(join(folder, p)),
        });
        const notes: WrittenNote[] = [];
        const changes = { moved: 0, 'moved-across-bar-line': 0, shortened: 0, merged: 0 };
        let bytes = 0,
          once = 0,
          merged = 0;
        for (const stem of song.stems) {
          const c = convertInstrument({ song, stemId: stem.id, grid });
          // Never print a real program, note, title, path or runtime error excerpt.
          try {
            for (const code of [c.source, generate(importStrudel(c.source).doc)]) {
              const result = await queryEventsNode(code, 0, c.spans.at(-1)?.endCycle ?? 0, {
                timeoutMs: 15000,
              });
              const proof = gridRoundTripProof(song, c, stem.notes, result);
              if (proof.once + proof.merged !== stem.notes.length) throw Error('Accounting failed');
            }
          } catch {
            throw Error(`${label}, ${stem.id}, grid ${grid}: round-trip proof failed`);
          }
          notes.push(...c.notes);
          once += c.notes.filter((n) => n.mergedInto === null).length;
          merged += c.notes.filter((n) => n.mergedInto !== null).length;
          for (const change of c.changes) changes[change.kind]++;
          bytes += Buffer.byteLength(c.source);
        }
        console.log(
          JSON.stringify({
            input: label,
            grid,
            stems: song.stems.length,
            notes: notes.length,
            once,
            merged,
            changes,
            movedShare: changes.moved / notes.length,
            timing: timingError(song, notes),
            bytes,
          }),
        );
        count++;
      }
    }
    expect(count).toBe(process.env.GHOST_CONVERT_SONG ? 1 : 6);
  },
  55000,
);
