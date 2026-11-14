import { expect, test } from 'vitest';
import { checkDoc, instruments, sectionInstruments, sections, type Doc } from '../src/document';
import { setDrumCell } from '../src/document/edits/drum-cell';
import { makeSectionFromRange } from '../src/document/edits/section-from-range';
import { splitSectionPlace } from '../src/document/edits/section-split-place';
import { generate, generateCopy } from '../src/generate';
import { importStrudel } from '../src/import';
import { scoredNotes } from '../src/strudel/notes';
import { queryEventsNode } from './node-query';
import { sectionFixture } from './section-fixture';
import { lensScore, lensParts } from '../src/timeline/lens-score';
import { sheetModel } from '../src/sheet';
import { describeTarget } from '../src/document/edit';
import { setRhythmValue } from '../src/document/edits/rhythm-set';
import { addRewrite } from '../src/document/edits/rewrite-add';
import { setMuted } from '../src/document/edits/set-muted';
import { createMaterial } from '../src/timeline/material';

const accept = (doc: Doc | { ok: false; reason: string }) => {
  if ('ok' in doc) throw Error(doc.reason);
  expect(checkDoc(doc)).toEqual([]);
  return doc;
};
test('muting a section keeps its arranged bars and prevents edits to inaudible cells', async () => {
  const song = await sectionFixture();
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song,
    folder: 'invented-folder',
    name: 'Chorus',
    range: { fromBar: 1, toBar: 3 },
    places: [{ fromBar: 5, toBar: 7 }],
  });
  const row = instruments(made.doc).find((r) => r.pattern.stem === 'drums')!;
  const doc = accept(setMuted(made.doc, row.id, true));
  const material = createMaterial()(
    song,
    song.stems.find((s) => s.id === 'drums')!,
    {
      doc,
      instruments: instruments(doc),
      places: sections(doc),
      linked: true,
      grid: 4,
      events: { [row.id]: { events: [], cps: 0.5, error: null, opaqueValues: false } },
    },
  );
  expect(material.places.map((p) => p.fromBar)).toEqual([1, 5]);
  const changed = setDrumCell(doc, {
    placeId: made.placeIds[0],
    lane: 4,
    from: 0,
    to: 1 / 16,
    at: 0,
    duration: 1 / 16,
    on: true,
  });
  expect('ok' in changed && changed.ok === false).toBe(true);
});

test('a whole-program time rewrite cannot silently edit a different drum cell', async () => {
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song: await sectionFixture(),
    folder: 'invented-folder',
    name: 'Chorus',
    range: { fromBar: 1, toBar: 3 },
  });
  const doc: Doc = {
    ...made.doc,
    body: [
      ...made.doc.body,
      {
        kind: 'transform',
        id: 'outer-late',
        tier: 3,
        name: 'all',
        args: [{ kind: 'opaque', code: 'p => p.late(1)' }],
      },
    ],
  };
  const changed = setDrumCell(doc, {
    placeId: made.placeIds[0],
    lane: 4,
    from: 0,
    to: 1 / 16,
    at: 0,
    duration: 1 / 16,
    on: true,
  });
  expect('ok' in changed && changed.ok === false).toBe(true);
});
test('lens drum cell edits reach shared places, keep the split copy and survive copy/paste', async () => {
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song: await sectionFixture(),
    folder: 'invented-folder',
    name: 'Chorus',
    range: { fromBar: 1, toBar: 3 },
    places: [
      { fromBar: 5, toBar: 7 },
      { fromBar: 9, toBar: 11 },
    ],
  });
  const split = accept(splitSectionPlace(made.doc, made.placeIds[1]));
  expect(
    sectionInstruments(split, made.placeIds[0]).find((r) => r.pattern.stem === 'drums')?.pattern.id,
  ).not.toBe(
    sectionInstruments(split, made.placeIds[1]).find((r) => r.pattern.stem === 'drums')?.pattern.id,
  );
  const off = accept(
    setDrumCell(split, {
      placeId: made.placeIds[0],
      lane: 4,
      from: 0,
      to: 1 / 16,
      at: 0,
      on: false,
      duration: 1 / 16,
    }),
  );
  const added = accept(
    setDrumCell(off, {
      placeId: made.placeIds[0],
      lane: 2,
      from: 0.5,
      to: 0.5625,
      at: 0.5,
      on: true,
      duration: 1 / 16,
    }),
  );
  const query = async (doc: Doc) => {
    const row = sectionInstruments(doc, made.placeIds[0]).find((r) => r.pattern.stem === 'drums')!;
    const r = await queryEventsNode(generate(doc, { only: row.id }), 0, 16.25);
    expect(r.error).toBeNull();
    return scoredNotes(r.events, true).notes.map((n) => [
      +n.startCycle.toFixed(8),
      n.pitch,
      +(n.endCycle - n.startCycle).toFixed(8),
    ]);
  };
  const notes = await query(added);
  const places = sections(added).filter((p) => made.placeIds.includes(p.id));
  expect(places.map((p) => p.edited)).toEqual([true, false, true]);
  for (const p of [places[0], places[2]]) {
    expect(notes.some((n) => n[0] === p.start && n[1] === 35)).toBe(false);
    expect(notes).toContainEqual([p.start + 0.5, 38, 0.0625]);
    expect(notes.some((n) => n[0] === p.start + 1 && n[1] === 35)).toBe(true);
  }
  expect(notes.some((n) => n[0] === places[1].start && n[1] === 35)).toBe(true);
  const pasted = importStrudel(generateCopy(added)).doc;
  expect(checkDoc(pasted)).toEqual([]);
  // Imported ids are allowed to change; compare actual events and retained links separately.
  const row = sectionInstruments(
    pasted,
    sections(pasted).find((p) => p.source?.fromBar === 1)!.id,
  ).find((r) => r.pattern.stem === 'drums')!;
  const r = await queryEventsNode(generate(pasted, { only: row.id }), 0, 16.25);
  expect(r.error).toBeNull();
  expect(
    scoredNotes(r.events, true).notes.map((n) => [
      +n.startCycle.toFixed(8),
      n.pitch,
      +(n.endCycle - n.startCycle).toFixed(8),
    ]),
  ).toEqual(notes);
  expect(
    sections(pasted)
      .filter((p) => p.source)
      .map((p) => [p.source, p.tempo, p.edited]),
  ).toEqual(places.map((p) => [p.source, p.tempo, p.edited]));
});

