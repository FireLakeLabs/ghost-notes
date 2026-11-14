import {
  convertInstrument,
  conversionSpans,
  cycleToSeconds,
  type ConversionGrid,
  type ConvertedInstrument,
} from '../convert';
import type { Doc, Instrument, SongSection } from '../document';
import { sectionRange } from '../document/section-range';
import type { EventResult } from '../contract';
import type { ReferenceNote, ReferenceSong, ReferenceStem } from '../reference/types';
import { secondsToPosition } from '../reference/beats';
import { drumLane } from './layout';
import { scoredNotes } from '../strudel/notes';

export type TimelineScore = {
  doc: Doc | null;
  instruments: Instrument[];
  places: SongSection[];
  events: Record<string, EventResult>;
  linked: boolean;
  grid: ConversionGrid;
};
export type MaterialPlace = {
  id: string;
  name: string;
  edited: boolean;
  fromBar: number;
  toBar: number;
  startSeconds: number;
  endSeconds: number;
};
export type RowMaterial = { notes: readonly ReferenceNote[]; message: string };
export type InstrumentMaterial = {
  literal: RowMaterial;
  mine: RowMaterial;
  conversion?: ConvertedInstrument;
  places: MaterialPlace[];
};
const empty: RowMaterial = { notes: [], message: '' };
export function timedNote(
  song: ReferenceSong,
  startSeconds: number,
  endSeconds: number,
  pitch: number,
  velocity: number,
): ReferenceNote {
  return {
    startSeconds,
    endSeconds,
    pitch,
    velocity,
    start: secondsToPosition(song.beatMap, startSeconds),
    end: secondsToPosition(song.beatMap, endSeconds),
  };
}
/** Cache the conversion independently: changing Mine never reinterprets the recording. */
export function createMaterial() {
  let song: ReferenceSong | null = null;
  let grid: ConversionGrid = 4;
  let previousScore: TimelineScore | undefined;
  const results = new Map<string, InstrumentMaterial>();
  const literals = new Map<string, { conversion?: ConvertedInstrument; literal: RowMaterial }>();
  return (
    reference: ReferenceSong,
    stem: ReferenceStem,
    score: TimelineScore,
  ): InstrumentMaterial => {
    if (reference !== song || score.grid !== grid) {
      song = reference;
      grid = score.grid;
      literals.clear();
      results.clear();
    }
    if (previousScore !== score) {
      results.clear();
      previousScore = score;
    }
    const previous = results.get(stem.id);
    if (previous) return previous;
    let cached = literals.get(stem.id);
    if (!cached) {
      try {
        const conversion = convertInstrument({ song, stemId: stem.id, grid });
        cached = {
          conversion,
          literal: {
            message: '',
            notes: conversion.notes
              .filter((n) => n.mergedInto === null)
              .map((n) =>
                timedNote(
                  reference,
                  n.written.startSeconds,
                  n.written.endSeconds,
                  n.source.pitch,
                  n.velocity,
                ),
              ),
          },
        };
      } catch (e) {
        cached = {
          literal: { notes: [], message: e instanceof Error ? e.message : 'Conversion failed' },
        };
      }
      literals.set(stem.id, cached);
    }
    const result: InstrumentMaterial = { ...cached, mine: empty, places: [] };
    results.set(stem.id, result);
    if (!score.doc || !score.linked) {
      result.mine = { notes: [], message: 'Unarranged · no linked arrangement' };
      return result;
    }
    const instruments = score.instruments.filter((row) =>
      row.patterns.some((p) => p.stem === stem.id),
    );
    const ids = new Set(instruments.map((row) => row.id));
    const places = score.places.filter(
      (p) => p.source && p.instrumentIds.some((id) => ids.has(id)),
    );
    try {
      result.places = places.flatMap((p) => {
        if (!p.source) return [];
        const span = sectionRange(reference, p.source);
        return [
          {
            id: p.id,
            name: p.name,
            edited: !!p.edited,
            fromBar: p.source.fromBar,
            toBar: p.source.toBar,
            startSeconds: span.startSeconds,
            endSeconds: span.endSeconds,
          },
        ];
      });
    } catch {
      result.mine = {
        notes: [],
        message: 'Reference bars for this place are unavailable. Reopen its chosen grid.',
      };
      return result;
    }
    if (!instruments.length) return result;
    const spans = cached.conversion?.grid ?? conversionSpans(reference, reference.bars);
    if (!spans.length) {
      result.mine = { notes: [], message: 'Cannot map the score without reference bars' };
      return result;
    }
    const notes: ReferenceNote[] = [];
    let unmapped = 0;
    for (const row of instruments) {
      const events = score.events[row.id];
      if (!events) {
        result.mine = { notes: [], message: 'Asking your Strudel…' };
        return result;
      }
      if (events.error) {
        result.mine = { notes: [], message: `Could not ask your Strudel: ${events.error.message}` };
        return result;
      }
      const scored = scoredNotes(events.events, stem.id === 'drums');
      unmapped += scored.unmapped;
      for (const n of scored.notes) {
        if (stem.id === 'drums' && drumLane(n.pitch) === null) {
          unmapped++;
          continue;
        }
        const start = cycleToSeconds(reference, spans, n.startCycle);
        notes.push(
          timedNote(
            reference,
            start,
            cycleToSeconds(reference, spans, n.endCycle),
            n.pitch,
            n.velocity,
          ),
        );
      }
    }
    result.mine = {
      notes,
      message: unmapped
        ? `${unmapped} queried events could not be placed by pitch or drum lane`
        : '',
    };
    return result;
  };
}
