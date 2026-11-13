import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { readReference } from '../src/reference/reader';
const root = join(homedir(), 'projects/ghost-notes/reference');
test.skipIf(!existsSync(root))(
  'all six local songs satisfy the reference reader (private inputs)',
  async () => {
    let count = 0;
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      const songs = join(root, source, 'songs');
      for (const name of (await readdir(songs)).sort()) {
        const folder = join(songs, name);
        if (!existsSync(join(folder, 'song.json'))) continue;
        try {
          const song = await readReference({
            read: async (p) => new Uint8Array(await readFile(join(folder, p))),
            exists: async (p) => existsSync(join(folder, p)),
          });
          expect(song.stems.length).toBe(6);
          expect(song.bars.length).toBeGreaterThan(0);
          console.log(
            JSON.stringify({
              input:
                source === 'first-test-session' ? `first test session, song ${count + 1}` : source,
              bars: song.bars.filter((b) => b.number > 0).length,
              tempoRange: [
                Math.min(...song.bars.flatMap((b) => (b.bpm === null ? [] : [b.bpm]))),
                Math.max(...song.bars.flatMap((b) => (b.bpm === null ? [] : [b.bpm]))),
              ],
              gaps: song.beatMap.coverage.gaps.length,
              stems: song.stems.length,
            }),
          );
        } catch {
          throw Error(`Local reference import failed for anonymous song ${count + 1}`);
        }
        count++;
      }
    }
    expect(count).toBe(6);
  },
);
