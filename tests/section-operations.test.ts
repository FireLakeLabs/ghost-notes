import { query } from '../src/strudel';
import { instrumentIdentity } from '../src/strudel/instrument-identity';
import { evaluatedPattern } from './playback-fixture';
import { renameInstrument } from '../src/document/edits/rename-instrument';
import { setInstrumentInSection } from '../src/document/edits/section-instrument';
import { restRhythm } from '../src/document/edits/rhythm-rest';
import { removeInstrument } from '../src/document/edits/instrument-remove';
import { setMuted } from '../src/document/edits/set-muted';
import { setUseMuted } from '../src/document/edits/set-use-muted';
import { copiedEventProof, sectionEvents } from './sections-proof';
import { expect, test } from 'vitest';
import { checkDoc, instruments, shared, walk, type Doc, type Pattern } from '../src/document';
import { referenceLinks } from '../src/document/links';
import { makeSectionFromRange } from '../src/document/edits/section-from-range';
import { splitSectionPlace } from '../src/document/edits/section-split-place';
import { setSectionTempo } from '../src/document/edits/section-tempo';
import { installSource } from '../src/document/edits/source-shared';
import { song as arrangement, sectionOwner } from '../src/document/edits/section-shared';
import { findSectionMatches } from '../src/document/section-matches';
import { sectionRange } from '../src/document/section-range';
import { generate, generateCopy } from '../src/generate';
import { importStrudel } from '../src/import';
import { queryEventsNode } from './node-query';
import { sectionFixture } from './section-fixture';
const empty: Doc = { version: 2, body: [] };
const folder = 'invented-folder';
const accept = (doc: Doc | { ok: false; reason: string }): Doc => {
  if ('ok' in doc) throw Error(doc.reason);
  expect(checkDoc(doc)).toEqual([]);
  return doc;
};
const events = async (code: string, end = 16.25) => {
  const r = await queryEventsNode(code, 0, end);
  expect(r.error).toBeNull();
  return r.events
    .filter((e) => e.hasOnset)
    .map((e) => ({ whole: e.whole?.map((n) => +n.toFixed(8)), value: e.value }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
};
test('make, three-place reuse, pickup, split, edit, takeover, copy/paste and reopen preserve every link and note', async () => {
  const song = await sectionFixture(),
    original = structuredClone(song);
  const matches = findSectionMatches({ song, range: { fromBar: 1, toBar: 3 } });
  expect(matches.map((m) => [m.fromBar, m.toBar, m.score, m.selected])).toEqual([
    [5, 7, 1, true],
    [9, 11, 1, true],
    [13, 15, 1, true],
  ]);
  let made = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Chorus',
    range: { fromBar: 1, toBar: 3 },
    places: matches,
  });
  expect(made.warnings).toEqual([]);
  let doc = makeSectionFromRange({
    doc: made.doc,
    song,
    folder,
    name: 'Pickup',
    range: { fromBar: 0, toBar: 1 },
  }).doc;
  doc = accept(splitSectionPlace(doc, made.placeIds[1]));
  const split = sectionOwner(doc, made.placeIds[1]);
  if (!split) throw Error('fixture');
  const row = instruments(doc).find(
    (r) =>
      r.pattern.stem === 'bass' && r.uses.some((u) => u.path.some((p) => p.id === split.part.id)),
  );
  if (!row) throw Error('fixture');
  if (split.content.core.kind !== 'group') throw Error('fixture');
  const ref = split.content.core.parts[0].pattern.core;
  const local = ref.kind === 'ref' ? shared(doc, ref.name) : undefined;
  if (!local) throw Error('fixture');
  doc = accept(installSource(doc, local.id, 'note("d3 f3").s("triangle")', true));
  expect(sectionOwner(doc, made.placeIds[0])?.content.edited).toBe(false);
  expect(sectionOwner(doc, made.placeIds[1])?.content.edited).toBe(true);
  doc = accept(setSectionTempo(doc, made.placeIds[1], 18));
  doc = makeSectionFromRange({
    doc,
    song,
    folder,
    name: 'Old fill',
    range: { fromBar: 3, toBar: 5 },
    stemIds: ['drums'],
  }).doc;
  made = makeSectionFromRange({
    doc,
    song,
    folder,
    name: 'New ending',
    range: { fromBar: 4, toBar: 5 },
    stemIds: ['bass'],
  });
  expect(made.warnings.map((w) => w.source)).toEqual([{ folder, fromBar: 3, toBar: 5 }]);
  doc = made.doc;
  expect(checkDoc(doc)).toEqual([]);
  expect(instruments(doc).map((r) => r.pattern.stem)).toEqual(['bass', 'drums']);
  const root = arrangement(doc);
  if (root?.core.kind !== 'group') throw Error('fixture');
  expect(
    root.core.parts
      .filter((p) => p.source)
      .map((p) => [p.source?.fromBar, p.source?.toBar, p.cycles, p.tempo]),
  ).toEqual([
    [0, 1, 0.25, 30],
    [1, 3, 2, 30],
    [4, 5, 1, 30],
    [5, 7, 2, 18],
    [9, 11, 2, 30],
    [13, 15, 2, 30],
  ]);
  const before = await events(generate(doc));
  const canonical = await queryEventsNode(generate(doc), 0, 16.25);
  const expectedCopy = copiedEventProof(doc, canonical);
  expect(sectionEvents(await queryEventsNode(generateCopy(doc), 0, expectedCopy.end))).toEqual(
    expectedCopy.events,
  );
  const pasted = importStrudel(generateCopy(doc)).doc;
  expect(checkDoc(pasted)).toEqual([]);
  expect(await events(generate(pasted))).toEqual(before);
  expect(generateCopy(importStrudel(generateCopy(pasted)).doc)).toBe(generateCopy(pasted));
  const reopened = referenceLinks(pasted, folder, await sectionFixture());
  expect(reopened.links.every((l) => l.restored)).toBe(true);
  expect(reopened.stems.every((s) => s.restored)).toBe(true);
  const metadata = (d: Doc) =>
    d.body
      .filter((n) => n.kind === 'shared')
      .map((n) => ({ source: n.pattern.source, edited: n.pattern.edited, stem: n.pattern.stem }));
  expect(metadata(pasted)).toEqual(metadata(doc));
  expect(song).toEqual(original);
});

