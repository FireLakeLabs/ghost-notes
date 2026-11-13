import type { ReferenceBar, ReferenceNote } from '../reference/types';

export type NoteTime = { startSeconds: number; endSeconds: number };
export type ConversionChange = {
  kind: 'moved' | 'moved-across-bar-line' | 'shortened' | 'merged';
  /** Indices in the source stem, including identical notes as distinct entries. */
  noteIndices: readonly number[];
  original: readonly NoteTime[];
  written: readonly NoteTime[];
};
export type ConversionSpan = {
  kind: 'bar' | 'pickup' | 'uncovered';
  /** Null for uncovered edges: these must not masquerade as detected bars. */
  bar: ReferenceBar | null;
  startSeconds: number;
  endSeconds: number;
  startCycle: number;
  endCycle: number;
};
export type WrittenNote = {
  sourceIndex: number;
  source: ReferenceNote;
  spanIndex: number;
  step: number;
  startCycle: number;
  endCycle: number;
  written: NoteTime;
};
export type ConvertedInstrument = {
  stemId: string;
  spans: readonly ConversionSpan[];
  /** Steps per span, chosen against all onsets in this instrument's span. */
  resolutions: readonly number[];
  /** Full mapping, rebased to the range start, including sustained tails. */
  grid: readonly ConversionSpan[];
  notes: readonly WrittenNote[];
  changes: readonly ConversionChange[];
  /** Pattern expression for embedding in a section/instrument definition. */
  expression: string;
  /** Standalone program with an ODM instrument boundary. */
  source: string;
};
export type Distribution = { median: number; p95: number; max: number };
export type TimingError = { milliseconds: Distribution; beats: Distribution };
