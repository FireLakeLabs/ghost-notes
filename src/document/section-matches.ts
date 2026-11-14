import type { ReferenceSong } from '../reference/types';
import { secondsToPosition } from '../reference/beats';
import { sectionRange, overlaps, type BarRange } from './section-range';
export interface MatchSettings {
  timingBeats: number;
  quiet: 'count' | 'ignore';
  pitch: 'exact' | 'class';
}
export const defaultMatchSettings: MatchSettings = {
  timingBeats: 0.13,
  quiet: 'count',
  pitch: 'exact',
};
export interface SectionMatch extends BarRange {
  score: number;
  matched: number;
  reference: number;
  candidate: number;
  selected: true;
}
/** Maximum one-to-one onset matches for each stem/pitch, with multiplicity. */
export function findSectionMatches({
  song,
  range,
  stemIds = song.stems.map((s) => s.id),
  settings = defaultMatchSettings,
}: {
  song: ReferenceSong;
  range: BarRange;
  stemIds?: readonly string[];
  settings?: MatchSettings;
}): SectionMatch[] {
  if (
    !Number.isFinite(settings.timingBeats) ||
    settings.timingBeats < 0 ||
    !['count', 'ignore'].includes(settings.quiet) ||
    !['exact', 'class'].includes(settings.pitch)
  )
    throw Error('Invalid match settings');
  if (
    !stemIds.length ||
    new Set(stemIds).size !== stemIds.length ||
    stemIds.some((id) => !song.stems.some((s) => s.id === id))
  )
    throw Error('Select known instruments');
  const origin = sectionRange(song, range);
  if (range.fromBar === 0) return [];
  function features(r: BarRange) {
    const span = sectionRange(song, r),
      result = new Map<string, number[]>();
    for (const stem of song.stems.filter((s) => stemIds.includes(s.id)))
      for (const n of stem.notes) {
        if (
          n.startSeconds < span.startSeconds ||
          n.startSeconds >= span.endSeconds ||
          (settings.quiet === 'ignore' && n.velocity < 40)
        )
          continue;
        const beat = secondsToPosition(song.beatMap, n.startSeconds).beat;
        if (beat === null) throw Error('Reference grid has no beat for a selected note');
        const pitch = settings.pitch === 'class' && stem.id !== 'drums' ? n.pitch % 12 : n.pitch;
        const key = `${stem.id}:${pitch}`,
          values = result.get(key) ?? [];
        values.push(beat - span.startBeat);
        result.set(key, values);
      }
    for (const values of result.values()) values.sort((a, b) => a - b);
    return result;
  }
  const reference = features(range),
    count = (f: Map<string, number[]>) => [...f.values()].reduce((n, a) => n + a.length, 0);
  const total = count(reference),
    candidates: SectionMatch[] = [];
  // Silence never supplies evidence of a repeated musical phrase.
  if (!total) return [];
  const last = Math.max(
    ...song.bars.filter((b) => b.endSeconds > b.startSeconds).map((b) => b.number),
  );
  const width = range.toBar - range.fromBar;
  for (let fromBar = 1; fromBar + width <= last + 1; fromBar++) {
    const r = { fromBar, toBar: fromBar + width };
    if (overlaps(range, r)) continue;
    const span = sectionRange(song, r);
    if (Math.abs(span.endBeat - span.startBeat - (origin.endBeat - origin.startBeat)) > 1e-9)
      continue;
    const other = features(r);
    let matched = 0;
    for (const [key, left] of reference) {
      const right = other.get(key) ?? [];
      let i = 0,
        j = 0;
      while (i < left.length && j < right.length) {
        const delta = left[i] - right[j];
        if (Math.abs(delta) <= settings.timingBeats + 1e-9) {
          matched++;
          i++;
          j++;
        } else if (delta < 0) i++;
        else j++;
      }
    }
    const candidate = count(other),
      score = matched / (total + candidate - matched);
    if (score >= 0.5)
      candidates.push({ ...r, score, matched, reference: total, candidate, selected: true });
  }
  // Best evidence first; suppress overlapping offers, then show them in song order.
  candidates.sort((a, b) => b.score - a.score || a.fromBar - b.fromBar);
  const picked: SectionMatch[] = [];
  for (const c of candidates) if (!picked.some((p) => overlaps(c, p))) picked.push(c);
  return picked.sort((a, b) => a.fromBar - b.fromBar);
}