test('beat selection limits original onsets but keeps whole bars and selected instruments; default grid is four', async () => {
  const song = await sectionFixture();
  const made = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Beat',
    range: { fromBar: 1, toBar: 2 },
    beats: { fromBeat: 1, toBeat: 3 },
    stemIds: ['bass'],
  });
  const r = await queryEventsNode(generate(made.doc), 0, 2);
  expect(r.error).toBeNull();
  expect(r.events.filter((e) => e.hasOnset).map((e) => e.whole?.[0])).toEqual([0.75]);
  expect(instruments(made.doc).map((r) => r.pattern.stem)).toEqual(['bass']);
  expect(sectionOwner(made.doc, made.placeIds[0])?.part.cycles).toBe(1);
  expect(() =>
    makeSectionFromRange({
      doc: empty,
      song,
      folder,
      name: 'bad',
      range: { fromBar: 0, toBar: 2 },
    }),
  ).toThrow();
  expect(() =>
    makeSectionFromRange({
      doc: empty,
      song,
      folder,
      name: 'bad',
      range: { fromBar: 1, toBar: 2 },
      places: [{ fromBar: 1, toBar: 2 }],
    }),
  ).toThrow();
});

test('copied tempo places preserve first-pass pickup and steady per-place durations; G72 stays in song cycles', async () => {
  const song = await sectionFixture();
  let doc = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Pickup',
    range: { fromBar: 0, toBar: 1 },
    stemIds: ['bass'],
  }).doc;
  const made = makeSectionFromRange({
    doc,
    song,
    folder,
    name: 'One',
    range: { fromBar: 1, toBar: 2 },
    stemIds: ['bass'],
  });
  doc = accept(setSectionTempo(made.doc, made.placeIds[0], 15));
  const r = await queryEventsNode(generateCopy(doc), 0, 3);
  expect(r.error).toBeNull();
  expect(r.events.filter((e) => e.hasOnset).map((e) => e.whole?.[0])).toEqual([0, 0.25, 1.25]);
  expect(
    (await queryEventsNode(generate(doc), 0, 2)).events
      .filter((e) => e.hasOnset)
      .map((e) => e.whole?.[0]),
  ).toEqual([0, 0.25, 0.75]);
  expect(sectionRange(song, { fromBar: 1, toBar: 2 }).startCycle).toBe(0.25);
});

