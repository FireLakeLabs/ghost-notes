/** Seconds and beat coordinates are named fields: never substitute MIDI ticks. */
export type Coverage = {
  status: 'complete' | 'partial' | 'missing';
  first_beat_seconds: number | null;
  last_beat_seconds: number | null;
  leading_seconds: number;
  trailing_seconds: number;
  gaps: readonly (readonly [number, number])[];
  gap_threshold_median_multiple: number;
};
export type TempoReview = {
  flagged: boolean;
  reasons: readonly string[];
  selected_multiplier: 1;
  candidate_multipliers: readonly number[];
  candidate_bpm: readonly number[];
  evidence: {
    median_interval_seconds: number | null;
    detected_beats: number;
    review_bpm_range: readonly number[];
  };
};
export type BeatMap = {
  beats: readonly number[];
  downbeats: readonly number[];
  beatsPerBar: number;
  durationSeconds: number;
  medianBpm: number | null;
  coverage: Coverage;
  tempoReview: TempoReview;
};
export type Position =
  | { kind: 'detected' | 'gap'; seconds: number; beat: number; bar: number; beatInBar: number }
  | { kind: 'uncovered'; seconds: number; bar: 0 | null; beat: null; beatInBar: null };
/** The final downbeat may be a zero-length partial bar with null BPM. */
export type ReferenceBar = {
  number: number;
  startSeconds: number;
  endSeconds: number;
  startBeat: number;
  endBeat: number;
  bpm: number | null;
  partial: boolean;
  /** Tool-marked intervals; never interpreted as a missing-beat count. */
  gaps: Coverage['gaps'];
};
export type ReferenceNote = {
  startSeconds: number;
  endSeconds: number;
  pitch: number;
  velocity: number;
  start: Position;
  end: Position;
};
export type ReferenceStem = {
  id: string;
  levelDb: number;
  transcription: 'complete' | 'skipped_quiet';
  audioPath: string;
  midiPath: string;
  notes: readonly ReferenceNote[];
  noteSource: 'notes' | 'midi';
  midiNotes: readonly ReferenceNote[];
};
export type ReferenceSong = {
  name: string;
  durationSeconds: number;
  pickupBeats: number;
  beatMap: BeatMap;
  bars: readonly ReferenceBar[];
  stems: readonly ReferenceStem[];
};
/** The only input dependency of the reader. Implementations must stay local. */
export interface SongFiles {
  read(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
}
