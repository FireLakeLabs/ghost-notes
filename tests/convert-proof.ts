import type { EventResult } from '../src/contract';
import type { ConvertedInstrument, Distribution, TimingError } from '../src/convert';
import { cycleToSeconds, drumLanes } from '../src/convert';
import { secondsToPosition } from '../src/reference/beats';
import type { ReferenceNote, ReferenceSong } from '../src/reference/types';

function distribution(values: number[]): Distribution {
  values.sort((a, b) => a - b);
  const at = (p: number) => values[Math.max(0, Math.ceil(values.length * p) - 1)] ?? 0;
  return { median: at(0.5), p95: at(0.95), max: at(1) };
}
/** Match multisets by pitch + velocity, ordered by onset and duration. No source IDs
 * are embedded in Strudel, so duplicate identical notes must survive as multiplicity. */
export function roundTripProof(
  song: ReferenceSong,
  conversion: ConvertedInstrument,
  expected: readonly ReferenceNote[],
  result: EventResult,
) {
  if (result.error) throw Error(`Strudel ${result.error.phase}: ${result.error.message}`);
  const key = (pitch: number, gain: number) => `${pitch}:${gain.toFixed(10)}`;
  const sources = new Map<string, ReferenceNote[]>();
  for (const note of expected) {
    const id = key(note.pitch, note.velocity / 127);
    const group = sources.get(id) ?? [];
    group.push(note);
    sources.set(id, group);
  }
  const written = new Map<string, { start: number; end: number }[]>();
  for (const event of result.events.filter((e) => e.hasOnset)) {
    if (!event.whole || !event.value || typeof event.value !== 'object')
      throw Error('Expected note event');
    const value = event.value as Record<string, unknown>;
    const pitch =
      conversion.stemId === 'drums'
        ? drumLanes.find((d) => d.sample === value.s)?.pitch
        : value.note;
    if (
      typeof pitch !== 'number' ||
      typeof value.gain !== 'number' ||
      typeof value.clip !== 'number'
    )
      throw Error('Expected pitch, gain and legato');
    const start = event.whole[0];
    const end = start + (event.whole[1] - start) * value.clip;
    const group = written.get(key(pitch, value.gain)) ?? [];
    group.push({
      start: cycleToSeconds(song, conversion.grid, start),
      end: cycleToSeconds(song, conversion.grid, end),
    });
    written.set(key(pitch, value.gain), group);
  }
  const milliseconds: number[] = [],
    beats: number[] = [];
  let missing = 0,
    duplicated = 0,
    once = 0,
    durationMaxMs = 0;
  function beatAt(seconds: number) {
    const position = secondsToPosition(song.beatMap, seconds);
    if (position.beat !== null) return position.beat;
    const times = song.beatMap.beats;
    const i = seconds < times[0] ? 0 : times.length - 2;
    const anchor = secondsToPosition(song.beatMap, times[i]);
    if (anchor.beat === null) throw Error('Expected beat anchor');
    return anchor.beat + (seconds - times[i]) / (times[i + 1] - times[i]);
  }
  for (const id of new Set([...sources.keys(), ...written.keys()])) {
    const a = (sources.get(id) ?? []).sort(
      (a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds,
    );
    const b = (written.get(id) ?? []).sort((a, b) => a.start - b.start || a.end - b.end);
    missing += Math.max(0, a.length - b.length);
    duplicated += Math.max(0, b.length - a.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      once++;
      milliseconds.push(Math.abs(b[i].start - a[i].startSeconds) * 1000);
      beats.push(Math.abs(beatAt(b[i].start) - beatAt(a[i].startSeconds)));
      durationMaxMs = Math.max(
        durationMaxMs,
        Math.abs(b[i].end - b[i].start - (a[i].endSeconds - a[i].startSeconds)) * 1000,
      );
    }
  }
  const timing: TimingError = {
    milliseconds: distribution(milliseconds),
    beats: distribution(beats),
  };
  return {
    notes: expected.length,
    once,
    missing,
    duplicated,
    timing,
    durationMaxMs,
    milliseconds,
    beats,
  };
}
export function combinedTiming(proofs: ReturnType<typeof roundTripProof>[]): TimingError {
  return {
    milliseconds: distribution(proofs.flatMap((p) => p.milliseconds)),
    beats: distribution(proofs.flatMap((p) => p.beats)),
  };
}

/** Prove emitted events against written endpoints, then account for every source
 * through an event or an explicit many-to-one merge. Original notes stay private. */
export function gridRoundTripProof(
  song: ReferenceSong,
  conversion: ConvertedInstrument,
  expected: readonly ReferenceNote[],
  result: EventResult,
) {
  const records = conversion.notes;
  if (
    records.length !== expected.length ||
    new Set(records.map((n) => n.sourceIndex)).size !== expected.length
  )
    throw Error('Source accounting mismatch');
  for (const n of records) {
    if (n.source !== expected[n.sourceIndex]) throw Error('Source identity mismatch');
    if (n.mergedInto === null) continue;
    const representative = records.find((r) => r.sourceIndex === n.mergedInto);
    const merge = conversion.changes.find(
      (c) =>
        c.kind === 'merged' &&
        c.noteIndices[0] === n.mergedInto &&
        c.noteIndices.includes(n.sourceIndex),
    );
    if (
      !representative ||
      representative.mergedInto !== null ||
      !merge ||
      merge.written.length !== 1 ||
      merge.noteIndices.length !== merge.original.length ||
      representative.spanIndex !== n.spanIndex ||
      representative.step !== n.step ||
      representative.source.pitch !== n.source.pitch ||
      representative.written.startSeconds !== n.written.startSeconds ||
      representative.written.endSeconds !== n.written.endSeconds ||
      representative.velocity !== n.velocity
    )
      throw Error('Unrecorded or inconsistent merge');
  }
  const emitted = records
    .filter((n) => n.mergedInto === null)
    .map((n) => ({ ...n.source, ...n.written, velocity: n.velocity }));
  const proof = roundTripProof(song, conversion, emitted, result);
  if (
    proof.missing ||
    proof.duplicated ||
    proof.timing.milliseconds.max > 1e-5 ||
    proof.durationMaxMs > 1e-5
  )
    throw Error('Queried events disagree with written endpoints');
  return { once: proof.once, merged: records.length - emitted.length };
}
