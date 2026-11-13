import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { queryEvents } from './evaluate';

const root = process.env.GHOST_BEATS_ROOT;
test.skipIf(!root || !existsSync(root))(
  'local session: query complete bars using their measured tempos (no music retained)',
  async () => {
    if (!root) return;
    const paths = (await readdir(root, { recursive: true }))
      .filter((p) => p.endsWith('/beats.json'))
      .sort();
    expect(paths).toHaveLength(4);
    for (const [index, path] of paths.entries()) {
      const data: unknown = JSON.parse(await readFile(join(root, path), 'utf8'));
      if (
        !data ||
        typeof data !== 'object' ||
        !('beats' in data) ||
        !('downbeats' in data) ||
        !Array.isArray(data.downbeats) ||
        typeof data.downbeats[0] !== 'number' ||
        !Array.isArray(data.beats) ||
        !data.beats.every((n): n is number => typeof n === 'number' && Number.isFinite(n))
      )
        throw Error('Expected finite beat times');
      const downbeatIndex = data.beats.indexOf(data.downbeats[0]);
      if (downbeatIndex < 0) throw Error('First downbeat must be a detected beat');
      const beats = data.beats.slice(downbeatIndex);
      const bars = Math.floor((beats.length - 1) / 4);
      const tempos = Array.from({ length: bars }, (_, b) => 1 / (beats[b * 4 + 4] - beats[b * 4]));
      const r = await queryEvents(`note("c3 d3 e3 f3").cps("<${tempos.join(' ')}>")`, 0, bars);
      expect(r.error).toBeNull();
      const events = r.events.filter((e) => e.hasOnset).sort((a, b) => a.part[0] - b.part[0]);
      expect(events).toHaveLength(bars * 4);
      const errors = events.map((e, i) => {
        const b = Math.floor(i / 4);
        expect(e.value).toMatchObject({ cps: tempos[b] });
        return Math.abs(beats[b * 4] + (i % 4) / (4 * tempos[b]) - beats[i]);
      });
      console.log(
        'LOCAL BEATS MEASURED',
        JSON.stringify({
          song: index + 1,
          beats: data.beats.length,
          downbeatIndex,
          queried: events.length,
          maxIdealBarErrorMs: Math.max(...errors) * 1000,
        }),
      );
    }
  },
);
