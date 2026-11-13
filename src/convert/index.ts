import type { ReferenceBar, ReferenceSong, ReferenceStem } from '../reference/types';
import { conversionSpans, cycleToSeconds, secondsToBeat, secondsToCycle } from './grid';
import type {
  ConversionGrid,
  ConvertedInstrument,
  ConversionChange,
  ConversionSpan,
  Distribution,
  TimingError,
  WrittenNote,
} from './types';
import { conversionGrids, defaultConversionGrid } from './types';
export * from './types';
export { conversionSpans, cycleToSeconds, secondsToCycle } from './grid';

// The transcription tool's five classes, not an arbitrary General MIDI drum kit.
export const drumLanes = [
  { pitch: 35, sample: 'bd', label: 'kick' },
  { pitch: 38, sample: 'sd', label: 'snare' },
  { pitch: 42, sample: 'hh', label: 'hi-hat' },
  { pitch: 47, sample: 'lt', label: 'tom' },
  { pitch: 49, sample: 'cr', label: 'cymbal' },
] as const;

/** Half-open ownership uses original seconds, before snapping. Never wrap a late onset. */
function stepFor(
  song: ReferenceSong,
  spans: readonly ConversionSpan[],
  span: ConversionSpan,
  seconds: number,
  resolution: number,
): number {
  const fraction =
    (secondsToCycle(song, spans, seconds) - span.startCycle) / (span.endCycle - span.startCycle);
  return Math.max(0, Math.min(resolution - 1, Math.round(fraction * resolution)));
}
function snappedCycle(span: ConversionSpan, step: number, resolution: number): number {
  return span.startCycle + (step / resolution) * (span.endCycle - span.startCycle);
}
function distribution(values: number[]): Distribution {
  values.sort((a, b) => a - b);
  const at = (p: number) => values[Math.max(0, Math.ceil(values.length * p) - 1)] ?? 0;
  return { median: at(0.5), p95: at(0.95), max: at(1) };
}
export function timingError(song: ReferenceSong, notes: readonly WrittenNote[]): TimingError {
  return {
    milliseconds: distribution(
      notes.map((n) => Math.abs(n.written.startSeconds - n.source.startSeconds) * 1000),
    ),
    beats: distribution(
      notes.map((n) =>
        Math.abs(
          secondsToBeat(song, n.written.startSeconds) - secondsToBeat(song, n.source.startSeconds),
        ),
      ),
    ),
  };
}