test('the lens native rhythm target edits the chosen bar of a split section, with score answers on its stem row', async () => {
  const song = await sectionFixture();
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song,
    folder: 'invented-folder',
    name: 'Chorus',
    range: { fromBar: 1, toBar: 3 },
    places: [{ fromBar: 5, toBar: 7 }],
  });
  const doc = accept(splitSectionPlace(made.doc, made.placeIds[1]));
  const place = sections(doc).find((p) => p.id === made.placeIds[1])!;
  const scoped = lensScore({ doc, song, place, bar: 5, choices: new Map() });
  const row = scoped.rows.find((r) => r.patterns.some((p) => p.stem === 'bass'))!;
  const model = sheetModel(
    {
      doc,
      fromCycle: scoped.fromCycle,
      toCycle: scoped.toCycle,
      events: {},
      sounds: [],
      playhead: null,
    },
    scoped.rows,
  );
  const rhythm = model.rows.find((r) => r.id === row.id)!.cells.find((c) => c.name === 'rhythm')!;
  const target = describeTarget(doc, rhythm.nodeId);
  expect(target.kind).toBe('rhythm');
  expect(target.instrumentId).toBe(row.id);
  const next = accept(setRhythmValue(doc, rhythm.nodeId, [0], '72'));
  const result = await queryEventsNode(generate(next, { only: row.id }), 0, 16.25);
  expect(result.error).toBeNull();
  const notes = scoredNotes(result.events).notes;
  expect(notes.filter((n) => n.startCycle === place.start).map((n) => n.pitch)).toEqual([72]);
  const untouched = sections(next).find((p) => p.id === made.placeIds[0])!;
  expect(notes.filter((n) => n.startCycle === untouched.start).map((n) => n.pitch)).toEqual([60]);
  expect(
    sections(next)
      .filter((p) => made.placeIds.includes(p.id))
      .map((p) => p.edited),
  ).toEqual([false, true]);
  const reversed = accept(addRewrite(next, row.pattern.id, 'rev'));
  const rev = await queryEventsNode(generate(reversed, { only: row.id }), 0, 16.25);
  expect(rev.error).toBeNull();
  expect(scoredNotes(rev.events).notes.find((n) => n.pitch === 72)?.startCycle).toBeCloseTo(
    place.start + 15 / 16,
  );
});

test('a repeated short arrangement keeps a whole-pattern editor for later bars', async () => {
  const doc = importStrudel(`const phrase = note("c3 e3").s("sine");
    /*@odm-shared {"purpose":"instrument"}*/ const line = arrange([1, phrase]);
    $: arrange([4, line]);`).doc;
  const row = instruments(doc)[0];
  expect(lensParts(doc, row, 0, 4).some((p) => p.from < 3.5 && p.to > 3.5)).toBe(true);
  const phrase = doc.body.find((n) => n.kind === 'shared' && n.name === 'phrase');
  if (!phrase || phrase.kind !== 'shared') throw Error('Missing invented phrase');
  const edited = accept(addRewrite(doc, phrase.pattern.id, 'rev'));
  const answer = await queryEventsNode(generate(edited), 0, 1);
  expect(answer.error).toBeNull();
  expect(
    scoredNotes(answer.events)
      .notes.sort((a, b) => a.startCycle - b.startCycle)
      .map((n) => n.pitch),
  ).toEqual([52, 48]);
});

test('a definition sound bank uses source editing instead of inserting a default-bank hit', async () => {
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song: await sectionFixture(),
    folder: 'invented-folder',
    name: 'Verse',
    range: { fromBar: 1, toBar: 3 },
  });
  const doc = structuredClone(made.doc);
  const row = instruments(doc).find((r) => r.pattern.stem === 'drums')!;
  row.pattern.layers.push({
    id: 'own-bank',
    tier: 1,
    kind: 'settings',
    settings: [
      {
        id: 'bank-setting',
        tier: 1,
        name: 'bank',
        value: {
          id: 'bank-value',
          tier: 1,
          core: { kind: 'constant', value: 'RolandTR909' },
          layers: [],
        },
      },
    ],
  });
  const changed = setDrumCell(doc, {
    placeId: made.placeIds[0],
    lane: 4,
    from: 0,
    to: 1 / 16,
    at: 0,
    duration: 1 / 16,
    on: true,
  });
  expect('ok' in changed && changed.ok === false).toBe(true);
});
