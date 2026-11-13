import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { readReference } from '../src/reference/reader';
import { localBarLengths } from '../src/reference/grid';
import type { ReferenceBar } from '../src/reference/types';
const root = join(homedir(), 'projects/ghost-notes/reference');
test.skipIf(!existsSync(root))(
  'consistent grids measured on all six local songs (private inputs)',
  async () => {
    const report = [];
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      let number = 0;
      for (const name of (await readdir(join(root, source, 'songs'))).sort()) {
        const folder = join(root, source, 'songs', name);
        if (!existsSync(join(folder, 'song.json'))) continue;
        number++;
        const input =
          source === 'first-test-session' ? `first test session, song ${number}` : source;
        try {
          const song = await readReference({
            read: async (p) => new Uint8Array(await readFile(join(folder, p))),
            exists: async (p) => existsSync(join(folder, p)),
          });
          const targets = localBarLengths({
            ...song.detectedBeatMap,
            coverage: song.beatMap.coverage,
          });
          const raw = song.detectedBars.filter((b) => !b.partial);
          const measure = (bars: readonly ReferenceBar[]) => {
            const complete = bars.filter((b) => !b.partial);
            let near = 0;
            for (const bar of complete) {
              const midpoint = (bar.startSeconds + bar.endSeconds) / 2;
              const index = raw.findIndex(
                (b) => midpoint >= b.startSeconds && midpoint < b.endSeconds,
              );
              if (Math.abs((bar.endSeconds - bar.startSeconds) / targets[index] - 1) <= 0.1) near++;
            }
            const bpms = complete.flatMap((b) => (b.bpm === null ? [] : [b.bpm]));
            return {
              bars: complete.length,
              near,
              percent: Math.round((1000 * near) / complete.length) / 10,
              bpm: [Math.min(...bpms), Math.max(...bpms)].map((n) => Number(n.toFixed(2))),
            };
          };
          const counts = { merge: 0, split: 0, fill: 0, thin: 0 };
          for (const inference of song.grid.inferences) {
            if (inference.kind === 'merge-short-bars') counts.merge++;
            if (inference.kind === 'split-long-bar') counts.split++;
            if (inference.kind === 'fill-beat') counts.fill++;
            if (inference.kind === 'thin-beat') counts.thin++;
          }
          const before = measure(song.detectedBars),
            after = measure(song.bars);
          expect(after.percent).toBeGreaterThanOrEqual(before.percent);
          for (const bar of song.bars) {
            if (!bar.partial && !bar.gaps.length)
              expect(bar.endBeat - bar.startBeat).toBe(song.beatMap.beatsPerBar);
          }
          report.push({
            input,
            meter: song.beatMap.beatsPerBar,
            before,
            after,
            counts,
            gapsBefore: song.detectedBeatMap.coverage.gaps.length,
            gapsAfter: song.beatMap.coverage.gaps.length,
            levelRuns: song.beatMap.coverage.level_switches?.length,
          });
        } catch {
          throw Error(`Anonymous grid measurement failed: ${input}`);
        }
      }
    }
    expect(report).toHaveLength(6);
    console.log(JSON.stringify(report, null, 2));
    await writeFile('/tmp/ghost-grid-report.json', JSON.stringify(report, null, 2));
  },
);
