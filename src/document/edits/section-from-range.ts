import { convertInstrument, conversionSpans, type ConversionGrid } from '../../convert';
import {
  simplifyDrums,
  simplifyPitched,
  type SimplifySettings,
  type MatchSettings,
} from '../../simplify';
import { importStrudel } from '../../import';
import { sectionSource } from '../links';
import { sectionRange, overlaps, type BarRange } from '../section-range';
import type { ReferenceSong } from '../../reference/types';
import { walk, voices, type Doc, type GroupPart, type Pattern } from '../index';
import { freshIds } from './shared';
import { song as arrangement, replaceParts } from './section-shared';

/** One pure document edit, including selected reuse places and whole-place takeover. */
export function makeSectionFromRange({
  doc,
  song,
  folder,
  range,
  name,
  stemIds = song.stems.map((s) => s.id),
  beats,
  places = [],
  grid,
  starting = 'literal',
  simplify,
  match,
}: {
  doc: Doc;
  song: ReferenceSong;
  folder: string;
  range: BarRange;
  name: string;
  stemIds?: readonly string[];
  beats?: { fromBeat: number; toBeat: number };
  places?: readonly BarRange[];
  grid?: ConversionGrid;
  starting?: 'literal' | 'simplified' | 'silence';
  simplify?: Partial<SimplifySettings>;
  match?: Partial<MatchSettings>;
}) {
  const source = sectionSource({ folder, ...range });
  if (!source || !name.trim()) throw Error('Supply a section name and local folder basename');
  if (
    !stemIds.length ||
    new Set(stemIds).size !== stemIds.length ||
    stemIds.some((id) => !song.stems.some((s) => s.id === id))
  )
    throw Error('Select known instruments');
  const selected = sectionRange(song, range);
  if (
    beats &&
    (!Number.isFinite(beats.fromBeat) ||
      !Number.isFinite(beats.toBeat) ||
      beats.fromBeat >= beats.toBeat ||
      beats.fromBeat < selected.startBeat ||
      beats.toBeat > selected.endBeat)
  )
    throw Error('Beat selection must lie inside its whole bars');
  if (beats && places.length) throw Error('Reuse offers require a whole-bar selection');
  const targets = [range, ...places]
    .map((r) => sectionRange(song, r))
    .sort((a, b) => a.fromBar - b.fromBar);
  for (const [i, target] of targets.entries()) {
    if (
      Math.abs(target.cycles - selected.cycles) > 1e-9 ||
      (range.fromBar === 0 && places.length) ||
      (i && overlaps(target, targets[i - 1]))
    )
      throw Error('Reuse places must be separate ranges of the same length');
  }
  const root = arrangement(doc);
  if (voices(doc).length && !root)
    throw Error('Make sections in an empty or linked reference arrangement');
  if (root?.layers.length) throw Error('A linked arrangement cannot have root rewrites');
  const previous = root?.core.kind === 'group' ? root.core.parts : [];
  for (const p of previous) {
    if (!p.source && p.pattern.core.kind === 'generator' && p.pattern.core.name === 'silence')
      continue;
    if (!p.source || p.source.folder !== folder)
      throw Error('Reopen the arrangement reference before adding sections');
    const span = sectionRange(song, p.source);
    if (Math.abs(span.cycles - (p.cycles ?? 1)) > 1e-9)
      throw Error('Place length disagrees with reference bars');
  }
  const link = (p: GroupPart) => {
    if (!p.source) throw Error('Missing place source');
    return p.source;
  };
  const fresh = freshIds(doc),
    definitions: Doc['body'] = [];
  const reference = (name: string): Pattern => ({
    id: fresh('use'),
    tier: 1,
    core: { kind: 'ref', name },
    layers: [],
  });
  const instruments: GroupPart[] = [];
  const filteredSong = beats
    ? {
        ...song,
        stems: song.stems.map((s) => ({
          ...s,
          notes: s.notes.filter(
            (n) =>
              n.start.beat !== null &&
              n.start.beat >= beats.fromBeat &&
              n.start.beat < beats.toBeat,
          ),
        })),
      }
    : song;
  for (const stem of song.stems.filter((s) => stemIds.includes(s.id))) {
    const c = convertInstrument({ song: filteredSong, stemId: stem.id, range, grid });
    const source =
      starting === 'silence'
        ? '/*@odm-shared {"purpose":"instrument"}*/ const literal = silence; $: literal;'
        : starting === 'simplified'
          ? ((stem.id === 'drums'
              ? [simplifyDrums({ song: filteredSong, conversion: c, settings: simplify, match })]
              : simplifyPitched({ song: filteredSong, conversion: c, settings: simplify, match })
            )
              .filter((p) => p.report.shorter)
              .sort((a, b) => a.report.suggestedBytes - b.report.suggestedBytes)[0]?.source ??
            c.source)
          : c.source;
    const entry = importStrudel(source).doc.body.find((n) => n.kind === 'shared');
    if (entry?.kind !== 'shared') throw Error('Literal converter did not provide an instrument');
    const pattern = entry.pattern;
    walk({ version: 2, body: [entry] }, (n) => {
      n.id = fresh('literal');
    });
    pattern.stem = stem.id;
    pattern.label = stem.id;
    let binding = `gnInstrument${fresh('i')}`;
    while ([...doc.body, ...definitions].some((n) => n.kind === 'shared' && n.name === binding))
      binding = `gnInstrument${fresh('i')}`;
    definitions.push({ ...entry, name: binding, pattern, purpose: 'instrument' });
    instruments.push({ id: fresh('part'), pattern: reference(binding) });
  }
  const section: Pattern = {
    id: fresh('section'),
    tier: 1,
    label: name.trim(),
    source,
    edited: false,
    core: { kind: 'group', how: 'stack', parts: instruments },
    layers: [],
  };
  let binding = `gnSection${fresh('s')}`;
  while (doc.body.some((n) => n.kind === 'shared' && n.name === binding))
    binding = `gnSection${fresh('s')}`;
  definitions.push({
    id: fresh('definition'),
    tier: 1,
    kind: 'shared',
    name: binding,
    nameSource: 'author',
    purpose: 'section',
    pattern: section,
  });
  const removed = previous.filter((p) => p.source && targets.some((t) => overlaps(link(p), t)));
  const warnings = removed.map((p) => ({
    placeId: p.id,
    source: link(p),
    message: `Making this section takes over bars ${link(p).fromBar}–${link(p).toBar - 1} (the whole place).`,
  }));
  const added = targets.map((t): GroupPart => ({
    id: fresh('place'),
    source: { folder, fromBar: t.fromBar, toBar: t.toBar },
    tempo: t.tempo,
    cycles: t.cycles,
    pattern: reference(binding),
  }));
  const active = [...previous.filter((p) => p.source && !removed.includes(p)), ...added].sort(
    (a, b) => link(a).fromBar - link(b).fromBar,
  );
  const parts: GroupPart[] = [];
  let cursor = 0;
  const gap = (end: number) => {
    if (end > cursor + 1e-9)
      parts.push({
        id: fresh('gap'),
        cycles: end - cursor,
        pattern: {
          id: fresh('silence'),
          tier: 1,
          core: { kind: 'generator', name: 'silence', args: [] },
          layers: [],
        },
      });
    cursor = end;
  };
  for (const p of active) {
    const t = sectionRange(song, link(p));
    gap(t.startCycle);
    parts.push(p);
    cursor = t.endCycle;
  }
  const last = conversionSpans(song, song.bars).at(-1);
  if (!last) throw Error('Missing reference spans');
  gap(last.endCycle);
  let next: Doc;
  if (root) next = replaceParts(doc, root, parts);
  else
    next = {
      ...doc,
      body: [
        ...doc.body,
        {
          id: fresh('voice'),
          tier: 1,
          kind: 'voice',
          name: 'Song',
          nameSource: 'generated',
          muted: false,
          pattern: {
            id: fresh('song'),
            tier: 1,
            core: { kind: 'group', how: 'arrange', parts },
            layers: [],
          },
        },
      ],
    };
  const index = next.body.findIndex((n) => n.kind === 'voice');
  next = {
    ...next,
    body: [...next.body.slice(0, index), ...definitions, ...next.body.slice(index)],
  };
  if (removed.length) {
    const live = new Set<string>();
    const byName = new Map(next.body.filter((n) => n.kind === 'shared').map((n) => [n.name, n]));
    const byId = new Map(
      next.body.filter((n) => n.kind === 'shared').map((n) => [n.pattern.id, n.name]),
    );
    const scan = (body: Doc['body']) =>
      walk({ version: 2, body }, (n) => {
        if (!('core' in n)) return;
        const p = n as Pattern;
        const names = [
          p.core.kind === 'ref' ? p.core.name : undefined,
          p.origin ? byId.get(p.origin) : undefined,
        ];
        for (const name of names) {
          const target = name && byName.get(name);
          if (target && !live.has(target.name)) {
            live.add(target.name);
            scan([target]);
          }
        }
      });
    scan(next.body.filter((n) => n.kind !== 'shared'));
    next = {
      ...next,
      body: next.body.filter(
        (n) =>
          n.kind !== 'shared' ||
          live.has(n.name) ||
          !(
            (n.purpose === 'section' && n.pattern.source) ||
            (n.purpose === 'instrument' && n.pattern.stem)
          ),
      ),
    };
  }
  const selectedPlace = added.find((p) => p.source?.fromBar === range.fromBar);
  if (!selectedPlace) throw Error('Missing selected place');
  return {
    doc: next,
    sectionId: section.id,
    placeIds: added.map((p) => p.id),
    selectedPlaceId: selectedPlace.id,
    warnings,
  };
}
