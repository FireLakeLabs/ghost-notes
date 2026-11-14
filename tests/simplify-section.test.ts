import { expect, test } from 'vitest';
import { readReference } from '../src/reference/reader';
import { makeSectionFromRange } from '../src/document/edits/section-from-range';
import { splitSectionPlace } from '../src/document/edits/section-split-place';
import { setStemSound } from '../src/document/edits/stem-sound';
import { replaceFromSource } from '../src/document/edits/source-node';
import { checkDoc, sectionInstruments, sections } from '../src/document';
import { adopt } from '../src/document/edits/source-shared';
import { referenceLinks } from '../src/document/links';
import { generate, generatePattern } from '../src/generate';
import { importStrudel } from '../src/import';
import { queryEvents } from '../src/strudel/evaluate';
import { sectionSuggestions, suggestionDocument, suggestionIssue } from '../src/simplify/section';
import { defaultMatch, defaultSettings } from '../src/simplify';
import { simplifyControlsFixture } from './fixtures/simplify-controls';

async function fixture() {
  const files = simplifyControlsFixture();
  const song = await readReference({
    read: async (path) => {
      const bytes = files.get(path);
      if (!bytes) throw Error('Missing fixture');
      return bytes;
    },
    exists: async (path) => files.has(path),
  });
  const made = makeSectionFromRange({
    doc: { version: 2, body: [] },
    song,
    folder: 'invented',
    range: { fromBar: 1, toBar: 5 },
    places: [{ fromBar: 5, toBar: 9 }],
    name: 'Verse',
  });
  return { song, doc: made.doc, placeId: made.selectedPlaceId };
}
test('a proposal edits shared places, preserves links and leaves a split copy independent', async () => {
  const { song, doc: before, placeId } = await fixture();
  const other = sections(before).find((p) => p.source?.fromBar === 5)!;
  const doc = splitSectionPlace(before, other.id);
  if ('ok' in doc) throw Error(doc.reason);
  const proposal = sectionSuggestions({
    doc,
    song,
    placeId,
    stemId: 'bass',
    grid: 4,
    settings: defaultSettings,
    match: defaultMatch,
  });
  const suggestion = proposal.suggestions[0];
  expect(suggestion.report).toMatchObject({
    originalNotes: 17,
    suggestedNotes: 16,
    matchedNotes: 16,
  });
  const next = suggestionDocument(doc, proposal, suggestion);
  const result = await queryEvents(
    generate(next, { instrumentTags: true }),
    proposal.range.startCycle,
    proposal.range.endCycle,
  );
  expect(suggestionIssue(result, proposal, suggestion)).toBe('');
  const all = await queryEvents(generate(next, { instrumentTags: true }), 0, 9);
  const bass = all.events.filter((e) => e.hasOnset && e.instrumentId === proposal.row.id);
  expect(bass.filter((e) => e.whole && e.whole[0] < other.start)).toHaveLength(16);
  expect(
    bass.filter(
      (e) => e.whole && e.whole[0] >= other.start && e.whole[0] < other.start + other.cycles,
    ),
  ).toHaveLength(17);
  expect(
    sections(next)
      .filter((p) => p.source)
      .map((p) => [p.source, p.edited]),
  ).toEqual(
    sections(doc)
      .filter((p) => p.source)
      .map((p) => [p.source, p.id === placeId]),
  );
  const reopened = importStrudel(generate(next)).doc;
  expect(referenceLinks(reopened, 'invented', song).links.every((l) => l.restored)).toBe(true);
});

test('whole-program transformations cannot authorize an unchanged note report', async () => {
  const { song, doc, placeId } = await fixture();
  doc.body.push({
    id: 'transpose',
    tier: 3,
    kind: 'transform',
    name: 'all',
    args: [
      { kind: 'opaque', code: 'p=>p.fmap(v=>v.note===undefined?v:{...v,note:Number(v.note)+12})' },
    ],
  });
  const proposal = sectionSuggestions({
    doc,
    song,
    placeId,
    stemId: 'bass',
    grid: 4,
    settings: defaultSettings,
    match: defaultMatch,
  });
  const suggestion = proposal.suggestions[0];
  const next = suggestionDocument(doc, proposal, suggestion);
  const result = await queryEvents(
    generate(next, { instrumentTags: true }),
    proposal.range.startCycle,
    proposal.range.endCycle,
  );
  expect(result.error).toBeNull();
  expect(suggestionIssue(result, proposal, suggestion)).toContain('Existing rewrites');
  expect(
    suggestionIssue(
      { ...result, error: { phase: 'timeout', message: 'Question timed out' } },
      proposal,
      suggestion,
    ),
  ).toContain('timed out');
});

test('a proposal preserves the chosen sound, gain and filter in scheduled values', async () => {
  const { song, doc: before, placeId } = await fixture();
  const sounded = setStemSound(before, 'bass', 'gm_piano');
  if ('ok' in sounded) throw Error(sounded.reason);
  const row = sectionInstruments(sounded, placeId).find((r) => r.pattern.stem === 'bass')!;
  const doc = replaceFromSource(
    sounded,
    row.pattern.id,
    `(${generatePattern(row.pattern)}).lpf(300).gain(0.5)`,
  );
  if ('ok' in doc) throw Error(doc.reason);
  const proposal = sectionSuggestions({
    doc,
    song,
    placeId,
    stemId: 'bass',
    grid: 4,
    settings: defaultSettings,
    match: defaultMatch,
  });
  const suggestion = proposal.suggestions[0];
  const next = suggestionDocument(doc, proposal, suggestion);
  const result = await queryEvents(
    generate(next, { instrumentTags: true }),
    proposal.range.startCycle,
    proposal.range.endCycle,
  );
  expect(suggestionIssue(result, proposal, suggestion)).toBe('');
  const notes = result.events.filter((e) => e.hasOnset && e.instrumentId === proposal.row.id);
  expect(notes).toHaveLength(16);
  notes.forEach((e) => expect(e.value).toMatchObject({ s: 'gm_piano', gain: 0.5, cutoff: 300 }));
  const repeated = sectionSuggestions({
    doc: next,
    song,
    placeId,
    stemId: 'bass',
    grid: 4,
    settings: defaultSettings,
    match: defaultMatch,
  });
  expect(generate(suggestionDocument(next, repeated, repeated.suggestions[0]))).toBe(
    generate(next),
  );
});

test('several instrument definitions in one place require the source editor', async () => {
  const { song, doc, placeId } = await fixture();
  const row = sectionInstruments(doc, placeId).find((r) => r.pattern.stem === 'bass')!;
  const definition = doc.body.find((n) => n.kind === 'shared' && n.pattern.id === row.pattern.id);
  const section = doc.body.find((n) => n.kind === 'shared' && n.purpose === 'section');
  if (
    definition?.kind !== 'shared' ||
    section?.kind !== 'shared' ||
    section.pattern.core.kind !== 'group'
  )
    throw Error('Missing fixture definitions');
  doc.body.unshift(adopt(doc, { ...definition, name: 'secondBass' }));
  section.pattern.core.parts.push({
    id: 'second-bass-use',
    pattern: {
      id: 'second-bass-ref',
      tier: 1,
      core: { kind: 'ref', name: 'secondBass' },
      layers: [],
    },
  });
  expect(checkDoc(doc)).toEqual([]);
  expect(() =>
    sectionSuggestions({
      doc,
      song,
      placeId,
      stemId: 'bass',
      grid: 4,
      settings: defaultSettings,
      match: defaultMatch,
    }),
  ).toThrow('several definitions');
});
