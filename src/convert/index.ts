import type { ReferenceBar, ReferenceSong, ReferenceStem } from '../reference/types';
import { conversionSpans, cycleToSeconds, secondsToBeat, secondsToCycle } from './grid';
import type {
  ConvertedInstrument,
  ConversionChange,
  ConversionSpan,
  Distribution,
  TimingError,
  WrittenNote,
} from './types';
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
}: {
  song: ReferenceSong;
  bars?: readonly ReferenceBar[];
  stemId: string;
  range?: { fromBar: number; toBar: number };
  includeUncovered?: boolean;
}): ConvertedInstrument {
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
    let resolution = 16;
    // Adapt by measured residual, not by density. Clamp within the owning bar,
    // even when the nearest grid point would be the following downbeat.
    for (;;) {
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
      notes.push({
        sourceIndex,
        source: note,
        spanIndex,
        step,
        startCycle: originalCycle - offset,
        endCycle: secondsToCycle(song, allSpans, written.endSeconds) - offset,
        written,
      });
      if (startSeconds !== note.startSeconds)
        changes.push({
          kind: 'moved',
          noteIndices: [sourceIndex],
          original: [{ startSeconds: note.startSeconds, endSeconds: note.endSeconds }],
          written: [written],
        });
    }
    return resolution;
  });
  const boundaries = new Set(
    allSpans.flatMap((span) =>
      span.bar && span.bar.number >= 1 ? [span.startSeconds, span.endSeconds] : [],
    ),
  );
  for (const n of notes) {
    if (
      n.written.startSeconds !== n.source.startSeconds &&
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
  return {
    stemId,
    spans,
    grid: allSpans.map((span) => ({
      ...span,
      startCycle: span.startCycle - offset,
      endCycle: span.endCycle - offset,
    })),
    resolutions,
    notes,
    changes,
    expression: instrumentSource(stem, spans, resolutions, notes),
    // An explicit ODM instrument boundary keeps all bars and drum lanes in one row.
    source: `/*@odm-shared {"purpose":"instrument","nameSource":"generated"}*/ const literalInstrument = ${instrumentSource(stem, spans, resolutions, notes)};
$: literalInstrument;`,
  };
}
function instrumentSource(
  stem: ReferenceStem,
  spans: readonly ConversionSpan[],
  resolutions: readonly number[],
  notes: readonly WrittenNote[],
): string {
  function barSource(index: number, pitch?: number): string {
    const span = spans[index];
    const resolution = resolutions[index];
    const width = span.endCycle - span.startCycle;
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
        return `${base}.gain(${n.source.velocity}/127).legato(${((n.endCycle - n.startCycle) * resolution) / width})`;
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
