import type { ReferenceBar, ReferenceNote } from '../reference/types';

export const conversionGrids = [1, 2, 3, 4, 6, 8, 16, 'exact'] as const;
export type ConversionGrid = (typeof conversionGrids)[number];
export const defaultConversionGrid: ConversionGrid = 4;

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
  /** Highest velocity in a merged group; source retains the original. */
  velocity: number;
  /** Representative source index, or null when this note emits an event. */
  mergedInto: number | null;
};
export type ConvertedInstrument = {
  stemId: string;
  quantization: ConversionGrid;
  spans: readonly ConversionSpan[];
  /** Steps per span. Uncovered spans always use adaptive exact resolution. */
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
