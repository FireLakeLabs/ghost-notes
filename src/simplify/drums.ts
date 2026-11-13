import { cycleToSeconds } from '../convert';
import { encode } from './encode';
import { finish, literalNotes, settingsFor } from './report';
import type { SimplifyInput, SimplifyNote } from './types';

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  const union = new Set([...a, ...b]);
  return union.size ? [...union].filter((k) => a.has(k) !== b.has(k)).length / union.size : 0;
}
/** Greedy nearest existing representative; ties choose the earliest bar (study rule). */
export function clusterBars(bars: readonly ReadonlySet<string>[], distance = 0.25): number[] {
  const reps: ReadonlySet<string>[] = [];
  return bars.map((bar) => {
    let best = -1,
      score = Infinity;
    reps.forEach((r, i) => {
      const d = jaccard(bar, r);
      if (d < score) {
        score = d;
        best = i;
      }
    });
    if (best < 0 || score > distance) {
      best = reps.length;
      reps.push(bar);
    }
    return best;
  });
}
export function simplifyDrums(input: SimplifyInput) {
  if (input.conversion.stemId !== 'drums') throw Error('Expected a drum conversion');
  const settings = settingsFor(input);
  const notes = literalNotes(input);
  const { conversion, song } = input;
  const groups = conversion.spans.map((_, i) => notes.filter((n) => n.spanIndex === i));
  const keys = groups.map(
    (g, i) =>
      new Set(
        g.map(
          (n) => `${Number((n.startCycle - conversion.spans[i].startCycle).toFixed(8))}:${n.pitch}`,
        ),
      ),
  );
  const reps: number[] = [];
  const result: SimplifyNote[] = [];
  let dropped = 0,
    added = 0;
  groups.forEach((group, i) => {
    const span = conversion.spans[i];
    // Pickups, partial bars, gaps and uncovered edges are never templates.
    if (!span.bar || span.bar.partial || span.bar.gaps.length || span.kind !== 'bar') {
      result.push(...group);
      return;
    }
    const candidates = reps
      .map((r) => ({ r, distance: jaccard(keys[i], keys[r]) }))
      .filter((x) => x.distance <= settings.barDistance)
      .sort((a, b) => a.distance - b.distance || a.r - b.r);
    for (const { r } of candidates) {
      const template = groups[r];
      if (settings.preserveFills && template.length !== group.length) continue;
      const unused = new Set(group);
      const replacement: SimplifyNote[] = [];
      let newAdded = 0;
      let valid = true;
      for (const t of template) {
        const startCycle = span.startCycle + t.startCycle - conversion.spans[r].startCycle;
        const endCycle = startCycle + t.endCycle - t.startCycle;
        const startSeconds = cycleToSeconds(song, conversion.grid, startCycle);
        const endSeconds = cycleToSeconds(song, conversion.grid, endCycle);
        const nearest = [...unused]
          .filter((n) => n.pitch === t.pitch)
          .sort(
            (a, b) =>
              Math.abs(a.startSeconds - startSeconds) - Math.abs(b.startSeconds - startSeconds),
          )[0];
        if (
          nearest &&
          Math.abs(nearest.startSeconds - startSeconds) <= settings.maxMoveSeconds + 1e-9 &&
          Math.abs(nearest.endSeconds - endSeconds) <= settings.maxMoveSeconds + 1e-9
        ) {
          if (nearest.velocity !== t.velocity) {
            valid = false;
            break;
          }
          unused.delete(nearest);
          replacement.push({
            ...nearest,
            startCycle,
            endCycle,
            startSeconds,
            endSeconds,
            velocity: t.velocity,
          });
        } else {
          newAdded++;
          replacement.push({
            ...t,
            noteIndices: [],
            spanIndex: i,
            startCycle,
            endCycle,
            startSeconds,
            endSeconds,
          });
        }
      }
      if (settings.preserveFills && (newAdded || unused.size)) valid = false;
      const sourceDrops = [...unused].reduce((sum, n) => sum + n.noteIndices.length, 0);
      if (
        !valid ||
        dropped + sourceDrops > conversion.notes.length * settings.maxDropShare + 1e-9 ||
        added + newAdded > conversion.notes.length * settings.maxAddShare + 1e-9
      )
        continue;
      dropped += sourceDrops;
      added += newAdded;
      result.push(...replacement);
      return;
    }
    reps.push(i);
    result.push(...group);
  });
  return finish(input, 'drum-bars', result, encode(conversion, result));
}
