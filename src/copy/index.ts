import { convertInstrument, conversionSpans, type ConversionGrid } from '../convert';
import {
  instruments,
  walk,
  type Doc,
  type GroupPart,
  type Pattern,
  type SectionSource,
} from '../document';
import {
  resolveSection,
  song as documentSong,
  replaceParts,
} from '../document/edits/section-shared';
import { sameContent } from '../document/content';
import { importStrudel } from '../import';
import { generatePattern, generateCopy } from '../generate';
import type { ReferenceSong } from '../reference/types';
import {
  simplifyDrums,
  simplifyPitched,
  type MatchSettings,
  type SimplifySettings,
} from '../simplify';

const unarrangedMarker = '@ghost-notes-unarranged';

export type WrittenForm = 'literal' | 'simplified';
export type CopyOptions = {
  unedited: 'as-made' | WrittenForm;
  unarranged: 'silence' | WrittenForm;
  grid: ConversionGrid;
  simplify: SimplifySettings;
  match: MatchSettings;
};
export type CopyInput = {
  doc: Doc | null;
  song?: ReferenceSong;
  folder?: string;
  options: CopyOptions;
};
export type CopyResult = {
  text: string;
  silentBars: number;
  warnings: string[];
  seconds: number | null;
};

export function copyArrangement({ doc, song, folder, options }: CopyInput): CopyResult {
  if (!song) {
    if (!doc) throw Error('Open a song folder or load a Strudel program first.');
    return {
      text: generateCopy(doc),
      silentBars: 0,
      warnings: ['No reference open: copying the whole program as written.'],
      seconds: null,
    };
  }
  const referenceSong = song;
  const referenceFolder = folder || song.name;
  const spans = conversionSpans(song, song.bars);
  const root = doc && documentSong(doc);
  if (
    doc &&
    (!root ||
      root.core.kind !== 'group' ||
      !root.core.parts.some((p) => p.source) ||
      root.core.parts.some(
        (p) =>
          !p.source &&
          p.label !== 'Uncovered edge' &&
          !(
            p.pattern.core.kind === 'generator' &&
            p.pattern.core.name === 'silence' &&
            !p.pattern.layers.length
          ),
      ))
  ) {
    return {
      text: generateCopy(doc),
      silentBars: 0,
      warnings: [
        'This whole-program draft has no complete place links. Copying it as written; reference fills and place tempos are unavailable.',
      ],
      seconds: null,
    };
  }
  let serial = 0;
  const names = new Set(doc?.body.flatMap((n) => (n.kind === 'shared' ? [n.name] : [])) ?? []);
  const id = () => `copy${++serial}`;
  // Retain dependencies, setup, transforms and original section definitions.
  let output: Doc = doc ? structuredClone(doc) : { version: 2, body: [] };
  const definitions: Doc['body'] = [];
  const replacement = new Map<string, Pattern>();
  function written(
    source: SectionSource | undefined,
    form: WrittenForm,
    selection: { edge?: { startCycle: number }; stemIds?: readonly string[] } = {},
  ): Pattern {
    const { edge, stemIds } = selection;
    if (source && source.folder !== referenceFolder)
      throw Error('Reopen the linked song folder before converting its sections.');
    const selected = referenceSong.bars.filter(
      (b) => !source || (b.number >= source.fromBar && b.number < source.toBar),
    );
    if (source && selected.length !== source.toBar - source.fromBar)
      throw Error('Linked source bars are missing.');
    const parts = referenceSong.stems
      .filter((stem) => !stemIds?.length || stemIds.includes(stem.id))
      .map((stem) => {
        const conversion = convertInstrument({
          song: referenceSong,
          stemId: stem.id,
          range: source,
          grid: options.grid,
          includeUncovered: !source,
        });
        const suggestions =
          form === 'simplified'
            ? stem.id === 'drums'
              ? [
                  simplifyDrums({
                    song: referenceSong,
                    conversion,
                    settings: options.simplify,
                    match: options.match,
                  }),
                ]
              : simplifyPitched({
                  song: referenceSong,
                  conversion,
                  settings: options.simplify,
                  match: options.match,
                })
            : [];
        // Structural proposals are independent. Choose the shortest complete encoding,
        // retaining the literal when no candidate shortens it.
        const suggestion = suggestions
          .filter((s) => s.report.shorter)
          .sort((a, b) => a.report.suggestedBytes - b.report.suggestedBytes)[0];
        // Inline self-contained expressions to avoid collisions between converter bindings.
        return {
          id: id(),
          pattern: {
            id: id(),
            tier: 3 as const,
            stem: stem.id,
            core: {
              kind: 'opaque' as const,
              code: edge
                ? `(${suggestion?.expression ?? conversion.expression}).early(${edge.startCycle})`
                : (suggestion?.expression ?? conversion.expression),
            },
            layers: [],
          },
        };
      });
    return {
      id: id(),
      tier: 1,
      source,
      edited: false,
      core: { kind: 'group', how: 'stack', parts },
      layers: [],
    };
  }
  const places = root?.core.kind === 'group' ? root.core.parts : [];
  const authoredFills = new Set<string>();
  function normalized(pattern: Pattern) {
    return importStrudel(generatePattern(pattern)).doc.body.find((n) => n.kind === 'voice')
      ?.pattern;
  }
  const fills = places.filter((p) => {
    const content = doc && resolveSection(doc, p.pattern);
    if (!content || content.comment !== unarrangedMarker || content.edited !== false) return false;
    if (
      !content.source &&
      content.core.kind === 'generator' &&
      content.core.name === 'silence' &&
      !content.layers.length
    )
      return true;
    if (p.source) {
      const current = normalized(content);
      for (const form of ['literal', 'simplified'] as const)
        if (sameContent(current, normalized(written(p.source, form)))) return true;
    }
    // Text edited in another Strudel editor retains old metadata. Preserve it,
    // including when the user selected Literal for genuinely unedited sections.
    authoredFills.add(p.id);
    return false;
  });
  const parts: GroupPart[] = [];
  let silentBars = 0,
    seconds = 0;
  const covered = new Set<number>();
  function timed(part: GroupPart, cycles: number, tempo: number) {
    parts.push({ ...part, cycles, tempo });
    seconds += (cycles * 60) / tempo;
  }
  // Places follow source order. Overlaps are an invalid arrangement, never silently dropped.
  const edges = places.filter((p) => !p.source && p.label === 'Uncovered edge');
  const ordered = places
    .filter((p) => p.source && !fills.includes(p))
    .sort((a, b) => a.source!.fromBar - b.source!.fromBar);
  for (const place of ordered) {
    const source = place.source!;
    if (source.folder !== referenceFolder)
      throw Error('Reopen the linked song folder before copying its arrangement.');
    for (let bar = source.fromBar; bar < source.toBar; bar++) {
      if (covered.has(bar))
        throw Error('Section places overlap. Separate their source bars before copying.');
      if (!song.bars.some((b) => b.number === bar)) throw Error('Linked place bars are missing.');
      covered.add(bar);
    }
  }
  for (const span of spans) {
    if (!span.bar) {
      // Exported edges have no numbered link. Keep their authored code and tempo
      // when reopened, instead of mistaking the whole arrangement for a draft.
      const edge = edges.shift();
      timed(
        {
          ...edge,
          id: edge?.id ?? id(),
          label: edge?.label ?? 'Uncovered edge',
          pattern:
            edge?.pattern ??
            (options.unarranged === 'silence'
              ? {
                  id: id(),
                  tier: 1,
                  core: { kind: 'generator', name: 'silence', args: [] },
                  layers: [],
                }
              : written(undefined, options.unarranged, { edge: span })),
        },
        edge?.cycles ?? span.endCycle - span.startCycle,
        edge?.tempo ??
          (60 * (span.endCycle - span.startCycle)) / (span.endSeconds - span.startSeconds),
      );
      continue;
    }
    const bar = span.bar.number;
    const place = ordered.find((p) => p.source!.fromBar === bar);
    if (place && doc) {
      const source = place.source!;
      const content = resolveSection(doc, place.pattern);
      let pattern = authoredFills.has(place.id)
        ? { ...place.pattern, edited: true, comment: undefined }
        : place.pattern;
      if (
        !authoredFills.has(place.id) &&
        content.edited === false &&
        options.unedited !== 'as-made'
      ) {
        if (!content.source) throw Error('An unedited section has no original source link.');
        let next = replacement.get(content.id);
        if (!next) {
          let name: string;
          do {
            name = `ghostCopySection${id()}`;
          } while (names.has(name));
          names.add(name);
          next = { id: id(), tier: 1, core: { kind: 'ref', name }, layers: [] };
          definitions.push({
            id: id(),
            tier: 1,
            kind: 'shared',
            name,
            nameSource: 'generated',
            purpose: 'section',
            pattern: {
              ...written(content.source, options.unedited, {
                stemIds: instruments(doc)
                  .filter((row) =>
                    row.uses.some((use) => use.path.some((node) => node.id === content.id)),
                  )
                  .flatMap((row) =>
                    row.patterns.flatMap((pattern) => (pattern.stem ? [pattern.stem] : [])),
                  ),
              }),
              label: content.label,
            },
          });
          replacement.set(content.id, next);
        }
        pattern = { ...pattern, core: next.core };
      }
      const selected = spans.filter(
        (s) => s.bar && s.bar.number >= source.fromBar && s.bar.number < source.toBar,
      );
      const cycles = place.cycles ?? selected.reduce((n, s) => n + s.endCycle - s.startCycle, 0);
      const duration = selected.reduce((n, s) => n + s.endSeconds - s.startSeconds, 0);
      timed(
        { ...place, pattern },
        cycles,
        place.tempo ??
          (60 * selected.reduce((n, s) => n + s.endCycle - s.startCycle, 0)) / duration,
      );
    } else if (!covered.has(bar)) {
      const source = { folder: referenceFolder, fromBar: bar, toBar: bar + 1 };
      const cycles = span.endCycle - span.startCycle;
      const previousFill = fills.find((p) => p.source?.fromBar === bar);
      const silence = options.unarranged === 'silence';
      const fill: Pattern =
        options.unarranged === 'silence'
          ? {
              id: id(),
              tier: 1,
              edited: false,
              core: { kind: 'generator', name: 'silence', args: [] },
              layers: [],
            }
          : written(source, options.unarranged);
      fill.comment = unarrangedMarker;
      if (silence) silentBars++;
      timed(
        {
          id: previousFill?.id ?? id(),
          source,
          label: previousFill?.label ?? (bar === 0 ? 'Pickup' : `Bar ${bar}`),
          labelSource: previousFill?.labelSource,
          pattern: fill,
        },
        cycles,
        previousFill?.tempo ?? (60 * cycles) / (span.endSeconds - span.startSeconds),
      );
    }
  }
  if (root) output = replaceParts(output, root, parts);
  else
    output.body.push({
      id: id(),
      tier: 1,
      kind: 'voice',
      name: 'Arrangement',
      nameSource: 'generated',
      muted: false,
      pattern: { id: id(), tier: 1, core: { kind: 'group', how: 'arrange', parts }, layers: [] },
    });
  const firstVoice = output.body.findIndex((n) => n.kind === 'voice');
  output.body.splice(firstVoice, 0, ...definitions);
  const used = new Set<string>();
  const opaque: string[] = [];
  walk(output, (node) => {
    if (!('core' in node)) return;
    const pattern = node as Pattern;
    if (pattern.core.kind === 'ref') used.add(pattern.core.name);
    if (pattern.core.kind === 'opaque') opaque.push(pattern.core.code);
  });
  output.body = output.body.filter(
    (node) =>
      !(
        node.kind === 'shared' &&
        node.nameSource === 'generated' &&
        node.purpose === 'section' &&
        node.pattern.edited === false &&
        /^ghostCopySectioncopy\d+$/.test(node.name) &&
        !used.has(node.name) &&
        !opaque.some((code) => code.includes(node.name))
      ),
  );
  output.body = output.body.filter((n) => n.kind !== 'tempo');
  output.body.unshift({ id: id(), tier: 1, kind: 'tempo', cpm: 60 });
  const warnings: string[] = [];
  if (spans.some((s) => s.kind === 'pickup'))
    warnings.push(
      'Pickup plays first. A fractional pickup is correct on the first pass only: stop and restart Strudel before replaying; do not loop.',
    );
  if (spans.some((s) => s.kind === 'uncovered'))
    warnings.push(
      'Unnumbered edges have no source-bar links or detected beat map; reopened edges keep their written content. Stop and restart Strudel before replaying; do not loop.',
    );
  return { text: generateCopy(output), silentBars, warnings, seconds };
}
