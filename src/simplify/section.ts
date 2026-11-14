import { convertInstrument } from '../convert';
import type { EventResult } from '../contract';
import { sectionInstruments, sections, type Doc } from '../document';
import { replaceFromSource } from '../document/edits/source-node';
import { sectionRange } from '../document/section-range';
import type { ReferenceSong } from '../reference/types';
import { scoredNotes } from '../strudel/notes';
import { simplifyDrums, simplifyPitched } from './index';
import type { MatchSettings, SimplifySettings, Suggestion } from './types';

/** Proposals replace the recording-derived notes, retaining the instrument's outer effects. */
export function sectionSuggestions(input: {
  doc: Doc;
  song: ReferenceSong;
  placeId: string;
  stemId: string;
  grid: Parameters<typeof convertInstrument>[0]['grid'];
  settings: SimplifySettings;
  match: MatchSettings;
}) {
  const { doc, song, placeId, stemId } = input;
  const place = sections(doc).find((p) => p.id === placeId);
  if (!place?.source) throw Error('Choose a linked section first.');
  const rows = sectionInstruments(doc, placeId).filter((r) => r.pattern.stem === stemId);
  const row = rows[0];
  if (rows.length !== 1 || !row || row.patterns.length !== 1)
    throw Error('This instrument has several definitions here. Use its source editor.');
  const range = sectionRange(song, place.source);
  const conversion = convertInstrument({
    song,
    stemId,
    range: place.source,
    grid: input.grid,
  });
  const args = { song, conversion, settings: input.settings, match: input.match };
  const suggestions = stemId === 'drums' ? [simplifyDrums(args)] : simplifyPitched(args);
  return { place, row, range, conversion, suggestions };
}
export type SectionSuggestions = ReturnType<typeof sectionSuggestions>;

export function suggestionDocument(doc: Doc, proposal: SectionSuggestions, suggestion: Suggestion) {
  const defaultSound = '.s("triangle")';
  const hasSound = proposal.row.pattern.layers.some(
    (layer) =>
      layer.kind === 'settings' && layer.settings.some((s) => ['s', 'sound'].includes(s.name)),
  );
  // The encoder's standalone default is redundant when the preserved outer sound wins.
  const expression =
    hasSound && suggestion.expression.endsWith(defaultSound)
      ? suggestion.expression.slice(0, -defaultSound.length)
      : suggestion.expression;
  const next = replaceFromSource(doc, `${proposal.row.pattern.id}:rhythm`, expression);
  if ('ok' in next) throw Error(next.reason);
  return next;
}

/** Full-program evaluation must still schedule the proposed pitches and endpoints here.
 * Sound/gain effects remain the user's choices; they are outside G77's match score.
 */
export function suggestionIssue(
  result: EventResult,
  proposal: SectionSuggestions,
  suggestion: Suggestion,
): string {
  if (result.error) return `Could not check this suggestion: ${result.error.message}`;
  if (result.opaqueValues) return 'This program has values the note report cannot check.';
  if (result.events.some((e) => e.hasOnset && !e.instrumentId))
    return 'This program has notes without an instrument identity.';
  const scored = scoredNotes(
    result.events.filter((e) => e.instrumentId === proposal.row.id),
    proposal.conversion.stemId === 'drums',
  );
  const expected = suggestion.notes.map((n) => ({
    startCycle: n.startCycle + proposal.range.startCycle,
    endCycle: n.endCycle + proposal.range.startCycle,
    pitch: n.pitch,
  }));
  const order = (a: (typeof expected)[number], b: (typeof expected)[number]) =>
    a.startCycle - b.startCycle || a.pitch - b.pitch || a.endCycle - b.endCycle;
  const actual = scored.notes.sort(order);
  expected.sort(order);
  return scored.unmapped ||
    actual.length !== expected.length ||
    expected.some((n, i) =>
      (['startCycle', 'endCycle', 'pitch'] as const).some(
        (key) => Math.abs(n[key] - actual[i][key]) > 1e-6,
      ),
    )
    ? 'Existing rewrites change the proposed notes here. Use the source editor; this report cannot authorize Apply.'
    : '';
}
