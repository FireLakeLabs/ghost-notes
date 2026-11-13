import { referenceBars } from './beats';
import type { BeatGrid, BeatMap, GridInference, GridMultiplier } from './types';

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b),
    i = sorted.length >> 1;
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}
const close = (a: number, b: number) => Math.abs(a / b - 1) <= 0.15;
/** Robust trailing estimate, folding only near-octave changes. Non-octave changes
 * and gradual drift update the window; exact octave tempo intent is ambiguous. */
export function localBarLengths(map: BeatMap): number[] {
  const bars = referenceBars(map).filter((b) => !b.partial);
  const reliable = bars.filter(
    (b) => !b.gaps.length && b.endBeat - b.startBeat === map.beatsPerBar,
  );
  const seed = median(
    (reliable.length ? reliable : bars).slice(0, 5).map((b) => b.endSeconds - b.startSeconds),
  );
  const history = [seed];
  return bars.map((bar) => {
    const estimate = median(history.slice(-7)),
      length = bar.endSeconds - bar.startSeconds;
    if (bar.gaps.length) return estimate;
    const factor = [1, 0.5, 2, 0.25, 4].find((f) => close(length / f, estimate));
    const folded = factor ? length / factor : length;
    history.push(folded);
    return median(history.slice(-7));
  });
}

/** Pure derived layer. Never extends coverage or mutates the detected map. */
export function deriveGrid(detected: BeatMap, multiplier: GridMultiplier = 1): BeatGrid {
  const targets = localBarLengths(detected),
    observed = referenceBars(detected).filter((b) => !b.partial);
  const inferences: GridInference[] = [];
  const downbeats: number[] = detected.downbeats.length ? [detected.downbeats[0]] : [];
  for (let i = 0; i < observed.length; i++) {
    const bar = observed[i],
      start = bar.startSeconds,
      target = targets[i] / multiplier;
    let end = bar.endSeconds;
    if (end - start < target * 0.85) {
      // Prefer one local bar; allow two when phase errors straddle a bar line.
      let match: { end: number; index: number } | undefined;
      for (const count of [1, 2]) {
        for (let j = i + 1; j < Math.min(observed.length, i + 8); j++) {
          const candidate = observed[j].endSeconds;
          const split = (start + candidate) / 2;
          const supportedSplit =
            count === 1 ||
            detected.beats.some(
              (beat) => Math.abs(beat - split) < (target / detected.beatsPerBar) * 0.15,
            );
          if (close(candidate - start, target * count) && supportedSplit) {
            match = { end: candidate, index: j };
            break;
          }
          if (candidate - start > target * count * 1.15) break;
        }
        if (match) break;
      }
      if (match) {
        end = match.end;
        for (let k = i; k < match.index; k++)
          inferences.push({
            kind: 'merge-short-bars',
            seconds: observed[k].endSeconds,
            source: [start, end],
          });
        i = match.index;
      }
    }
    const length = end - start;
    const pieces =
      !detected.coverage.gaps.some(([a, b]) => a < end && b > start) &&
      (close(length, 2 * target) || close(length, 4 * target))
        ? Math.round(length / target)
        : 1;
    for (let k = 1; k < pieces; k++) {
      const ideal = start + (length * k) / pieces;
      // A detected beat near the division keeps real microtiming.
      const near = detected.beats.find(
        (b) => Math.abs(b - ideal) < (target / detected.beatsPerBar) * 0.15,
      );
      const seconds = near ?? ideal;
      downbeats.push(seconds);
      inferences.push({ kind: 'split-long-bar', seconds, source: [start, end] });
    }
    downbeats.push(end);
  }
  const first = downbeats[0],
    last = downbeats.at(-1);
  const partialStarts = new Set<number>();
  const beats = detected.beats.filter((b) => first === undefined || b < first);
  for (let i = 0; i + 1 < downbeats.length; i++) {
    const a = downbeats[i],
      b = downbeats[i + 1];
    const original = detected.beats.filter((t) => t >= a && t < b);
    beats.push(a);
    // A short terminal segment has no following evidence to complete a bar.
    if (i === downbeats.length - 2 && b - a < ((targets.at(-1) ?? 0) / multiplier) * 0.85) {
      partialStarts.add(a);
      beats.push(...original.filter((t) => t > a));
      continue;
    }
    if (detected.coverage.gaps.some(([x, y]) => x < b && y > a)) {
      beats.push(...original.filter((t) => t > a));
      continue; // Do not assign a missing-beat count through true gaps (G45).
    }
    if (original.length === detected.beatsPerBar && original[0] === a) {
      beats.push(...original.slice(1));
      continue;
    }
    const retained = new Set([a]);
    for (let k = 1; k < detected.beatsPerBar; k++) {
      const ideal = a + ((b - a) * k) / detected.beatsPerBar;
      const near = original.find(
        (t) => !retained.has(t) && Math.abs(t - ideal) < ((b - a) / detected.beatsPerBar) * 0.15,
      );
      const seconds = near ?? ideal;
      retained.add(seconds);
      beats.push(seconds);
      if (near === undefined) inferences.push({ kind: 'fill-beat', seconds, source: [a, b] });
    }
    for (const seconds of original)
      if (!retained.has(seconds)) inferences.push({ kind: 'thin-beat', seconds, source: [a, b] });
  }
  // Pickup and final partial bar retain observed beats; no extrapolated outro.
  beats.push(...detected.beats.filter((b) => last !== undefined && b >= last));
  const map: BeatMap = { ...detected, beats, downbeats };
  const bars = referenceBars(map).map((bar) => ({
    ...bar,
    partial: bar.partial || partialStarts.has(bar.startSeconds),
    inferences: inferences.filter(
      (i) => i.seconds >= bar.startSeconds && i.seconds < bar.endSeconds,
    ),
  }));
  return { multiplier, map, bars, inferences };
}
export function gridCandidates(map: BeatMap): readonly BeatGrid[] {
  return ([0.5, 1, 2] as const).map((multiplier) => deriveGrid(map, multiplier));
}
