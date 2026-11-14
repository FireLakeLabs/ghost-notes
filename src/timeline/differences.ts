import type { ConversionChange, NoteTime } from '../convert';
import type { ReferenceBar, ReferenceNote, ReferenceSong, ReferenceStem } from '../reference/types';
import { matchNotePairs, type MatchSettings } from '../simplify';
import { drumLane } from './layout';
import { timedNote, type InstrumentMaterial } from './material';

export type DifferenceKind = ConversionChange['kind'] | 'only-yours' | 'only-recording';
export type DifferenceMark = {
  kind: DifferenceKind;
  note: ReferenceNote;
  original: readonly NoteTime[];
  written: readonly NoteTime[];
};
export type BarMatch = {
  bar: ReferenceBar;
  matched: number;
  recording: number;
  mine: number;
  share: number;
};
export type Differences = { notes: DifferenceMark[]; mine: DifferenceMark[]; bars: BarMatch[] };
export const differenceNames: Record<DifferenceKind, string> = {
  moved: 'Moved',
  'moved-across-bar-line': 'Moved across a bar line',
  shortened: 'Shortened',
  merged: 'Merged',
  'only-yours': 'Only in yours',
  'only-recording': 'Only in the recording',
};
export function explainDifference(mark: DifferenceMark): string {
  const at = (n: NoteTime) => `${n.startSeconds.toFixed(3)}–${n.endSeconds.toFixed(3)} s`;
  const from = mark.original.map(at).join(', '),
    to = mark.written.map(at).join(', ');
  switch (mark.kind) {
    case 'only-yours':
      return `Only in yours: ${to}. No recording note in this bar matches the current settings.`;
    case 'only-recording':
      return `Only in the recording: ${from}. No arrangement note in this bar matches the current settings.`;
    case 'merged':
      return `Merged: ${mark.original.length} recorded notes (${from}) became one at ${to}.`;
    case 'shortened':
      return `Shortened: ${from}; written ${to}. The hollow tail shows the removed length.`;
    case 'moved-across-bar-line':
      return `Moved across a bar line: ${from}; written ${to}. The onset or sustain end crossed a boundary.`;
    case 'moved':
      return `Moved: ${from}; written ${to}. The line leads back to the recorded onset.`;
  }
}
/** Compare complete data, never the raster sample. Unarranged bars are not silence. */
export function compareMaterial(
  song: ReferenceSong,
  stem: ReferenceStem,
  material: InstrumentMaterial,
  settings: MatchSettings,
): Differences {
  const converted = material.conversion?.notes ?? [];
  const bySource = new Map(converted.map((n) => [n.sourceIndex, n]));
  const emitted = new Map(
    converted
      .filter((n) => n.mergedInto === null)
      .map((n, i) => [
        n.sourceIndex,
        material.literal.notes[i] ??
          timedNote(song, n.written.startSeconds, n.written.endSeconds, n.source.pitch, n.velocity),
      ]),
  );
  const notes: DifferenceMark[] = (material.conversion?.changes ?? []).map((change) => {
    const source = stem.notes[change.noteIndices[0]];
    const written = change.written[0];
    return {
      ...change,
      note:
        emitted.get(bySource.get(change.noteIndices[0])?.mergedInto ?? change.noteIndices[0]) ??
        timedNote(song, written.startSeconds, written.endSeconds, source.pitch, source.velocity),
    };
  });
  const result: Differences = { notes, mine: [], bars: [] };
  // Pending, failed or partially unmapped answers must not look like missing music.
  if (material.mine.message) return result;
  const inLane = (n: ReferenceNote) => stem.id !== 'drums' || drumLane(n.pitch) !== null;
  const key = (n: ReferenceNote) => ({
    startSeconds: n.startSeconds,
    pitch: stem.id === 'drums' ? (drumLane(n.pitch) ?? n.pitch) : n.pitch,
  });
  for (const bar of song.bars) {
    if (
      bar.endSeconds <= bar.startSeconds ||
      !material.places.some((p) => bar.number >= p.fromBar && bar.number < p.toBar)
    )
      continue;
    const owns = (n: ReferenceNote) =>
      n.startSeconds >= bar.startSeconds && n.startSeconds < bar.endSeconds;
    const recording = stem.notes.filter(
      (n) =>
        owns(n) && inLane(n) && (settings.countQuietNotes || n.velocity >= settings.quietVelocity),
    );
    const mine = material.mine.notes.filter((n) => owns(n) && inLane(n));
    const pairs = matchNotePairs(
      recording.map(key),
      mine.map(key),
      stem.id === 'drums' ? { ...settings, pitch: 'exact' } : settings,
    );
    const sourceMatches = new Set(pairs.map(([a]) => a)),
      mineMatches = new Set(pairs.map(([, b]) => b));
    for (const [kind, list, matched] of [
      ['only-recording', recording, sourceMatches],
      ['only-yours', mine, mineMatches],
    ] as const)
      list.forEach((note, i) => {
        if (!matched.has(i))
          result.mine.push({
            kind,
            note,
            original: kind === 'only-recording' ? [note] : [],
            written: kind === 'only-yours' ? [note] : [],
          });
      });
    const union = recording.length + mine.length - pairs.length;
    result.bars.push({
      bar,
      matched: pairs.length,
      recording: recording.length,
      mine: mine.length,
      share: union ? pairs.length / union : 1,
    });
  }
  return result;
}
