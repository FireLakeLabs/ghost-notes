import type {
  BeatMap,
  Coverage,
  ReferenceNote,
  ReferenceSong,
  ReferenceStem,
  SongFiles,
  TempoReview,
} from './types';
import * as v from './validate';
import { referenceBars, secondsToPosition } from './beats';
import { midiNotes } from './midi';

async function json(files: SongFiles, path: string) {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(await files.read(path)));
  } catch {
    throw Error('Cannot read reference JSON. Check that the folder export is complete.');
  }
  return v.version(value);
}
function ordered(value: unknown, duration: number): number[] {
  const values = v.array(value, 'beat times').map((n) => v.number(n, 'beat time', 0, duration));
  if (values.some((n, i) => i > 0 && n <= values[i - 1])) v.invalid('beat order');
  return values;
}
function beatMap(doc: Record<string, unknown>): BeatMap {
  const durationSeconds = v.number(doc.duration_seconds, 'duration', 0);
  const beats = ordered(doc.beats, durationSeconds),
    downbeats = ordered(doc.downbeats, durationSeconds);
  if (downbeats.some((n) => !beats.includes(n))) v.invalid('downbeat outside detected beats');
  const c = v.object(doc.coverage, 'coverage'),
    t = v.object(doc.tempo_review, 'tempo review');
  const e = v.object(t.evidence, 'tempo evidence');
  if (c.status !== 'complete' && c.status !== 'partial' && c.status !== 'missing')
    v.invalid('coverage status');
  const coverage: Coverage = {
    status: c.status,
    first_beat_seconds: v.nullableNumber(c.first_beat_seconds, 'first beat'),
    last_beat_seconds: v.nullableNumber(c.last_beat_seconds, 'last beat'),
    leading_seconds: v.number(c.leading_seconds, 'leading coverage', 0),
    trailing_seconds: v.number(c.trailing_seconds, 'trailing coverage', 0),
    gaps: v.array(c.gaps, 'gaps').map((gap) => {
      const pair = v.array(gap, 'gap');
      if (pair.length !== 2) v.invalid('gap');
      const a = v.number(pair[0], 'gap start', 0, durationSeconds),
        b = v.number(pair[1], 'gap end', a, durationSeconds);
      if (!beats.includes(a) || beats[beats.indexOf(a) + 1] !== b) v.invalid('gap endpoints');
      return [a, b] as const;
    }),
    gap_threshold_median_multiple: v.number(c.gap_threshold_median_multiple, 'gap threshold', 0),
  };
  if (
    coverage.first_beat_seconds !== (beats[0] ?? null) ||
    coverage.last_beat_seconds !== (beats.at(-1) ?? null)
  )
    v.invalid('coverage endpoints');
  if (t.selected_multiplier !== 1) v.invalid('selected tempo multiplier');
  const tempoReview: TempoReview = {
    flagged: v.boolean(t.flagged, 'tempo flag'),
    reasons: v.array(t.reasons, 'tempo reasons').map((x) => v.string(x, 'tempo reason')),
    selected_multiplier: 1,
    candidate_multipliers: v
      .array(t.candidate_multipliers, 'tempo candidates')
      .map((x) => v.number(x, 'tempo multiplier', 0)),
    candidate_bpm: v
      .array(t.candidate_bpm, 'tempo candidates')
      .map((x) => v.number(x, 'tempo candidate', 0)),
    evidence: {
      median_interval_seconds: v.nullableNumber(e.median_interval_seconds, 'median interval'),
      detected_beats: v.integer(e.detected_beats, 'detected count'),
      review_bpm_range: v
        .array(e.review_bpm_range, 'review range')
        .map((x) => v.number(x, 'review range', 0)),
    },
  };
  return {
    durationSeconds,
    beats,
    downbeats,
    beatsPerBar: v.integer(doc.beats_per_bar, 'meter', 1),
    medianBpm: v.nullableNumber(doc.bpm_median, 'median tempo'),
    coverage,
    tempoReview,
  };
}
export function referenceNote(map: BeatMap, row: unknown): ReferenceNote {
  const values = v.array(row, 'note');
  if (values.length !== 4) v.invalid('note tuple');
  const startSeconds = v.number(values[0], 'note start', 0),
    endSeconds = v.number(values[1], 'note end', startSeconds);
  return {
    startSeconds,
    endSeconds,
    pitch: v.integer(values[2], 'pitch', 0, 127),
    velocity: v.integer(values[3], 'velocity', 1, 127),
    start: secondsToPosition(map, startSeconds),
    end: secondsToPosition(map, endSeconds),
  };
}
export async function readReference(files: SongFiles): Promise<ReferenceSong> {
  const doc = await json(files, 'song.json');
  const map = beatMap(await json(files, v.relativePath(doc.beats)));
  const durationSeconds = v.number(doc.duration_seconds, 'duration', 0);
  if (Math.abs(durationSeconds - map.durationSeconds) > 0.0001) v.invalid('inconsistent duration');
  const notesPath = v.relativePath(doc.notes);
  const notesDoc = (await files.exists(notesPath)) ? await json(files, notesPath) : null;
  if (notesDoc && notesDoc.time_unit !== 'seconds') v.invalid('note time unit');
  const noteStems = notesDoc ? v.object(notesDoc.stems, 'note stems') : null;
  // Parse MIDI only after the richer JSON. Its conductor extrapolation is not a beat map.
  midiNotes(await files.read(v.relativePath(doc.midi)));
  const seen = new Set<string>();
  const stems: ReferenceStem[] = [];
  for (const raw of v.array(doc.stems, 'stems')) {
    const stem = v.object(raw, 'stem'),
      id = v.string(stem.id, 'stem id');
    if (seen.has(id)) v.invalid('duplicate stem');
    seen.add(id);
    if (stem.transcription !== 'complete' && stem.transcription !== 'skipped_quiet')
      v.invalid('transcription status');
    const midiPath = v.relativePath(stem.midi);
    const midi = midiNotes(await files.read(midiPath)).map((row) => referenceNote(map, row));
    const notes = noteStems
      ? v.array(noteStems[id], 'stem notes').map((row) => referenceNote(map, row))
      : midi;
    stems.push({
      id,
      levelDb: v.number(stem.level_db, 'stem level'),
      transcription: stem.transcription,
      audioPath: v.relativePath(stem.audio),
      midiPath,
      notes,
      noteSource: noteStems ? ('notes' as const) : ('midi' as const),
      midiNotes: midi,
    });
  }
  if (!stems.length) v.invalid('no stems');
  const pickupBeats = v.integer(doc.pickup_beats, 'pickup beats');
  if (pickupBeats !== map.beats.filter((b) => b < (map.downbeats[0] ?? 0)).length)
    v.invalid('pickup count');
  return {
    name: v.string(doc.name, 'song name'),
    durationSeconds,
    pickupBeats,
    beatMap: map,
    bars: referenceBars(map),
    stems,
  };
}