test('match knobs use beat timing, quiet threshold 40, pitch classes, multiplicity and never silence', async () => {
  const song = await sectionFixture();
  song.stems = [song.stems[0]];
  const base = song.stems[0],
    original = base.notes;
  song.stems = [
    {
      ...base,
      notes: original.map((n) =>
        n.start.bar === 5 || n.start.bar === 6
          ? { ...n, pitch: n.pitch + 12, startSeconds: n.startSeconds + 0.05 }
          : n,
      ),
    },
  ];
  expect(
    findSectionMatches({ song, range: { fromBar: 1, toBar: 3 } }).map((m) => m.fromBar),
  ).toEqual([9, 13]);
  expect(
    findSectionMatches({
      song,
      range: { fromBar: 1, toBar: 3 },
      settings: { timingBeats: 0.13, quiet: 'count', pitch: 'class' },
    }).map((m) => m.fromBar),
  ).toEqual([5, 9, 13]);
  expect(
    findSectionMatches({
      song,
      range: { fromBar: 1, toBar: 3 },
      settings: { timingBeats: 0, quiet: 'count', pitch: 'class' },
    }).map((m) => m.fromBar),
  ).toEqual([9, 13]);
  song.stems = [
    {
      ...base,
      notes: [...original, ...original.filter((n) => n.start.bar === 5 || n.start.bar === 6)],
    },
  ];
  expect(
    findSectionMatches({ song, range: { fromBar: 1, toBar: 3 } }).find((m) => m.fromBar === 5),
  ).toMatchObject({ matched: 4, reference: 4, candidate: 8, score: 0.5 });
  song.stems = [{ ...base, notes: original.map((n) => ({ ...n, velocity: 39 })) }];
  expect(
    findSectionMatches({
      song,
      range: { fromBar: 1, toBar: 3 },
      settings: { timingBeats: 0.13, quiet: 'ignore', pitch: 'exact' },
    }),
  ).toEqual([]);
});

test('canonical and section-local mute edits mark affected content; tempo edits and undo retain flags', async () => {
  const song = await sectionFixture();
  const made = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Verse',
    range: { fromBar: 1, toBar: 3 },
    places: [{ fromBar: 5, toBar: 7 }],
  });
  const row = instruments(made.doc).find((r) => r.pattern.stem === 'bass');
  if (!row) throw Error('fixture');
  const muted = accept(setMuted(made.doc, row.id, true));
  expect(sectionOwner(muted, made.placeIds[0])?.content.edited).toBe(true);
  const local = accept(setUseMuted(made.doc, row.id, made.placeIds[1], true));
  expect(sectionOwner(local, made.placeIds[1])?.content.edited).toBe(true);
  expect(sectionOwner(made.doc, made.placeIds[1])?.content.edited).toBe(false);
  expect(
    sectionOwner(accept(setSectionTempo(made.doc, made.placeIds[0], 25)), made.placeIds[0])?.content
      .edited,
  ).toBe(false);
});

test('default grid moves a selected onset to its nearest sixteenth without changing the reference', async () => {
  const song = await sectionFixture(),
    stem = song.stems[0];
  const n = stem.notes.find((n) => n.start.bar === 1);
  if (!n) throw Error('fixture');
  song.stems = [{ ...stem, notes: [{ ...n, startSeconds: 0.64, endSeconds: 0.84 }] }];
  const made = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Grid',
    range: { fromBar: 1, toBar: 2 },
  });
  const result = await queryEventsNode(generate(made.doc), 0, 2);
  expect(result.error).toBeNull();
  expect(result.events.filter((e) => e.hasOnset).map((e) => e.whole?.[0])).toEqual([0.3125]);
  expect(song.stems[0].notes[0].startSeconds).toBe(0.64);
});

test('an uncovered fractional prefix retains the first numbered-bar onset on the first pass', async () => {
  const song = await sectionFixture();
  const first = song.bars[0];
  song.bars = [{ ...first, startSeconds: 0.05 }, ...song.bars.slice(1)];
  song.beatMap = { ...song.beatMap, beats: [0.05, ...song.beatMap.beats.slice(1)] };
  const made = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Prefix',
    range: { fromBar: 1, toBar: 2 },
    stemIds: ['bass'],
  });
  const result = await queryEventsNode(generate(made.doc), 0, 2);
  expect(result.error).toBeNull();
  const onsets = result.events.filter((e) => e.hasOnset).map((e) => e.whole?.[0]);
  expect(onsets).toHaveLength(2);
  expect(onsets[0]).toBeCloseTo(1 / 36 + 0.25, 8);
});

