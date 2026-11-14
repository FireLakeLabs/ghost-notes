import { expect, test } from 'vitest';
import { playbackRows } from '../src/strudel/playback-rows';
import { plainEvent, query } from '../src/strudel';
import { warpPattern } from '../src/strudel/warp';
import { referenceEvents } from '../src/engine/rows';
import { songTime } from '../src/engine/song-time';
import { checkDoc, sections, type Doc } from '../src/document';
import { makeSectionFromRange } from '../src/document/edits/section-from-range';
import { setStemSound } from '../src/document/edits/stem-sound';
import { splitSectionPlace } from '../src/document/edits/section-split-place';
import { generate } from '../src/generate';
import { evaluatedPattern, fixtureSong } from './playback-fixture';
import { queryEventsNode } from './node-query';
import { sectionFixture } from './section-fixture';

test('row selection keeps full-context Mine effects and original reference times through warp', async () => {
  const song = await fixtureSong();
  const time = songTime(song);
  const pattern = await evaluatedPattern(
    '// mini-off\nstack(note("60").s("sine").lpf(300).tag("odm:instrument:bass"), note("72").s("sine").tag("odm:instrument:keys")).rev().fast(2)',
  );
  const notes = song.stems[0].notes;
  const events = referenceEvents({ song, audio: new Map() }, 'bass', notes, 'gm_piano');
  const selected = playbackRows(pattern, {
    mineIds: ['bass'],
    reference: [{ id: 'reference:bass:midi', events }],
  });
  const expectedMine = query(pattern, 0, time.toCycle(time.end))
    .map(plainEvent)
    .filter((e) => e.instrumentId === 'bass');
  const mine = query(selected, 0, time.toCycle(time.end))
    .map(plainEvent)
    .filter((e) => e.instrumentId === 'bass');
  expect(mine).toEqual(expectedMine);
  expect(mine.length).toBeGreaterThan(2);
  expect(
    mine.every(
      (e) =>
        typeof e.value === 'object' &&
        e.value !== null &&
        'cutoff' in e.value &&
        e.value.cutoff === 300,
    ),
  ).toBe(true);
  const warped = warpPattern(selected, time);
  const actual = query(warped, time.start, time.end)
    .map(plainEvent)
    .filter((e) => e.instrumentId === 'reference:bass:midi' && e.hasOnset);
  expect(actual).toHaveLength(notes.length);
  actual.forEach((event, i) => {
    expect(event.whole?.[0]).toBeCloseTo(notes[i].startSeconds, 9);
    expect(event.value).toMatchObject({
      s: 'gm_piano',
      note: notes[i].pitch,
      gain: notes[i].velocity / 127,
    });
  });
  const slices = [];
  for (let i = 0; i < Math.ceil(time.end / 0.05); i++)
    slices.push(
      ...query(warped, i * 0.05, (i + 1) * 0.05)
        .map(plainEvent)
        .filter((e) => e.instrumentId === 'reference:bass:midi' && e.hasOnset),
    );
  expect(slices.map((e) => ({ whole: e.whole, value: e.value }))).toEqual(
    actual.map((e) => ({ whole: e.whole, value: e.value })),
  );
});

test('instrument sounds retain notes and links, change every stem definition and survive copy/import', async () => {
  const song = await sectionFixture();
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song,
    folder: 'invented',
    name: 'Verse',
    range: { fromBar: 1, toBar: 3 },
    places: [{ fromBar: 5, toBar: 7 }],
  });
  const split = splitSectionPlace(made.doc, made.placeIds[1]);
  if ('ok' in split) throw Error(split.reason);
  const result = setStemSound(split, 'bass', 'gm_piano');
  if ('ok' in result) throw Error(result.reason);
  expect(checkDoc(result)).toEqual([]);
  const { importStrudel } = await import('../src/import');
  const before = await queryEventsNode(generate(split, { instrumentTags: true }), 0, 16);
  const afterDoc: Doc = importStrudel(generate(result)).doc;
  const after = await queryEventsNode(generate(afterDoc, { instrumentTags: true }), 0, 16);
  expect(after.error).toBeNull();
  expect(after.events.map((e) => e.whole)).toEqual(before.events.map((e) => e.whole));
  const pitched = after.events.filter(
    (e) => e.value && typeof e.value === 'object' && 'note' in e.value,
  );
  expect(pitched.length).toBeGreaterThan(2);
  for (const event of pitched) expect(event.value).toHaveProperty('s', 'gm_piano');
  const links = (doc: Doc) =>
    sections(doc).map((s) => ({ source: s.source, tempo: s.tempo, edited: s.edited }));
  expect(links(afterDoc)).toEqual(links(result));
  expect(setStemSound(result, 'bass', 'gm_piano')).toBe(result);
});
