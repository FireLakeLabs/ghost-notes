import type { ReferenceSong } from '../src/reference/types';
import { clusterBars } from '../src/simplify';
/** Reproduce the study's detected-grid, onset-only Python baseline without storing code. */
export function structureStudy(song: ReferenceSong) {
  const beats = song.detectedBeatMap.beats;
  const first = song.detectedBeatMap.downbeats[0];
  const origin = beats.findIndex((b) => b === first);
  const count = Math.floor((beats.length - 1 - origin) / 4);
  const bars = Array.from({ length: count }, () => new Set<string>());
  for (const n of song.stems.find((s) => s.id === 'drums')?.notes ?? []) {
    let i = 0;
    while (i + 1 < beats.length && beats[i + 1] <= n.startSeconds) i++;
    if (n.startSeconds < beats[0] || i >= beats.length - 1) continue;
    const roundEven = (x: number) => {
      const lo = Math.floor(x);
      return x - lo === 0.5 ? lo + (lo % 2) : Math.round(x);
    };
    const tick = roundEven(
      (i - origin + (n.startSeconds - beats[i]) / (beats[i + 1] - beats[i])) * 4,
    );
    const bar = Math.floor(tick / 16),
      slot = tick % 16;
    if (bar >= 0 && bar < count) bars[bar].add(`${slot}:${n.pitch}`);
  }
  const labels = clusterBars(bars);
  const reps = labels
    .map((label, i) => (labels.indexOf(label) === i ? bars[i] : null))
    .filter((b) => b !== null);
  const pat = (b: ReadonlySet<string>) =>
    Array.from({ length: 16 }, (_, slot) => {
      const pitches = [...b]
        .map((k) => k.split(':').map(Number))
        .filter(([s]) => s === slot)
        .sort((a, b) => a[1] - b[1]);
      return pitches.length
        ? `[${pitches.map(([, p]) => (({ 35: 'bd', 38: 'sd', 42: 'hh', 47: 'mt', 49: 'cr' }) as Record<number, string>)[p]).join(',')}]`
        : '~';
    }).join(' ');
  const literal = 's("<' + bars.map((b) => '[' + pat(b) + ']').join(' ') + '>")';
  const defs = reps.map((r, i) => `const drums${i} = s("${pat(r)}");`).join('\n');
  const runs: { count: number; id: number }[] = [];
  for (const id of labels) {
    const last = runs.at(-1);
    if (last?.id === id) last.count++;
    else runs.push({ count: 1, id });
  }
  const compressed =
    defs + '\narrange(' + runs.map((r) => `[${r.count},drums${r.id}]`).join(',') + ')';
  return {
    bars: count,
    exact: new Set(bars.map((b) => [...b].sort().join('|'))).size,
    tolerant: reps.length,
    literalChars: literal.length,
    compressedChars: compressed.length,
  };
}
