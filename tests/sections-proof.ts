import type { Doc } from '../src/document';
import { walk } from '../src/document';
import type { EventResult } from '../src/contract';
/** Compare observable notes/durations, excluding parser ids and Hap fragment order. */
export function sectionEvents(result: EventResult, offset = 0) {
  if (result.error) throw Error('Section event query failed');
  return result.events
    .filter((e) => e.hasOnset)
    .map((e) => {
      if (!e.whole || !e.value || typeof e.value !== 'object') throw Error('Expected a note');
      const v = e.value as Record<string, unknown>;
      const start = e.whole[0] - offset;
      return [
        +start.toFixed(7) || 0,
        +(start + (e.whole[1] - e.whole[0]) * (typeof v.clip === 'number' ? v.clip : 1)).toFixed(7),
        v.note,
        v.s,
        v.gain,
      ];
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function sectionMetadata(doc: Doc) {
  const data: unknown[] = [];
  walk(doc, (n) => {
    if ('core' in n)
      data.push({
        source: 'source' in n ? n.source : undefined,
        stem: 'stem' in n ? n.stem : undefined,
        edited: 'edited' in n ? n.edited : undefined,
      });
    if ('pattern' in n && !('kind' in n))
      data.push({ source: n.source, tempo: n.tempo, cycles: n.cycles });
  });
  return data;
}

/** Export time uses each onset's owning place, including its sustained tail. */
export function copiedEventProof(doc: Doc, result: EventResult) {
  const voice = doc.body.find((n) => n.kind === 'voice');
  if (voice?.pattern.core.kind !== 'group') throw Error('Expected arrangement');
  const base = doc.body.filter((n) => n.kind === 'tempo').at(-1)?.cpm ?? 30;
  let songStart = 0,
    copyStart = 0;
  const places = voice.pattern.core.parts.map((p) => {
    const cycles = p.cycles ?? 1,
      scale = p.tempo ? base / p.tempo : 1;
    const place = { songStart, copyStart, songEnd: songStart + cycles, scale };
    songStart += cycles;
    copyStart += cycles * scale;
    return place;
  });
  const events = result.events
    .filter((e) => e.hasOnset)
    .map((e) => {
      if (!e.whole) throw Error('Expected whole event');
      const start = e.whole[0];
      const p = places.find((p) => start >= p.songStart - 1e-8 && start < p.songEnd - 1e-8);
      if (!p) throw Error('Expected event owner');
      const map = (t: number) => p.copyStart + (t - p.songStart) * p.scale;
      return {
        ...e,
        whole: [map(e.whole[0]), map(e.whole[1])] as [number, number],
        part: [map(e.part[0]), map(e.part[1])] as [number, number],
      };
    });
  return { end: copyStart, events: sectionEvents({ ...result, events }) };
}