/** Per instrument, per half-open bar-number range. Edges are included only on request. */
export function convertInstrument({
  song,
  bars = song.bars,
  stemId,
  range,
  includeUncovered = true,
  grid = defaultConversionGrid,
}: {
  song: ReferenceSong;
  bars?: readonly ReferenceBar[];
  stemId: string;
  range?: { fromBar: number; toBar: number };
  includeUncovered?: boolean;
  grid?: ConversionGrid;
}): ConvertedInstrument {
  if (!conversionGrids.includes(grid)) throw Error('Unsupported conversion grid');
  const stem = song.stems.find((s) => s.id === stemId);
  if (!stem) throw Error('Unknown conversion stem');
  if (
    range &&
    (!Number.isInteger(range.fromBar) ||
      !Number.isInteger(range.toBar) ||
      range.fromBar >= range.toBar)
  )
    throw Error('Expected a nonempty half-open bar range');
  const allSpans = conversionSpans(song, bars);
  const selected = allSpans.filter((span) =>
    span.bar
      ? !range || (span.bar.number >= range.fromBar && span.bar.number < range.toBar)
      : includeUncovered && !range,
  );
  const offset = selected[0]?.startCycle ?? 0;
  const spans = selected.map((span) => ({
    ...span,
    startCycle: span.startCycle - offset,
    endCycle: span.endCycle - offset,
  }));
  const grouped = selected.map((span) =>
    stem.notes.flatMap((note, sourceIndex) =>
      note.startSeconds >= span.startSeconds && note.startSeconds < span.endSeconds
        ? [{ note, sourceIndex }]
        : [],
    ),
  );
  const notes: WrittenNote[] = [];
  const changes: ConversionChange[] = [];
  const resolutions = grouped.map((entries, spanIndex) => {
    const span = selected[spanIndex];
    const musical = grid !== 'exact' && span.bar !== null;
    let resolution =
      grid !== 'exact' && span.bar ? (span.bar.endBeat - span.bar.startBeat) * grid : 16;
    // Adapt by measured residual, not by density. Clamp within the owning bar,
    // even when the nearest grid point would be the following downbeat.
    for (; !musical;) {
      const acceptable = entries.every(({ note }) => {
        const step = stepFor(song, allSpans, selected[spanIndex], note.startSeconds, resolution);
        const seconds = cycleToSeconds(
          song,
          allSpans,
          snappedCycle(selected[spanIndex], step, resolution),
        );
        return (
          Math.abs(seconds - note.startSeconds) <= 0.001 &&
          Math.abs(secondsToBeat(song, seconds) - secondsToBeat(song, note.startSeconds)) <=
            1 / 1024
        );
      });
      if (acceptable) break;
      if (resolution >= 1_048_576) throw Error('Unable to meet literal onset tolerance');
      resolution *= 2;
    }
    for (const { note, sourceIndex } of entries) {
      const step = stepFor(song, allSpans, selected[spanIndex], note.startSeconds, resolution);
      const originalCycle = snappedCycle(selected[spanIndex], step, resolution);
      const startSeconds = cycleToSeconds(song, allSpans, originalCycle);
      const written = {
        startSeconds,
        endSeconds: note.endSeconds + (startSeconds - note.startSeconds),
      };
      let endCycle = secondsToCycle(song, allSpans, written.endSeconds);
      if (musical) {
        // Floor the shifted end on its own bar's grid. Keep sub-step tails rather
        // than extending a note or reducing it to zero. Uncovered ends stay exact.
        const endSpan = allSpans.find(
          (s) => written.endSeconds > s.startSeconds && written.endSeconds <= s.endSeconds,
        );
        if (endSpan?.bar) {
          const count = (endSpan.bar.endBeat - endSpan.bar.startBeat) * grid;
          const width = endSpan.endCycle - endSpan.startCycle;
          const endStep = Math.floor(((endCycle - endSpan.startCycle) / width) * count + 1e-9);
          const candidate = snappedCycle(endSpan, endStep, count);
          if (candidate > originalCycle && candidate < endCycle - 1e-10) {
            endCycle = candidate;
            written.endSeconds = cycleToSeconds(song, allSpans, endCycle);
          }
        }
      }
      notes.push({
        sourceIndex,
        source: note,
        spanIndex,
        step,
        startCycle: originalCycle - offset,
        endCycle: endCycle - offset,
        velocity: note.velocity,
        mergedInto: null,
        written,
      });
    }
    if (musical) {
      const groups = new Map<string, WrittenNote[]>();
      for (const n of notes.filter((n) => n.spanIndex === spanIndex)) {
        const key = `${n.step}:${n.source.pitch}`;
        const group = groups.get(key) ?? [];
        group.push(n);
        groups.set(key, group);
      }
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        const first = group[0];
        const endCycle = Math.max(...group.map((n) => n.endCycle));
        const endSeconds = Math.max(...group.map((n) => n.written.endSeconds));
        const velocity = Math.max(...group.map((n) => n.velocity));
        for (const n of group) {
          n.endCycle = endCycle;
          n.written = { ...first.written, endSeconds };
          n.velocity = velocity;
          n.mergedInto = n === first ? null : first.sourceIndex;
        }
        changes.push({
          kind: 'merged',
          noteIndices: group.map((n) => n.sourceIndex),
          original: group.map((n) => ({
            startSeconds: n.source.startSeconds,
            endSeconds: n.source.endSeconds,
          })),
          written: [first.written],
        });
      }
    }
    return resolution;
  });
  const boundaries = new Set(
    allSpans.flatMap((span) =>
      span.bar && span.bar.number >= 1 ? [span.startSeconds, span.endSeconds] : [],
    ),
  );
  for (const n of notes) {
    const original = [{ startSeconds: n.source.startSeconds, endSeconds: n.source.endSeconds }];
    if (Math.abs(n.written.startSeconds - n.source.startSeconds) > 1e-10)
      changes.push({ kind: 'moved', noteIndices: [n.sourceIndex], original, written: [n.written] });
    if (
      n.written.endSeconds - n.written.startSeconds <
      n.source.endSeconds - n.source.startSeconds - 1e-10
    )
      changes.push({
        kind: 'shortened',
        noteIndices: [n.sourceIndex],
        original,
        written: [n.written],
      });
    if (
      [...boundaries].some(
        (boundary) => n.source.endSeconds <= boundary !== n.written.endSeconds <= boundary,
      )
    )
      changes.push({
        kind: 'moved-across-bar-line',
        noteIndices: [n.sourceIndex],
        original: [{ startSeconds: n.source.startSeconds, endSeconds: n.source.endSeconds }],
        written: [n.written],
      });
  }
  const expression = instrumentSource(
    stem,
    spans,
    resolutions,
    notes.filter((n) => n.mergedInto === null),
    grid,
  );
  return {
    stemId,
    quantization: grid,
    spans,
    grid: allSpans.map((span) => ({
      ...span,
      startCycle: span.startCycle - offset,
      endCycle: span.endCycle - offset,
    })),
    resolutions,
    notes,
    changes,
    expression,
    // An explicit ODM instrument boundary keeps all bars and drum lanes in one row.
    source: `/*@odm-shared {"purpose":"instrument","nameSource":"generated"}*/ const literalInstrument = ${expression};
$: literalInstrument;`,
  };
}
function instrumentSource(
  stem: ReferenceStem,
  spans: readonly ConversionSpan[],
  resolutions: readonly number[],
  notes: readonly WrittenNote[],
  grid: ConversionGrid,
): string {
  function barSource(index: number, pitch?: number): string {
    const span = spans[index];
    const resolution = resolutions[index];
    const width = span.endCycle - span.startCycle;
    const selected = notes.filter(
      (n) => n.spanIndex === index && (pitch === undefined || n.source.pitch === pitch),
    );
    if (grid !== 'exact' && span.bar && selected.length) {
      // Pack different steps into a voice; simultaneous pitches need extra voices.
      // Legato retains overlaps independently of the next onset in that voice.
      const voices: (WrittenNote | undefined)[][] = [];
      for (const n of selected) {
        let voice = voices.find((v) => !v[n.step]);
        if (!voice) {
          voice = Array.from({ length: resolution });
          voices.push(voice);
        }
        voice[n.step] = n;
      }
      const lanes = voices.map((slots) => {
        const rhythm = slots
          .map((n) =>
            n
              ? pitch === undefined
                ? String(n.source.pitch)
                : (drumLanes.find((d) => d.pitch === pitch)?.sample ?? '')
              : '~',
          )
          .join(' ');
        // Values on rests are neutral: replacing a rest in ODM enables a note.
        const gains = slots.map((n) => (n ? n.velocity / 127 : 1)).join(' ');
        const lengths = slots
          .map((n) => {
            const length = n ? ((n.endCycle - n.startCycle) * resolution) / width : 1;
            return Math.abs(length - Math.round(length)) < 1e-9 ? Math.round(length) : length;
          })
          .join(' ');
        return `${pitch === undefined ? 'note' : 's'}(${JSON.stringify(rhythm)}).gain(${JSON.stringify(gains)}).legato(${JSON.stringify(lengths)})`;
      });
      const pattern = lanes.length === 1 ? lanes[0] : `stack(${lanes.join(', ')})`;
      return `[${width}, ${width === 1 ? pattern : `(${pattern}).slow(${width})`}]`;
    }
    const parts = notes
      .filter((n) => n.spanIndex === index && (pitch === undefined || n.source.pitch === pitch))
      .map((n) => {
        const token = pitch === undefined ? String(n.source.pitch) : 'x';
        const rhythm = [
          n.step ? `~@${n.step}` : '',
          token,
          resolution - n.step - 1 ? `~@${resolution - n.step - 1}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        const base =
          pitch === undefined
            ? `note(${JSON.stringify(rhythm)})`
            : `s(${JSON.stringify(rhythm.replace('x', drumLanes.find((d) => d.pitch === pitch)?.sample ?? ''))})`;
        return `${base}.gain(${n.velocity}/127).legato(${((n.endCycle - n.startCycle) * resolution) / width})`;
      });
    const pattern = !parts.length
      ? 'silence'
      : parts.length === 1
        ? parts[0]
        : `stack(${parts.join(', ')})`;
    return `[${width}, ${width === 1 ? pattern : `(${pattern}).slow(${width})`}]`;
  }
  const sequence = (pitch?: number) =>
    spans.length ? `arrange(${spans.map((_, i) => barSource(i, pitch)).join(', ')})` : 'silence';
  if (stem.id === 'drums') {
    if (notes.some((n) => !drumLanes.some((d) => d.pitch === n.source.pitch)))
      throw Error('Unsupported transcription drum class');
    return `stack(\n${drumLanes.map((d) => `  ${sequence(d.pitch)} /* ${d.sample}: ${d.label} */`).join(',\n')}\n)`;
  }
  return `${sequence()}.s("triangle")`;
}
