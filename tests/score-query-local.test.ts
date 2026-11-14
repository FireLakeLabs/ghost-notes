import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { importStrudel } from '../src/import';
import { generate } from '../src/generate';
import { instruments, sections } from '../src/document';
import { makeSectionFromRange } from '../src/document/edits/section-from-range';
import { readReference } from '../src/reference/reader';
import { createNodeQueryPool } from '../src/strudel/evaluate-node';
import { scoreRows } from '../src/strudel/score-rows';
import type { Doc } from '../src/document';

const mode = process.env.GHOST_SCORE_SURVEY;
const pool = createNodeQueryPool(2);
afterAll(() => pool.close());
async function compare(doc: Doc, end: number) {
  const rows = instruments(doc);
  const answer = await pool.query(generate(doc, { instrumentTags: true }), 0, end);
  const grouped = scoreRows(
    answer,
    rows.map((row) => row.id),
  );
  if (!grouped) return { grouped: false, rows: rows.length, onsets: 0, end, legacyErrors: 0 };
  let onsets = 0,
    legacyErrors = 0;
  for (const row of rows) {
    const own = await pool.query(generate(doc, { only: row.id }), 0, end);
    // Do not put local music or source into an assertion diff.
    const same = JSON.stringify(grouped[row.id]) === JSON.stringify(own);
    if (!same)
      console.log(
        JSON.stringify({
          row: rows.indexOf(row),
          sameEventMultiset:
            JSON.stringify(grouped[row.id].events.map((e) => JSON.stringify(e)).sort()) ===
            JSON.stringify(own.events.map((e) => JSON.stringify(e)).sort()),
          candidateCount: grouped[row.id].events.length,
          isolatedCount: own.events.length,
          sameTempo: grouped[row.id].cps === own.cps,
        }),
      );
    expect(same, 'per-row equivalence').toBe(true);
    legacyErrors += Number(!!own.error);
    onsets += own.events.filter((e) => e.hasOnset).length;
  }
  return { grouped: !!grouped, rows: rows.length, onsets, end, legacyErrors };
}
test.skipIf(mode !== 'fixtures')(
  'repository corpus: tagged answers or explicit fallback',
  async () => {
    let eligible = 0,
      rows = 0,
      onsets = 0;
    const files = readdirSync('corpus/programs')
      .filter((name) => name.endsWith('.strudel'))
      .sort();
    for (const name of files) {
      const { doc } = importStrudel(await readFile(join('corpus/programs', name), 'utf8'));
      const last = sections(doc).at(-1);
      const proof = await compare(doc, last ? last.start + last.cycles : 16);
      eligible += Number(proof.grouped);
      rows += proof.rows;
      onsets += proof.onsets;
    }
    console.log(JSON.stringify({ programs: files.length, eligible, rows, onsets }));
  },
  55_000,
);

const root = join(homedir(), 'projects/ghost-notes/reference');
test.skipIf(mode !== 'references' || !existsSync(root))(
  'six anonymous references: eight-bar sections retain every arranged event',
  async () => {
    let ordinal = 0,
      tested = 0;
    for (const source of ['first-test-session', 'diversity-1', 'diversity-2']) {
      const directory = join(root, source, 'songs');
      for (const name of readdirSync(directory).sort()) {
        const folder = join(directory, name);
        if (!existsSync(join(folder, 'song.json'))) continue;
        ordinal++;
        if (process.env.GHOST_SCORE_SONG && ordinal !== Number(process.env.GHOST_SCORE_SONG))
          continue;
        try {
          const song = await readReference({
            read: async (path) => new Uint8Array(await readFile(join(folder, path))),
            exists: async (path) => existsSync(join(folder, path)),
          });
          const { doc } = makeSectionFromRange({
            doc: { version: 2, body: [] },
            song,
            folder: 'anonymous',
            range: { fromBar: 1, toBar: 9 },
            name: 'First eight',
            grid: 4,
          });
          const last = sections(doc).at(-1);
          if (!last) throw Error('Missing arranged place');
          const end = last.start + last.cycles;
          const proof = await compare(doc, end);
          console.log(JSON.stringify({ input: ordinal, stage: 'queried', ...proof }));
          expect(proof.grouped).toBe(true);
          expect(proof.legacyErrors).toBe(0);
          expect(proof.rows).toBe(6);
          tested++;
          console.log(
            JSON.stringify({
              input: ordinal,
              sourceNotes: song.stems.reduce((n, s) => n + s.notes.length, 0),
              ...proof,
            }),
          );
        } catch {
          throw Error('Anonymous reference equivalence failed at input ' + ordinal);
        }
      }
    }
    expect(tested).toBe(process.env.GHOST_SCORE_SONG ? 1 : 6);
  },
  55_000,
);
