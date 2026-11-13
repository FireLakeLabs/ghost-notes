import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { convertInstrument } from '../src/convert';
import { readReference } from '../src/reference/reader';
import { combinedTiming, roundTripProof } from './convert-proof';
import { queryEventsNode } from './node-query';

// Opt in: keep private-corpus work outside CI and its 60-second Node budget.
const root = process.env.GHOST_CONVERT_ROOT;
test.skipIf(!root || !existsSync(root))(
  'six anonymous local songs: every stem, every note, real Strudel round trip',
  async () => {
    if (!root) throw Error('Expected local corpus root');
    let count = 0;
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      const songs = join(root, source, 'songs');
      let sourceSong = 0;
      for (const name of (await readdir(songs)).sort()) {
        const folder = join(songs, name);
        if (!existsSync(join(folder, 'song.json'))) continue;
        sourceSong++;
        const label =
          source === 'first-test-session'
            ? `first test session, song ${sourceSong}`
            : sourceSong === 1
              ? source
              : `${source}, song ${sourceSong}`;
        // Reader errors are sanitized. Never print names, paths, notes or code.
        const song = await readReference({
          read: async (p) => new Uint8Array(await readFile(join(folder, p))),
          exists: async (p) => existsSync(join(folder, p)),
        });
        const midiProofs: ReturnType<typeof roundTripProof>[] = [];
        const proofs: ReturnType<typeof roundTripProof>[] = [];
        let bytes = 0,
          moved = 0,
          uncovered = 0;
        for (const stem of song.stems) {
          const conversion = convertInstrument({ grid: 'exact', song, stemId: stem.id });
          const end = conversion.spans.at(-1)?.endCycle ?? 0;
          const result = await queryEventsNode(conversion.source, 0, end, { timeoutMs: 15000 });
          const proof = roundTripProof(song, conversion, stem.notes, result);
          expect(proof.once, `${label}/${stem.id}`).toBe(stem.notes.length);
          expect(proof.missing, `${label}/${stem.id}`).toBe(0);
          expect(proof.duplicated, `${label}/${stem.id}`).toBe(0);
          expect(proof.timing.milliseconds.max, `${label}/${stem.id}`).toBeLessThanOrEqual(1.00001);
          expect(proof.timing.beats.max, `${label}/${stem.id}`).toBeLessThanOrEqual(
            1 / 1024 + 1e-8,
          );
          expect(proof.durationMaxMs, `${label}/${stem.id}`).toBeLessThan(0.0001);
          const midiProof = roundTripProof(song, conversion, stem.midiNotes, result);
          expect(midiProof.once, `${label}/${stem.id} MIDI`).toBe(stem.midiNotes.length);
          expect(midiProof.missing, `${label}/${stem.id} MIDI`).toBe(0);
          expect(midiProof.duplicated, `${label}/${stem.id} MIDI`).toBe(0);
          midiProofs.push(midiProof);
          proofs.push(proof);
          bytes += Buffer.byteLength(conversion.source);
          moved += conversion.changes.filter((c) => c.kind === 'moved').length;
          uncovered += conversion.notes.filter(
            (n) => conversion.spans[n.spanIndex].kind === 'uncovered',
          ).length;
        }
        console.log(
          JSON.stringify({
            input: label,
            stems: proofs.length,
            notes: proofs.reduce((n, p) => n + p.notes, 0),
            once: proofs.reduce((n, p) => n + p.once, 0),
            missing: proofs.reduce((n, p) => n + p.missing, 0),
            duplicated: proofs.reduce((n, p) => n + p.duplicated, 0),
            timing: combinedTiming(proofs),
            midiTiming: combinedTiming(midiProofs),
            durationMaxMs: Math.max(...proofs.map((p) => p.durationMaxMs)),
            bytes,
            moved,
            uncovered,
          }),
        );
        count++;
      }
    }
    expect(count).toBe(6);
  },
  55000,
);
