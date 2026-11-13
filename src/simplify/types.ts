import type { ConversionChange, ConvertedInstrument, NoteTime } from '../convert';
import type { ReferenceSong } from '../reference/types';

export type SimplifyNote = NoteTime & {
  /** Original stem indices; empty only for inserted template notes. */
  noteIndices: readonly number[];
  pitch: number;
  velocity: number;
  startCycle: number;
  endCycle: number;
  spanIndex: number;
};
export type SimplifyChange = Omit<ConversionChange, 'kind'> & {
  kind: ConversionChange['kind'] | 'dropped' | 'added';
  originalPitches: readonly number[];
  writtenPitches: readonly number[];
  originalVelocities: readonly number[];
  writtenVelocities: readonly number[];
};
export type MatchSettings = {
  timingToleranceSeconds: number;
  countQuietNotes: boolean;
  quietVelocity: number;
  pitch: 'exact' | 'any-octave';
};
export type SimplifySettings = {
  maxMoveSeconds: number;
  maxDropShare: number;
  maxAddShare: number;
  preserveFills: boolean;
  barDistance: number;
  strayMaxSeconds: number;
  splitGapSeconds: number;
  octaveMaxSeconds: number;
  cleaningVelocity: number;
};
export type SimplifyInput = {
  song: ReferenceSong;
  conversion: ConvertedInstrument;
  settings?: Partial<SimplifySettings>;
  match?: Partial<MatchSettings>;
};
export type Suggestion = {
  technique: string;
  expression: string;
  source: string;
  notes: readonly SimplifyNote[];
  changes: readonly SimplifyChange[];
  report: {
    originalNotes: number;
    suggestedNotes: number;
    matchedNotes: number;
    keptShare: number;
    matchShare: number;
    literalBytes: number;
    suggestedBytes: number;
    shorter: boolean;
  };
  settings: SimplifySettings;
  match: MatchSettings;
};
