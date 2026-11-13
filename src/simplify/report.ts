import { cycleToSeconds } from '../convert';
import type {
  SimplifyInput,
  SimplifyNote,
  SimplifyChange,
  MatchSettings,
  SimplifySettings,
  Suggestion,
} from './types';

export const defaultSettings: Readonly<SimplifySettings> = {
  maxMoveSeconds: 0.05,
  maxDropShare: 0.1,
  maxAddShare: 0.1,
  preserveFills: true,
  barDistance: 0.25,
  strayMaxSeconds: 0.08,
  splitGapSeconds: 0.03,
  octaveMaxSeconds: 0.2,
  cleaningVelocity: 32,
};
export const defaultMatch: Readonly<MatchSettings> = {
  timingToleranceSeconds: 0.05,
  countQuietNotes: true,
  quietVelocity: 32,
  pitch: 'exact',
};
export function settingsFor(input: SimplifyInput): SimplifySettings {
  const s = { ...defaultSettings, ...input.settings };
  for (const value of [
    s.maxMoveSeconds,
    s.maxDropShare,
    s.maxAddShare,
    s.barDistance,
    s.strayMaxSeconds,
    s.splitGapSeconds,
    s.octaveMaxSeconds,
    s.cleaningVelocity,
  ])
    if (!Number.isFinite(value) || value < 0) throw Error('Invalid simplify limit');
  if ([s.maxDropShare, s.maxAddShare, s.barDistance].some((v) => v > 1))
    throw Error('Expected share in [0,1]');
  if (s.cleaningVelocity > 127) throw Error('Invalid cleaning velocity');
  return s;
}
export function literalNotes({ song, conversion }: SimplifyInput): SimplifyNote[] {
  return conversion.notes
    .filter((n) => n.mergedInto === null)
    .map((n) => ({
      noteIndices: conversion.changes.find(
        (c) => c.kind === 'merged' && c.noteIndices.includes(n.sourceIndex),
      )?.noteIndices ?? [n.sourceIndex],
      pitch: n.source.pitch,
      velocity: n.velocity,
      spanIndex: n.spanIndex,
      startCycle: n.startCycle,
      endCycle: n.endCycle,
      startSeconds: cycleToSeconds(song, conversion.grid, n.startCycle),
      endSeconds: cycleToSeconds(song, conversion.grid, n.endCycle),
    }));
}
/** Maximum-cardinality onset matching: sorted equal-width tolerance intervals per pitch. */
export function matchNotes(
  original: readonly SimplifyNote[],
  written: readonly SimplifyNote[],
  match: MatchSettings,
): number {
  const key = (pitch: number) => (match.pitch === 'exact' ? pitch : pitch % 12);
  let matched = 0;
  const pitches = new Set(original.map((n) => key(n.pitch)));
  for (const pitch of pitches) {
    const a = original
      .filter((n) => key(n.pitch) === pitch)
      .map((n) => n.startSeconds)
      .sort((a, b) => a - b);
    const b = written
      .filter((n) => key(n.pitch) === pitch)
      .map((n) => n.startSeconds)
      .sort((a, b) => a - b);
    let i = 0,
      j = 0;
    while (i < a.length && j < b.length) {
      if (Math.abs(a[i] - b[j]) <= match.timingToleranceSeconds + 1e-9) {
        matched++;
        i++;
        j++;
      } else if (a[i] < b[j]) i++;
      else j++;
    }
  }
  return matched;
}
export function changeRecords(
  input: SimplifyInput,
  notes: readonly SimplifyNote[],
): SimplifyChange[] {
  const stem = input.song.stems.find((s) => s.id === input.conversion.stemId);
  if (!stem) throw Error('Unknown simplify stem');
  const changes: SimplifyChange[] = [];
  const used = new Set<number>();
  for (const n of notes) {
    const original = n.noteIndices.map((i) => stem.notes[i]);
    n.noteIndices.forEach((i) => used.add(i));
    const record = (kind: SimplifyChange['kind']) =>
      changes.push({
        kind,
        noteIndices: n.noteIndices,
        original: original.map((n) => ({ startSeconds: n.startSeconds, endSeconds: n.endSeconds })),
        written: [{ startSeconds: n.startSeconds, endSeconds: n.endSeconds }],
        originalPitches: original.map((n) => n.pitch),
        writtenPitches: [n.pitch],
        originalVelocities: original.map((n) => n.velocity),
        writtenVelocities: [n.velocity],
      });
    if (!original.length) {
      record('added');
      continue;
    }
    if (original.length > 1) record('merged');
    if (
      original.some(
        (o) =>
          Math.abs(o.startSeconds - n.startSeconds) > 1e-8 ||
          o.pitch !== n.pitch ||
          o.velocity !== n.velocity ||
          n.endSeconds - n.startSeconds > o.endSeconds - o.startSeconds + 1e-8,
      )
    )
      record('moved');
    if (original.some((o) => n.endSeconds - n.startSeconds < o.endSeconds - o.startSeconds - 1e-8))
      record('shortened');
    const boundaries = input.conversion.grid.flatMap((s) =>
      s.bar && s.bar.number >= 1 ? [s.startSeconds, s.endSeconds] : [],
    );
    if (
      original.some((o) =>
        boundaries.some(
          (b) =>
            o.startSeconds < b - 1e-8 !== n.startSeconds < b - 1e-8 ||
            o.endSeconds <= b + 1e-8 !== n.endSeconds <= b + 1e-8,
        ),
      )
    )
      record('moved-across-bar-line');
  }
  for (const n of input.conversion.notes)
    if (!used.has(n.sourceIndex)) {
      const o = n.source;
      changes.push({
        kind: 'dropped',
        noteIndices: [n.sourceIndex],
        original: [{ startSeconds: o.startSeconds, endSeconds: o.endSeconds }],
        written: [],
        originalPitches: [o.pitch],
        writtenPitches: [],
        originalVelocities: [o.velocity],
        writtenVelocities: [],
      });
    }
  return changes;
}
export function finish(
  input: SimplifyInput,
  technique: string,
  notes: SimplifyNote[],
  expression: string,
): Suggestion {
  const settings = settingsFor(input);
  const match = { ...defaultMatch, ...input.match };
  if (
    !Number.isFinite(match.timingToleranceSeconds) ||
    match.timingToleranceSeconds < 0 ||
    !Number.isFinite(match.quietVelocity) ||
    match.quietVelocity < 0 ||
    match.quietVelocity > 127
  )
    throw Error('Invalid match settings');
  const original = input.conversion.notes
    .filter((n) => match.countQuietNotes || n.source.velocity >= match.quietVelocity)
    .map((n) => ({
      ...n.source,
      noteIndices: [n.sourceIndex],
      startCycle: n.startCycle,
      endCycle: n.endCycle,
      spanIndex: n.spanIndex,
    }));
  const stem = input.song.stems.find((s) => s.id === input.conversion.stemId);
  if (!stem) throw Error('Unknown simplify stem');
  const counted = notes.filter(
    (n) =>
      match.countQuietNotes ||
      !n.noteIndices.length ||
      n.noteIndices.some((i) => stem.notes[i].velocity >= match.quietVelocity),
  );
  const matchedNotes = matchNotes(original, counted, match);
  const source = `/*@odm-shared {"purpose":"instrument","nameSource":"generated"}*/ const simplifiedInstrument = ${expression};\n$: simplifiedInstrument;`;
  const bytes = (s: string) => new TextEncoder().encode(s).length;
  return {
    technique,
    expression,
    source,
    notes,
    changes: changeRecords(input, notes),
    settings,
    match,
    report: {
      originalNotes: original.length,
      suggestedNotes: counted.length,
      matchedNotes,
      keptShare: original.length ? matchedNotes / original.length : 1,
      matchShare: counted.length ? matchedNotes / counted.length : 1,
      literalBytes: bytes(input.conversion.source),
      suggestedBytes: bytes(source),
      shorter: bytes(source) < bytes(input.conversion.source),
    },
  };
}
