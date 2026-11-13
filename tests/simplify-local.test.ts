import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { convertInstrument } from '../src/convert';
import { readReference } from '../src/reference/reader';
import {
  simplifyDrums,
  simplifyPitched,
  cleanStrays,
  joinSplitNotes,
  correctOctaves,
} from '../src/simplify';
import { assertQueried } from './simplify-proof';
import { structureStudy } from './simplify-study';
const root = process.env.GHOST_SIMPLIFY_ROOT;
test.skipIf(!root || !existsSync(root))(
  'all six anonymous songs, queried suggestions and study reproduction',
  async () => {
    if (!root) throw Error('Expected local corpus');
    let count = 0;
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      const songs = join(root, source, 'songs');
      let ordinal = 0;
      for (const name of (await readdir(songs)).sort()) {
        const folder = join(songs, name);
        if (!existsSync(join(folder, 'song.json'))) continue;
        ordinal++;
        count++;
        const label =
          source === 'first-test-session' ? `first test session, song ${ordinal}` : source;
        const song = await readReference({
          read: async (p) => new Uint8Array(await readFile(join(folder, p))),
          exists: async (p) => existsSync(join(folder, p)),
        });
        const study = structureStudy(song);
        if (count === 3)
          expect(study).toEqual({
            bars: 80,
            exact: 44,
            tolerant: 24,
            literalChars: 4655,
            compressedChars: 2645,
          });
        console.log(JSON.stringify({ input: label, study }));
        const trials = [32, 48, 64].map((cleaningVelocity) => ({
          cleaningVelocity,
          dropped: 0,
          merged: 0,
          pitchChanged: 0,
        }));
        for (const stem of song.stems) {
          const conversion = convertInstrument({ song, stemId: stem.id });
          if (stem.id === 'drums') {
            const drumTrials = [0.025, 0.05, 0.1].flatMap((maxMoveSeconds) =>
              [true, false].map((preserveFills) => {
                const s = simplifyDrums({
                  song,
                  conversion,
                  settings: { maxMoveSeconds, preserveFills },
                });
                return {
                  maxMoveSeconds,
                  preserveFills,
                  notes: s.notes.length,
                  matched: s.report.matchedNotes,
                  bytes: s.report.suggestedBytes,
                  dropped: s.changes.filter((c) => c.kind === 'dropped').length,
                  added: s.changes.filter((c) => c.kind === 'added').length,
                };
              }),
            );
            console.log(JSON.stringify({ input: label, drumTrials }));
          }
          if (stem.id !== 'drums')
            for (const trial of trials) {
              const input = {
                song,
                conversion,
                settings: { cleaningVelocity: trial.cleaningVelocity },
              };
              trial.dropped += cleanStrays(input).changes.filter(
                (c) => c.kind === 'dropped',
              ).length;
              trial.merged +=
                conversion.notes.filter((n) => n.mergedInto === null).length -
                joinSplitNotes(input).notes.length;
              trial.pitchChanged += correctOctaves(input).changes.filter(
                (c) =>
                  c.originalPitches.some((p) => p !== c.writtenPitches[0]) && c.kind === 'moved',
              ).length;
            }
          const suggestions =
            stem.id === 'drums'
              ? [simplifyDrums({ song, conversion })]
              : simplifyPitched({ song, conversion });
          await Promise.all(
            suggestions.map(async (suggestion) => {
              await assertQueried(suggestion, conversion.spans.at(-1)?.endCycle ?? 0);
              console.log(
                JSON.stringify({
                  input: label,
                  instrument: stem.id,
                  technique: suggestion.technique,
                  ...suggestion.report,
                  changes: Object.fromEntries(
                    [
                      'moved',
                      'moved-across-bar-line',
                      'shortened',
                      'merged',
                      'dropped',
                      'added',
                    ].map((k) => [k, suggestion.changes.filter((c) => c.kind === k).length]),
                  ),
                }),
              );
            }),
          );
        }
        console.log(JSON.stringify({ input: label, cleaningTrials: trials }));
      }
    }
    expect(count).toBe(6);
  },
  55000,
);
