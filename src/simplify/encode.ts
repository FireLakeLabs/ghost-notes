import { drumLanes } from '../convert';
import type { ConvertedInstrument } from '../convert';
import type { SimplifyNote } from './types';
const num = (n: number) => String(Number(n.toFixed(10)));
/** A sparse event stack preserves overlaps, gain, duplicates and sustained tails. */
function eventStack(
  notes: readonly SimplifyNote[],
  start: number,
  width: number,
  drum = false,
  pitchOffset = 0,
): string {
  const parts = notes.map((n) => {
    const onset = (n.startCycle - start) / width;
    const denominator =
      Array.from({ length: 64 }, (_, i) => i + 1).find(
        (d) => Math.abs(onset * d - Math.round(onset * d)) < 1e-9,
      ) ?? 1;
    const before = onset * denominator,
      after = (1 - onset) * denominator;
    const token = drum ? drumLanes.find((d) => d.pitch === n.pitch)?.sample : n.pitch - pitchOffset;
    const rhythm = [
      before > 1e-10 ? `~${Math.abs(before - 1) < 1e-9 ? '' : '@' + num(before)}` : '',
      `${token}${Math.abs(after - 1) < 1e-9 ? '' : '@' + num(after)}`,
    ]
      .filter(Boolean)
      .join(' ');
    if (drum && !drumLanes.some((d) => d.pitch === n.pitch))
      throw Error('Unsupported transcription drum class');
    return `${drum ? 's' : 'note'}(${JSON.stringify(rhythm)}).gain(${n.velocity}/127).legato(${num((n.endCycle - n.startCycle) / (width * (1 - onset)))})`;
  });
  return parts.length > 1 ? `stack(${parts.join(',')})` : (parts[0] ?? 'silence');
}
/** Equal gain and duration can share a mini pattern on the chosen grid. */
export function pattern(
  notes: readonly SimplifyNote[],
  start: number,
  width: number,
  drum = false,
  pitchOffset = 0,
): string {
  const denominator = Array.from({ length: 64 }, (_, i) => i + 1).find((d) =>
    notes.every(
      (n) =>
        Math.abs(
          ((n.startCycle - start) / width) * d - Math.round(((n.startCycle - start) / width) * d),
        ) < 1e-9,
    ),
  );
  if (!denominator || !notes.length) return eventStack(notes, start, width, drum, pitchOffset);
  const groups = new Map<string, SimplifyNote[]>();
  for (const n of notes) {
    const key = `${n.velocity}:${num((n.endCycle - n.startCycle) / width)}`;
    const group = groups.get(key) ?? [];
    group.push(n);
    groups.set(key, group);
  }
  const parts = [...groups.values()].map((group) => {
    const slots = Array.from({ length: denominator }, () => [] as string[]);
    for (const n of group) {
      const token = drum
        ? drumLanes.find((d) => d.pitch === n.pitch)?.sample
        : String(n.pitch - pitchOffset);
      if (token === undefined) throw Error('Unsupported transcription drum class');
      slots[Math.round(((n.startCycle - start) / width) * denominator)].push(token);
    }
    const tokens: string[] = [];
    for (let i = 0; i < slots.length;) {
      if (slots[i].length) {
        tokens.push(slots[i].length === 1 ? slots[i][0] : `[${slots[i].join(',')}]`);
        i++;
      } else {
        let end = i + 1;
        while (end < slots.length && !slots[end].length) end++;
        tokens.push(end - i === 1 ? '~' : `~@${end - i}`);
        i = end;
      }
    }
    const n = group[0];
    return `${drum ? 's' : 'note'}(${JSON.stringify(tokens.join(' '))}).gain(${n.velocity}/127).legato(${num(((n.endCycle - n.startCycle) / width) * denominator)})`;
  });
  const compact = parts.length > 1 ? `stack(${parts.join(',')})` : parts[0];
  const fallback = eventStack(notes, start, width, drum, pitchOffset);
  return compact.length < fallback.length ? compact : fallback;
}
/** Definitions are local to the expression, so it is safe to embed in a section. */
export function sequence(parts: readonly { width: number; code: string }[]): string {
  if (!parts.length) return 'silence';
  const definitions: string[] = [];
  const ids = parts.map((p) => {
    const code = Math.abs(p.width - 1) < 1e-9 ? p.code : `(${p.code}).slow(${num(p.width)})`;
    let i = definitions.indexOf(code);
    if (i < 0) {
      i = definitions.length;
      definitions.push(code);
    }
    return { width: p.width, id: i };
  });
  const runs: { width: number; id: number }[] = [];
  for (const p of ids) {
    const last = runs.at(-1);
    if (last && last.id === p.id && Math.abs(p.width - 1) < 1e-9) last.width += p.width;
    else runs.push({ ...p });
  }
  return `(()=>{${definitions.map((d, i) => `const p${i}=${d};`).join('')}return arrange(${runs.map((r) => `[${num(r.width)},p${r.id}]`).join(',')});})()`;
}
export function encode(conversion: ConvertedInstrument, notes: readonly SimplifyNote[]): string {
  const lane = (pitch?: number) =>
    sequence(
      conversion.spans.map((s, i) => ({
        width: s.endCycle - s.startCycle,
        code: pattern(
          notes.filter((n) => n.spanIndex === i && (pitch === undefined || n.pitch === pitch)),
          s.startCycle,
          s.endCycle - s.startCycle,
          pitch !== undefined,
        ),
      })),
    );
  return conversion.stemId === 'drums'
    ? `stack(\n${drumLanes.map((d) => `  ${lane(d.pitch)} /* ${d.sample}: ${d.label} */`).join(',\n')}\n)`
    : `${lane()}.s("triangle")`;
}
