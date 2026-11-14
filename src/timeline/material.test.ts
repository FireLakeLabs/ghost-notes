import { copyArrangement } from '../copy';
import { defaultMatch, defaultSettings } from '../simplify';
import { importStrudel } from '../import';
import { expect, test } from 'vitest';
import { sectionFixture } from '../../tests/section-fixture';
import { queryEventsNode } from '../../tests/node-query';
import { makeSectionFromRange } from '../document/edits/section-from-range';
import { instruments, sections } from '../document';
import { generate } from '../generate';
import { conversionSpans } from '../convert';
import { createMaterial, type TimelineScore } from './material';

test('Mine reads queried rewrites at each linked place; changing Notes grid never changes Mine', async () => {
  const song = await sectionFixture();
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song,
    folder: 'invented',
    name: 'Verse',
    range: { fromBar: 1, toBar: 3 },
    places: [{ fromBar: 5, toBar: 7 }],
  });
  const rows = instruments(made.doc),
    places = sections(made.doc).filter((p) => p.source);
  const end = conversionSpans(song, song.bars).at(-1)!.endCycle;
  const events = Object.fromEntries(
    await Promise.all(
      rows.map(async (r) => [
        r.id,
        await queryEventsNode(generate(made.doc, { only: r.id }), 0, end),
      ]),
    ),
  );
  const score: TimelineScore = {
    doc: made.doc,
    instruments: rows,
    places,
    events,
    linked: true,
    grid: 4,
  };
  const read = createMaterial();
  const bass = song.stems.find((s) => s.id === 'bass')!;
  const a = read(song, bass, score);
  expect(a.mine.message).toBe('');
  expect(a.mine.notes).toHaveLength(8);
  expect(a.places.map((p) => [p.fromBar, p.toBar])).toEqual([
    [1, 3],
    [5, 7],
  ]);
  expect(a.mine.notes.map((n) => n.start.bar)).toEqual([1, 1, 2, 2, 5, 5, 6, 6]);
  const b = read(song, bass, { ...score, grid: 1 });
  expect(b.mine.notes).toEqual(a.mine.notes);
  const row = rows.find((r) => r.pattern.stem === 'bass')!;
  const rewritten = await queryEventsNode(
    generate(made.doc, { only: row.id }) + '\nall(p=>p.rev().fast(2));',
    0,
    end,
  );
  expect(rewritten.error).toBeNull();
  const changed = read(song, bass, { ...score, events: { ...events, [row.id]: rewritten } });
  expect(changed.mine.notes).not.toEqual(a.mine.notes);
  expect(changed.literal.notes).toEqual(a.literal.notes);
  const shifted = await queryEventsNode(
    generate(made.doc, { only: row.id }) + '\nall(p=>p.late(2));',
    0,
    end,
  );
  expect(shifted.error).toBeNull();
  const spill = read(song, bass, { ...score, events: { ...events, [row.id]: shifted } });
  expect(spill.mine.notes.map((n) => n.start.bar)).toEqual([3, 3, 4, 4, 7, 7, 8, 8]);
  expect(spill.places.map((p) => [p.fromBar, p.toBar])).toEqual([
    [1, 3],
    [5, 7],
  ]);
  const failed = read(song, bass, {
    ...score,
    events: {
      ...events,
      [row.id]: {
        ...events[row.id],
        events: [],
        error: { phase: 'query', message: 'Broken pattern' },
      },
    },
  });
  expect(failed.mine.message).toContain('Broken pattern');
  expect(failed.mine.notes).toEqual([]);
  expect(read(song, bass, { ...score, events: {} }).mine.message).toContain('Asking');
  expect(read(song, bass, { ...score, linked: false }).places).toEqual([]);
  const options = {
    unedited: 'as-made',
    unarranged: 'literal',
    grid: 4,
    simplify: defaultSettings,
    match: defaultMatch,
  } as const;
  const filled = importStrudel(
    copyArrangement({ doc: made.doc, song, folder: 'invented', options }).text,
  ).doc;
  const fillIds = new Set(
    copyArrangement({ doc: filled, song, folder: 'invented', options }, true).unarrangedPlaceIds,
  );
  const fillRows = instruments(filled);
  expect(fillRows).toHaveLength(2);
  const fillEvents = Object.fromEntries(
    await Promise.all(
      fillRows.map(async (r) => [
        r.id,
        await queryEventsNode(generate(filled, { only: r.id }), 0, end),
      ]),
    ),
  );
  const copied = read(song, bass, {
    ...score,
    doc: filled,
    instruments: fillRows,
    places: sections(filled).filter((p) => p.source && !fillIds.has(p.id)),
    events: fillEvents,
  });
  expect(copied.places).toHaveLength(2);
  expect(copied.mine.notes).toHaveLength(33);
  const missing = read(song, bass, {
    ...score,
    places: [{ ...places[0], source: { folder: 'invented', fromBar: 50, toBar: 52 } }],
  });
  expect(missing.mine.message).toContain('unavailable');
  const unsupported = {
    ...song,
    stems: song.stems.map((s) =>
      s.id === 'drums' ? { ...s, notes: s.notes.map((n) => ({ ...n, pitch: 36 })) } : s,
    ),
  };
  const kit = unsupported.stems.find((s) => s.id === 'drums')!;
  const independent = read(unsupported, kit, score);
  expect(independent.literal.message).toContain('Unsupported');
  expect(independent.mine.message).toBe('');
  expect(independent.mine.notes).toHaveLength(4);
});
