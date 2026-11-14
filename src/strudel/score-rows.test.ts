import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { importStrudel } from '../import';
import { generate } from '../generate';
import { instruments, sections } from '../document';
import { queryEvents } from './evaluate';
import { scoreRows } from './score-rows';
import type { EventResult } from '../contract';

const fixtures = [
  'stack(note("c3 e3").s("sine"), note("c3 e3").s("sine"), silence)',
  `const bass = note("c2 ~ g2").s("sine");
   const keys = note("[c4,e4] g4").s("sine");
   arrange([2, stack(bass,keys)], [2, keys], [2, stack(bass,keys)]).late(.25)`,
];
test('one tagged question retains identical voices, silence, reuse and shifted spans per row', async () => {
  for (const source of fixtures) {
    const { doc } = importStrudel(source);
    const rows = instruments(doc);
    const answer = await queryEvents(generate(doc, { instrumentTags: true }), 0, 8);
    const result = scoreRows(
      answer,
      rows.map((r) => r.id),
    );
    expect(result).not.toBeNull();
    for (const row of rows) {
      const own = await queryEvents(generate(doc, { only: row.id }), 0, 8);
      expect(own.error).toBeNull();
      expect(result?.[row.id]).toEqual(own);
    }
  }
});

test('the existing arranged integration fixture has the same complete per-row answers', async () => {
  const { doc } = importStrudel(
    await readFile('corpus/programs/real-house-arranged.strudel', 'utf8'),
  );
  const rows = instruments(doc);
  const last = sections(doc).at(-1);
  const end = last ? last.start + last.cycles : 16;
  const answer = await queryEvents(generate(doc, { instrumentTags: true }), 0, end);
  const result = scoreRows(
    answer,
    rows.map((r) => r.id),
  );
  expect(result).not.toBeNull();
  for (const row of rows)
    expect(result?.[row.id]).toEqual(await queryEvents(generate(doc, { only: row.id }), 0, end));
});

test('a group arpeggio retains each row in the complete playback context', async () => {
  const { doc } = importStrudel(
    'stack(note("c3 e3").s("sine"), note("g3 b3").s("sine")).arp("0 1 0 1")',
  );
  const rows = instruments(doc);
  const result = scoreRows(
    await queryEvents(generate(doc, { instrumentTags: true }), 0, 2),
    rows.map((r) => r.id),
  );
  expect(result).not.toBeNull();
  for (const row of rows) {
    expect(result?.[row.id].events).toHaveLength(4);
    const isolated = await queryEvents(generate(doc, { only: row.id }), 0, 2);
    expect(isolated.events).toHaveLength(8);
    expect(result?.[row.id].cps).toBe(isolated.cps);
  }
});

test('an incomplete, opaque or broken whole answer asks for isolated row questions instead', () => {
  const complete: EventResult = {
    events: [
      { instrumentId: 'a', whole: [0, 1], part: [0, 1], value: { note: 60 }, hasOnset: true },
    ],
    cps: 0.5,
    error: null,
    opaqueValues: false,
  };
  expect(scoreRows(complete, ['a', 'b'])).toEqual({
    a: {
      ...complete,
      events: [{ whole: [0, 1], part: [0, 1], value: { note: 60 }, hasOnset: true }],
    },
    b: { ...complete, events: [] },
  });
  expect(scoreRows(complete, ['b'])).toBeNull();
  expect(
    scoreRows({ ...complete, events: [{ ...complete.events[0], instrumentId: undefined }] }, ['a']),
  ).toBeNull();
  expect(scoreRows({ ...complete, opaqueValues: true }, ['a'])).toBeNull();
  expect(
    scoreRows({ ...complete, error: { phase: 'query', message: 'Broken' } }, ['a']),
  ).toBeNull();
});
