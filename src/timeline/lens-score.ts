import {
  sectionInstruments,
  shared,
  type Doc,
  type Instrument,
  type Pattern,
  type Layer,
} from '../document';
import { sectionRange } from '../document/section-range';
import type { ReferenceSong } from '../reference/types';
import type { SongSection } from '../document';

export type LensPart = { pattern: Pattern; from: number; to: number; layers: Layer[] };
/** Editable document addresses, separate from the full-context queried score. */
export function lensParts(doc: Doc, row: Instrument, from: number, to: number): LensPart[] {
  const parts: LensPart[] = [];
  function visit(p: Pattern, start: number, end: number, layers: Layer[], seen: Set<string>) {
    if (seen.has(p.id)) return;
    seen = new Set(seen).add(p.id);
    const c = p.core;
    if (c.kind === 'ref') {
      const target = shared(doc, c.name);
      if (target) return visit(target, start, end, [...p.layers, ...layers], seen);
    }
    // Across-time rewrites keep a whole-pattern source target rather than inventing bar ownership.
    const structural = p.layers.every((l) => l.kind === 'settings');
    if (c.kind === 'group' && c.how === 'arrange' && structural) {
      if (c.parts.reduce((sum, part) => sum + (part.cycles ?? 1), 0) < end - start - 1e-9) {
        parts.push({ pattern: p, from: start, to: end, layers });
        return;
      }
      let cursor = start;
      for (const part of c.parts) {
        const stop = cursor + (part.cycles ?? 1);
        visit(part.pattern, cursor, stop, [...p.layers, ...layers], seen);
        cursor = stop;
      }
    } else if (c.kind === 'group' && c.how === 'stack' && structural) {
      for (const part of c.parts) visit(part.pattern, start, end, [...p.layers, ...layers], seen);
    } else parts.push({ pattern: p, from: start, to: end, layers });
  }
  visit(row.pattern, from, to, [], new Set());
  return parts;
}

export function lensScore({
  doc,
  song,
  place,
  bar,
  choices,
}: {
  doc: Doc;
  song: ReferenceSong;
  place: SongSection;
  bar: number;
  choices: ReadonlyMap<string, string>;
}) {
  if (!place.source) throw Error('Missing place bars');
  const whole = sectionRange(song, place.source);
  const selected = sectionRange(song, { fromBar: bar, toBar: bar + 1 });
  const options = sectionInstruments(doc, place.id).map((row) => {
    const parts = lensParts(doc, row, whole.startCycle, whole.endCycle).filter(
      (p) => p.from < selected.endCycle && p.to > selected.startCycle,
    );
    const part =
      parts.find((p) => p.pattern.id === choices.get(row.pattern.stem ?? row.id)) ?? parts[0];
    return { row, parts, part };
  });
  return {
    fromCycle: selected.startCycle,
    toCycle: selected.endCycle,
    options,
    rows: options.flatMap(({ row, part }) =>
      part
        ? [
            {
              ...row,
              pattern: part.pattern,
              uses: row.uses.map((use) => ({ ...use, layers: [...part.layers, ...use.layers] })),
            },
          ]
        : [],
    ),
  };
}