test('section note edits stay inside that section; stem isolation, global mute and deletion cover all independent patterns', async () => {
  const song = await sectionFixture();
  const chorus = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Chorus',
    range: { fromBar: 1, toBar: 3 },
  });
  const verse = makeSectionFromRange({
    doc: chorus.doc,
    song,
    folder,
    name: 'Verse',
    range: { fromBar: 3, toBar: 5 },
  });
  const before = verse.doc;
  const rows = instruments(before);
  expect(rows).toHaveLength(2);
  const drums = rows.find((r) => r.pattern.stem === 'drums');
  if (!drums) throw Error('fixture');
  expect(drums.patterns).toHaveLength(2);
  let rhythm: string | undefined;
  walk(
    {
      version: 2,
      body: [
        {
          id: 'scan',
          kind: 'shared',
          tier: 1,
          name: 'scan',
          nameSource: 'generated',
          pattern: drums.pattern,
        },
      ],
    },
    (n) => {
      if (!rhythm && 'core' in n && (n as Pattern).core.kind === 'sequence') rhythm = n.id;
    },
  );
  if (!rhythm) throw Error('fixture');
  const changed = accept(restRhythm(before, `${rhythm}:rhythm`, [0]));
  expect(sectionOwner(changed, chorus.selectedPlaceId)?.content.edited).toBe(true);
  expect(sectionOwner(changed, verse.selectedPlaceId)?.content.edited).toBe(false);
  const verseRange = sectionRange(song, { fromBar: 3, toBar: 5 });
  const askVerse = (d: Doc) =>
    queryEventsNode(generate(d, { only: drums.id }), verseRange.startCycle, verseRange.endCycle);
  expect(sectionEvents(await askVerse(changed))).toEqual(sectionEvents(await askVerse(before)));
  const renamed = accept(renameInstrument(before, drums.id, 'Kit'));
  expect(
    instruments(renamed)
      .find((r) => r.id === drums.id)
      ?.patterns.every((p) => p.label === 'Kit'),
  ).toBe(true);
  expect(sectionOwner(renamed, verse.selectedPlaceId)?.content.edited).toBe(false);
  const checked = accept(setInstrumentInSection(before, verse.selectedPlaceId, drums.id, false));
  expect(
    (await queryEventsNode(generate(checked, { only: drums.id }), 0, 16.25)).events.filter(
      (e) => e.hasOnset,
    ),
  ).toHaveLength(2);
  const tagged = query(
    await evaluatedPattern(generate(before, { instrumentTags: true })),
    0,
    16.25,
  ).filter((h) => h.hasOnset());
  expect(
    tagged
      .filter((h) => h.value && typeof h.value === 'object' && 's' in h.value && h.value.s === 'bd')
      .map(instrumentIdentity),
  ).toEqual([drums.id, drums.id, drums.id, drums.id]);
  const allDrums = await queryEventsNode(generate(before, { only: drums.id }), 0, 16.25);
  expect(allDrums.events.filter((e) => e.hasOnset)).toHaveLength(4);
  const muted = accept(setMuted(before, drums.id, true));
  expect(
    (await queryEventsNode(generate(muted, { only: drums.id }), 0, 16.25)).events.filter(
      (e) => e.hasOnset,
    ),
  ).toEqual([]);
  expect(sectionOwner(muted, verse.selectedPlaceId)?.content.edited).toBe(true);
  const onlyDrums = makeSectionFromRange({
    doc: before,
    song,
    folder,
    name: 'Drum fill',
    range: { fromBar: 6, toBar: 7 },
    stemIds: ['drums'],
  });
  const removed = accept(removeInstrument(onlyDrums.doc, drums.id));
  expect(sectionOwner(removed, onlyDrums.selectedPlaceId)?.content).toMatchObject({
    edited: true,
    source: { folder, fromBar: 6, toBar: 7 },
  });
  expect(instruments(removed).map((r) => r.pattern.stem)).toEqual(['bass']);
  expect(sectionOwner(removed, chorus.selectedPlaceId)?.content.edited).toBe(true);
  expect(sectionOwner(removed, verse.selectedPlaceId)?.content.edited).toBe(true);
});

test('selectedPlaceId identifies a later selected range; edited tempo wrappers warn and never stretch again', async () => {
  const song = await sectionFixture();
  const made = makeSectionFromRange({
    doc: empty,
    song,
    folder,
    name: 'Later',
    range: { fromBar: 9, toBar: 10 },
    places: [{ fromBar: 1, toBar: 2 }],
  });
  expect(made.placeIds[1]).toBe(made.selectedPlaceId);
  const doc = accept(setSectionTempo(made.doc, made.selectedPlaceId, 15));
  const altered = generateCopy(doc).replace('.slow(2)', '.slow(3)');
  const pasted = importStrudel(altered);
  expect(pasted.warnings.some((w) => w.message.includes('tempo'))).toBe(true);
  const copied = generateCopy(pasted.doc);
  expect(generateCopy(importStrudel(copied).doc)).toBe(copied);
  expect(await events(copied, 20)).toEqual(await events(altered, 20));
});

test('session starting content can leave a new linked section deliberately silent', async () => {
  const song = await sectionFixture();
  for (const starting of ['literal', 'simplified', 'silence'] as const) {
    const made = makeSectionFromRange({
      doc: empty,
      song,
      folder,
      name: 'Verse',
      range: { fromBar: 1, toBar: 3 },
      starting,
    });
    expect(checkDoc(made.doc)).toEqual([]);
    expect((await events(generate(made.doc))).length > 0).toBe(starting !== 'silence');
    expect(referenceLinks(made.doc, folder, song).links.every((l) => l.restored)).toBe(true);
    expect(sectionOwner(made.doc, made.selectedPlaceId)?.content.edited).toBe(false);
  }
});
