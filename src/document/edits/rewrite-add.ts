import {
  instruments,
  shared,
  type Doc,
  type Instrument,
  type Pattern,
  type RewriteLayer,
} from '../index';
import { patternMethods } from '../../import/registry';
import { freshIds, replaceNode, type Refusal } from './shared';
const choices = [
  ['fast', 'Fit the score into less time.', [1]],
  ['slow', 'Spread the score over more time.', [1]],
  ['rev', 'Reverse the score within each cycle.', []],
  ['palindrome', 'Alternate forward and reversed cycles.', []],
  ['ply', 'Repeat each note within its span.', [1]],
  ['degradeBy', 'Leave out a proportion of notes.', [0]],
  ['early', 'Place notes earlier by this many cycles.', [0]],
  ['late', 'Place notes later by this many cycles.', [0]],
  ['euclid', 'Distribute pulses across a number of steps.', [1, 1]],
  ['segment', 'Sample the score this many times per cycle.', [1]],
] as const;
export const rewriteChoices = choices
  .filter(([name]) => patternMethods.has(name))
  .map(([name, description, defaults]) => ({ name, description, defaults }));
/** Parts editable by the score, excluding setting drivers and arrangement uses. */
export function scorePart(doc: Doc, row: Instrument, patternId: string): Pattern | undefined {
  const seen = new Set<string>();
  function owned(p: Pattern): Pattern | undefined {
    if (p.id === patternId) return p;
    if (seen.has(p.id)) return;
    seen.add(p.id);
    if (p.core.kind === 'ref') {
      const target = shared(doc, p.core.name);
      if (target) return owned(target);
    }
    if (p.core.kind === 'group') {
      for (const part of p.core.parts) {
        const found = owned(part.pattern);
        if (found) return found;
      }
    }
  }
  return row.patterns.map(owned).find((p) => !!p);
}
/** Append to a score part, never a setting's driver or an arrangement use. */
export function addRewrite(doc: Doc, patternId: string, name: string): Doc | Refusal {
  const source = instruments(doc)
    .map((row) => scorePart(doc, row, patternId))
    .find((p) => !!p);
  const choice = rewriteChoices.find((c) => c.name === name);
  if (!source || !choice) return { ok: false, reason: 'Choose an instrument and a listed rewrite' };
  const layer: RewriteLayer = {
    id: freshIds(doc)('rewrite'),
    tier: 1,
    kind: 'rewrite',
    name,
    args: choice.defaults.map((value) => ({ kind: 'literal', value })),
  };
  const pattern: Pattern = { ...source, layers: [...source.layers, layer] };
  return replaceNode(doc, patternId, pattern);
}
