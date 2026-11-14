import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { expect, test } from 'vitest';
import { convertInstrument } from '../src/convert';
import { copyArrangement } from '../src/copy';
import { importStrudel } from '../src/import';
import { generateCopy } from '../src/generate';
import { readReference } from '../src/reference/reader';
import { copyOptions } from './copy-fixture';
import { queryEventsNode } from './node-query';

const root = process.env.GHOST_COPY_ROOT;
test.skipIf(!root || !existsSync(root))(
  'local arrangement copies and reopens in pinned Strudel without exposing material',
  async () => {
    if (!root) throw Error('Expected local root');
    const songs = join(root, 'first-test-session', 'songs');
    const name = (await readdir(songs)).sort().find((n) => existsSync(join(songs, n, 'song.json')));
    if (!name) throw Error('No local export');
    const folder = join(songs, name);
    const song = await readReference({
      read: async (p) => new Uint8Array(await readFile(join(folder, p))),
      exists: async (p) => existsSync(join(folder, p)),
    });
    const bars = song.bars.filter((b) => b.number > 0 && b.endSeconds > b.startSeconds);
    const fromBar = bars[0].number,
      toBar = fromBar + 2;
    const literal = convertInstrument({ song, stemId: 'bass', range: { fromBar, toBar } });
    const doc = importStrudel(
      `const verse = ${literal.expression}; $: arrange([2,verse],[2,verse]);`,
    ).doc;
    const definition = doc.body.find((n) => n.kind === 'shared' && n.name === 'verse');
    const voice = doc.body.find((n) => n.kind === 'voice');
    if (definition?.kind !== 'shared' || voice?.pattern.core.kind !== 'group')
      throw Error('Arrangement fixture failed');
    definition.pattern.source = { folder: basename(folder), fromBar, toBar };
    definition.pattern.edited = true;
    definition.pattern.stem = 'bass';
    voice.pattern.core.parts.forEach((p, i) => {
      p.source = { folder: basename(folder), fromBar: fromBar + i * 2, toBar: toBar + i * 2 };
    });
    const copy = copyArrangement({
      doc,
      song,
      folder: basename(folder),
      options: { ...copyOptions, unarranged: 'literal' },
    });
    const original = await queryEventsNode(copy.text, 0, copy.seconds!, { timeoutMs: 15000 });
    const pasted = await queryEventsNode(
      generateCopy(importStrudel(copy.text).doc),
      0,
      copy.seconds!,
      {
        timeoutMs: 15000,
      },
    );
    expect(original.error).toBeNull();
    expect(pasted.error).toBeNull();
    expect(pasted.events).toEqual(original.events);
    expect(original.events.filter((e) => e.hasOnset).length).toBeGreaterThan(0);
    console.log(
      'LOCAL COPY',
      JSON.stringify({
        events: original.events.filter((e) => e.hasOnset).length,
        seconds: copy.seconds,
        roundTripEqual: true,
      }),
    );
  },
  55000,
);
